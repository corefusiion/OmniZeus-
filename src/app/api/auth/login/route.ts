export const dynamic = "force-dynamic";
// API Route: POST /api/auth/login
// Server-side authentication — sets a signed HttpOnly cookie with the session.
// This is the ONLY way the frontend should authenticate. Never trust client-side state for auth.

import { NextRequest, NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/auth/session";
import { PRODUCTION_USERS } from "@/lib/auth/roles";
import { supabase } from "@/lib/db/supabaseClient";

export const runtime = "nodejs";

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
    const { email, password } = await req.json();

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

    const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || 'Design20';

    if (prodUser && cleanPass === superAdminPassword) {
      clearRateLimit(rateKey);
      const res = NextResponse.json({
        success: true,
        user: {
          id: prodUser.id,
          name: prodUser.name,
          email: prodUser.email,
          role: prodUser.role,
          companyId: prodUser.companyId,
          companyName: prodUser.companyName,
        }
      });
      return setSessionCookie(res, {
        userId: prodUser.id,
        email: prodUser.email,
        name: prodUser.name,
        role: prodUser.role,
        companyId: prodUser.companyId,
        companyName: prodUser.companyName,
      });
    }

    // 2. Check dynamically created employees in DB
    const { data: employees } = await supabase.from('employees').select('*');
    const safeEmployees = employees || [];

    const { verifyPassword } = await import("@/lib/auth/passwordUtils");

    let empIndex = -1;
    for (let i = 0; i < safeEmployees.length; i++) {
      const e = safeEmployees[i];
      if ((e.email || "").toLowerCase() !== cleanEmail) continue;
      const stored = e.passwordHash || e.password_hash || e.password || e.temporary_password || e.temporaryPassword;
      if (stored && await verifyPassword(cleanPass, stored)) {
        empIndex = i;
      }
      break;
    }

    if (empIndex >= 0) {
      const emp = safeEmployees[empIndex];
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
      await supabase.from('employees').update({ last_login_at: now }).eq('id', emp.id);

      const mustChangePassword = emp.must_change_password === true || emp.mustChangePassword === true;

      // Resolve company name
      const { data: company } = await supabase.from('companies').select('*').eq('id', emp.company_id || emp.companyId).single();
      const companyName = emp.companyName || company?.tradeName || company?.corporate_name || emp.companyId || "";

      const res = NextResponse.json({
        success: true,
        mustChangePassword,
        user: {
          id: emp.id,
          name: emp.name,
          email: emp.email,
          role: emp.role,
          companyId: emp.company_id || emp.companyId,
          companyName,
          mustChangePassword,
          allowedModules: emp.allowed_modules || emp.allowedModules || []
        }
      });

      return setSessionCookie(res, {
        userId: emp.id,
        email: emp.email,
        name: emp.name,
        role: emp.role,
        companyId: emp.company_id || emp.companyId,
        companyName,
        mustChangePassword,
        allowedModules: emp.allowed_modules || emp.allowedModules || []
      });
    }

    return NextResponse.json(
      { success: false, error: "E-mail ou senha incorretos. Verifique suas credenciais." },
      { status: 401 }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Erro interno no servidor." }, { status: 500 });
  }
}

// POST /api/auth/logout
export async function DELETE(_req: NextRequest) {
  const res = NextResponse.json({ success: true, message: "Sessão encerrada." });
  res.cookies.set("omnizeus_session", "", {
    httpOnly: true,
    path: "/",
    maxAge: 0,
  });
  return res;
}



