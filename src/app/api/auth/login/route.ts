// API Route: POST /api/auth/login
// Server-side authentication — sets a signed HttpOnly cookie with the session.
// This is the ONLY way the frontend should authenticate. Never trust client-side state for auth.

import { NextRequest, NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/auth/session";
import { PRODUCTION_USERS } from "@/lib/auth/roles";
import path from "path";
import fs from "fs";

export const runtime = "nodejs";

const DB_FILE = path.join(process.cwd(), "data", "omnizeus_local_sql_database.json");

function getDb(): any {
  try {
    if (fs.existsSync(DB_FILE)) return JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
  } catch {}
  return {};
}

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "E-mail e senha são obrigatórios." }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanPass = password.trim();

    // 1. Check hardcoded production users (super admin etc.)
    const prodUser = PRODUCTION_USERS.find(
      u => u.email.toLowerCase() === cleanEmail && u.passwordHash === cleanPass
    );

    if (prodUser) {
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
    const db = getDb();
    const employees: any[] = Array.isArray(db.employees) ? db.employees : [];

    // Support both direct plain text check (for legacy) and hashed password comparison
    const { hashPassword } = await import("@/lib/auth/passwordUtils");
    const hashedPassInput = await hashPassword(cleanPass);

    const empIndex = employees.findIndex(
      (e: any) => (e.email || "").toLowerCase() === cleanEmail &&
        (e.passwordHash === cleanPass || e.password_hash === cleanPass || e.password === cleanPass || e.temporary_password === cleanPass || e.temporaryPassword === cleanPass || e.passwordHash === hashedPassInput || e.password_hash === hashedPassInput)
    );

    if (empIndex >= 0) {
      const emp = employees[empIndex];

      // Check if user account is blocked or inactive
      if (emp.status === "Bloqueado" || emp.status === "Inativo") {
        return NextResponse.json(
          { success: false, error: "Esta conta está desativada ou bloqueada. Entre em contato com o Gestor da sua empresa." },
          { status: 403 }
        );
      }

      // Update last login timestamp
      const now = new Date().toISOString();
      employees[empIndex].last_login_at = now;
      employees[empIndex].lastLoginAt = now;
      try {
        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf-8");
      } catch {}

      const mustChangePassword = emp.must_change_password === true || emp.mustChangePassword === true;

      // Resolve company name
      const companies: any[] = Array.isArray(db.companies) ? db.companies : [];
      const company = companies.find((c: any) => c.id === emp.company_id || c.id === emp.companyId);
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
        mustChangePassword
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
