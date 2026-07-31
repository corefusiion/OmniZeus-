// API Route: POST /api/auth/change-password
// Endpoint for first login / mandatory password change.
// Validates password security rules, hashes new password, sets must_change_password = false.

import { NextRequest, NextResponse } from "next/server";
import { getSession, setSessionCookie } from "@/lib/auth/session";
import { validatePasswordRequirements, hashPassword } from "@/lib/auth/passwordUtils";
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

function saveDb(data: any): boolean {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
    return true;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession(req);
    const { userId, newPassword, confirmPassword } = await req.json();

    const targetUserId = session?.userId || userId;
    if (!targetUserId) {
      return NextResponse.json({ error: "Sessão inválida ou não informada." }, { status: 401 });
    }

    if (!newPassword || !confirmPassword) {
      return NextResponse.json({ error: "Nova senha e confirmação são obrigatórias." }, { status: 400 });
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json({ error: "A nova senha e a confirmação não coincidem." }, { status: 400 });
    }

    // Validate security rules
    const validation = validatePasswordRequirements(newPassword);
    if (!validation.isValid) {
      return NextResponse.json({
        error: "A senha não atende a todos os requisitos de segurança exigidos.",
        checks: validation.checks
      }, { status: 400 });
    }

    const hashedPassword = await hashPassword(newPassword);
    const db = getDb();
    const employees: any[] = Array.isArray(db.employees) ? db.employees : [];

    const empIndex = employees.findIndex((e: any) => e.id === targetUserId || e.email?.toLowerCase() === session?.email?.toLowerCase());

    if (empIndex < 0) {
      return NextResponse.json({ error: "Usuário não encontrado para atualização de senha." }, { status: 404 });
    }

    const now = new Date().toISOString();
    employees[empIndex] = {
      ...employees[empIndex],
      password_hash: hashedPassword,
      passwordHash: hashedPassword,
      must_change_password: false,
      mustChangePassword: false,
      password_changed_at: now,
      passwordChangedAt: now,
      status: "Ativo"
    };

    db.employees = employees;

    // Log audit entry
    if (!Array.isArray(db.audit_logs)) db.audit_logs = [];
    db.audit_logs.unshift({
      id: `log_${Date.now()}`,
      company_id: employees[empIndex].company_id || employees[empIndex].companyId || "global",
      user_name: employees[empIndex].name || "Usuário",
      action: "Senha alterada no primeiro acesso pelo próprio usuário",
      resource: "Autenticação",
      created_at: now
    });

    saveDb(db);

    const res = NextResponse.json({
      success: true,
      message: "Senha alterada com sucesso! Seu acesso foi liberado.",
      user: {
        id: employees[empIndex].id,
        name: employees[empIndex].name,
        email: employees[empIndex].email,
        role: employees[empIndex].role,
        companyId: employees[empIndex].company_id || employees[empIndex].companyId
      }
    });

    if (session) {
      return setSessionCookie(res, {
        ...session,
        mustChangePassword: false
      });
    }

    return res;
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Erro interno ao alterar senha." }, { status: 500 });
  }
}
