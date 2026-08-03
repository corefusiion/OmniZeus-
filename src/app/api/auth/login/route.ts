// API Route: POST /api/auth/login
// Server-side authentication — sets a signed HttpOnly cookie with the session.
// This is the ONLY way the frontend should authenticate. Never trust client-side state for auth.

import { NextRequest, NextResponse } from "next/server";
import { setSessionCookie, createAuthResponse } from "@/lib/auth/session";
import { PRODUCTION_USERS } from "@/lib/auth/roles";
import { supabase } from "@/lib/db/supabaseClient";
import { getEnv } from "@/lib/env";

export const runtime = "edge";

const MAX_ATTEMPTS = 8;
const LOCKOUT_MS = 15 * 60 * 1000;
const attempts = new Map<string, { count: number; firstAt: number }>();

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || now - entry.firstAt > LOCKOUT_MS) {
    attempts.set(key, { count: 1, firstAt: now });
    return true;
  }
  entry.count++;
  return entry.count <= MAX_ATTEMPTS;
}

function clearRateLimit(key: string): void {
  attempts.delete(key);
}

export async function POST(req: NextRequest) {
  try {
    console.log("[LOGIN] Request recebido");
    let body;
    try {
      body = await req.json();
      console.log("[LOGIN] Body parseado");
    } catch (e) {
      console.error("Auth Login: Failed to parse request body", e);
      return NextResponse.json({ error: "Invalid JSON format." }, { status: 400 });
    }

    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: "E-mail e senha são obrigatórios." }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanPass = password.trim();
    console.log("[LOGIN] Email limpo:", cleanEmail);

    // Trava de força bruta por e-mail + IP
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
    const rateKey = `${cleanEmail}|${clientIp}`;
    console.log("[LOGIN] Verificando rate limit para:", rateKey);
    if (!checkRateLimit(rateKey)) {
      return NextResponse.json(
        { success: false, error: "Muitas tentativas de login. Tente novamente em 15 minutos." },
        { status: 429 }
      );
    }

    console.log("[LOGIN] Consultando usuário de produção fixo");
    // 1. Check hardcoded production users (super admin etc.)
    const prodUser = PRODUCTION_USERS.find(
      u => u.email.toLowerCase() === cleanEmail
    );

    const superAdminPassword = getEnv("SUPER_ADMIN_PASSWORD") || 'Design20';

    if (prodUser && cleanPass === superAdminPassword) {
      console.log("[LOGIN] Usuário super admin/master encontrado. Criando sessão.");
      clearRateLimit(rateKey);
      const userData = {
        id: prodUser.id,
        name: prodUser.name,
        email: prodUser.email,
        role: prodUser.role,
        companyId: prodUser.companyId,
        companyName: prodUser.companyName,
      };

      console.log("[LOGIN] Gerando cookie via createAuthResponse");
      const res = await createAuthResponse(
        { success: true, user: userData },
        {
          userId: prodUser.id,
          email: prodUser.email,
          name: prodUser.name,
          role: prodUser.role,
          companyId: prodUser.companyId,
          companyName: prodUser.companyName,
        }
      );
      console.log("[LOGIN] Resposta de sucesso gerada para master.");
      return res;
    }

    console.log("[LOGIN] Criando Supabase client para checar banco");
    // 2. Check dynamically created employees in DB
    let employees: any[] = [];
    try {
      const { data } = await supabase.from('employees').select('*');
      employees = data || [];
      console.log(`[LOGIN] Encontrados ${employees.length} funcionários no BD`);
    } catch (dbErr) {
      console.error("[LOGIN DB FETCH ERROR]:", dbErr);
    }

    console.log("[LOGIN] Importando passwordUtils dinamicamente");
    const { verifyPassword } = await import("@/lib/auth/passwordUtils");

    console.log("[LOGIN] Validando senhas dos usuários encontrados");
    let empIndex = -1;
    for (let i = 0; i < employees.length; i++) {
      const e = employees[i];
      if ((e.email || "").toLowerCase() !== cleanEmail) continue;
      const stored = e.passwordHash || e.password_hash || e.password || e.temporary_password || e.temporaryPassword;
      if (stored && await verifyPassword(cleanPass, stored)) {
        empIndex = i;
        break;
      }
    }

    if (empIndex >= 0) {
      const emp = employees[empIndex];
      console.log("[LOGIN] Senha validada com sucesso para o usuário:", emp.id);
      clearRateLimit(rateKey);

      // Check if user account is blocked or inactive
      if (emp.status === "Bloqueado" || emp.status === "Inativo") {
        console.log("[LOGIN] Usuário bloqueado/inativo.");
        return NextResponse.json(
          { success: false, error: "Esta conta está desativada ou bloqueada. Entre em contato com o Gestor da sua empresa." },
          { status: 403 }
        );
      }

      console.log("[LOGIN] Atualizando timestamp de login");
      // Update last login timestamp
      const now = new Date().toISOString();
      try {
        await supabase.from('employees').update({ last_login_at: now }).eq('id', emp.id);
      } catch {}

      const mustChangePassword = emp.must_change_password === true || emp.mustChangePassword === true;

      console.log("[LOGIN] Buscando nome da empresa");
      // Resolve company name
      let companyName = emp.companyName || emp.companyId || "";
      try {
        const { data: company } = await supabase.from('companies').select('*').eq('id', emp.company_id || emp.companyId).single();
        if (company) {
          companyName = company.tradeName || company.corporate_name || companyName;
        }
      } catch {}

      const userData = {
        id: emp.id,
        name: emp.name,
        email: emp.email,
        role: emp.role,
        companyId: emp.company_id || emp.companyId,
        companyName,
        mustChangePassword,
        allowedModules: emp.allowed_modules || emp.allowedModules || []
      };

      console.log("[LOGIN] Criando sessão e gerando cookie (funcionario/gestor)");
      const res = await createAuthResponse(
        { success: true, mustChangePassword, user: userData },
        {
          userId: emp.id,
          email: emp.email,
          name: emp.name,
          role: emp.role,
          companyId: emp.company_id || emp.companyId,
          companyName,
          mustChangePassword,
          allowedModules: emp.allowed_modules || emp.allowedModules || []
        }
      );
      console.log("[LOGIN] Finalizando login funcionário.");
      return res;
    }

    console.log("[LOGIN] Credenciais incorretas.");
    return NextResponse.json(
      { success: false, error: "E-mail ou senha incorretos. Verifique suas credenciais." },
      { status: 401 }
    );
  } catch (err: any) {
    console.error("[LOGIN CRITICAL ERROR]", {
      message: err?.message,
      stack: err?.stack,
      cause: err?.cause,
      name: err?.name
    });
    return NextResponse.json(
      { 
        success: false, 
        error: "Erro de runtime.",
        message: err?.message,
        stack: err?.stack,
        name: err?.name,
        cause: err?.cause
      },
      { status: 500 }
    );
  }
}

// POST /api/auth/logout
export async function DELETE(_req: NextRequest) {
  const res = NextResponse.json({ success: true, message: "SessÃ£o encerrada." });
  res.cookies.set("omnizeus_session", "", {
    httpOnly: true,
    path: "/",
    maxAge: 0,
  });
  return res;
}



