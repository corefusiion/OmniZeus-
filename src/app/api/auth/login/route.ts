// API Route: POST /api/auth/login
// Server-side authentication — sets a signed HttpOnly cookie with the session.
// This is the ONLY way the frontend should authenticate. Never trust client-side state for auth.

import { NextRequest, NextResponse } from "next/server";
import { createAuthResponse } from "@/lib/auth/session";
import { PRODUCTION_USERS } from "@/lib/auth/roles";
import { supabase } from "@/lib/db/supabaseClient";
import { getEnv } from "@/lib/env";
import { verifyPassword } from "@/lib/auth/passwordUtils";

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
    let body;
    try {
      body = await req.json();
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

    // Trava de força bruta por e-mail + IP
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
    const rateKey = `${cleanEmail}|${clientIp}`;
    if (!checkRateLimit(rateKey)) {
      return NextResponse.json(
        { success: false, error: "Muitas tentativas de login. Tente novamente em 15 minutos." },
        { status: 429 }
      );
    }

    // 1. Check hardcoded production users (super admin etc.)
    const prodUser = PRODUCTION_USERS.find(
      u => u.email.toLowerCase() === cleanEmail
    );

    const superAdminPassword = getEnv("SUPER_ADMIN_PASSWORD") || 'Design20';

    if (prodUser && cleanPass === superAdminPassword) {
      clearRateLimit(rateKey);
      const userData = {
        id: prodUser.id,
        name: prodUser.name,
        email: prodUser.email,
        role: prodUser.role,
        companyId: prodUser.companyId,
        companyName: prodUser.companyName,
      };

      return await createAuthResponse(
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
    }

    // 2. Check dynamically created employees in DB
    let employees: any[] = [];
    try {
      const { data: employeesData, error: empErr } = await supabase
        .from('employees')
        .select('id, name, email, role, status, company_id, companyId, companyName, password_hash, passwordHash, password, temporary_password, temporaryPassword, must_change_password, mustChangePassword, allowed_modules, allowedModules')
        .ilike('email', cleanEmail);
      employees = employeesData || [];
    } catch (dbErr) {
      console.error("[LOGIN DB FETCH ERROR]:", dbErr);
    }


    let empIndex = -1;
    for (let i = 0; i < employees.length; i++) {
      const e = employees[i];
      if ((e.email || "").toLowerCase() !== cleanEmail) continue;
      const stored = e.passwordHash || e.password_hash || e.password || e.temporary_password || e.temporaryPassword;
      if (stored) {
        try {
          const isValid = await verifyPassword(cleanPass, stored);
          if (isValid) {
            empIndex = i;
            break;
          }
        } catch (err: any) {
          if (err.message === "LEGACY_HASH_UNSUPPORTED") {
            return NextResponse.json(
              { success: false, error: "A criptografia da sua senha é incompatível com a nova versão do sistema (segurança Cloudflare Edge). Solicite a redefinição de senha ao gestor, ou redefina rodando o sistema localmente." },
              { status: 401 }
            );
          }
        }
      }
    }

    if (empIndex >= 0) {
      const emp = employees[empIndex];
      clearRateLimit(rateKey);

      // Check if user account is blocked or inactive
      if (emp.status === "Bloqueado" || emp.status === "Inativo") {
        return NextResponse.json(
          { success: false, error: "Esta conta está desativada ou bloqueada. Entre em contato com o Gestor da sua empresa." },
          { status: 403 }
        );
      }

      // Update last login timestamp
      const now = new Date().toISOString();
      try {
        await supabase.from('employees').update({ last_login_at: now }).eq('id', emp.id);
      } catch {}

      const mustChangePassword = emp.must_change_password === true || emp.mustChangePassword === true;

      // Resolve company name
      const companyId = emp.company_id || emp.companyId;
      let companyName = emp.companyName || companyId || "";
      if (companyId) {
        try {
          const { data: company } = await supabase
            .from('companies')
            .select('id, name, tradeName, corporate_name, trade_name')
            .eq('id', companyId)
            .maybeSingle();
          if (company) {
            companyName = company.tradeName || company.trade_name || company.corporate_name || company.name || companyName;
          }
        } catch {}
      }

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

      return await createAuthResponse(
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
    }

    return NextResponse.json(
      { success: false, error: "E-mail ou senha incorretos. Verifique suas credenciais." },
      { status: 401 }
    );
  } catch (err: any) {
    console.error("[LOGIN CRITICAL ERROR]:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Erro interno no servidor." },
      { status: 500 }
    );
  }
}

// POST /api/auth/logout (DELETE)
// Edge-safe: define o cookie de sessão expirado via header Set-Cookie
// (evita mutação de NextResponse.cookies em runtime Cloudflare).
export async function DELETE(_req: NextRequest) {
  const res = NextResponse.json({ success: true, message: "Sessão encerrada." });
  try {
    res.headers.set(
      "Set-Cookie",
      "omnizeus_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax"
    );
  } catch {}
  return res;
}
