// API Route: POST /api/employees/reset-password
// Allows Gestor or Super Admin to reset a collaborator's password securely.
// Generates a random temporary password, hashes it, sets must_change_password = true, logs audit.

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { generateTemporaryPassword, hashPassword } from "@/lib/auth/passwordUtils";
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
    if (!session || (session.role !== "gestor" && session.role !== "super_adm")) {
      return NextResponse.json({ error: "Acesso negado. Apenas Gestores ou Super Admin podem resetar senhas." }, { status: 403 });
    }

    const { employeeId } = await req.json();
    if (!employeeId) {
      return NextResponse.json({ error: "ID do colaborador é obrigatório." }, { status: 400 });
    }

    const db = getDb();
    const employees: any[] = Array.isArray(db.employees) ? db.employees : [];

    const empIndex = employees.findIndex((e: any) => e.id === employeeId);
    if (empIndex < 0) {
      return NextResponse.json({ error: "Colaborador não encontrado." }, { status: 404 });
    }

    const emp = employees[empIndex];

    // Enforce tenant isolation for Gestor
    if (session.role === "gestor") {
      const empCompanyId = emp.company_id || emp.companyId;
      if (empCompanyId !== session.companyId) {
        return NextResponse.json({ error: "Você só pode administrar colaboradores da sua própria empresa." }, { status: 403 });
      }
      // Gestor cannot reset own password or superior super_adm through this route
      if (emp.role === "super_adm") {
        return NextResponse.json({ error: "Gestores não podem alterar senhas de Administradores Master." }, { status: 403 });
      }
    }

    // Generate random secure temporary password
    const tempPassword = generateTemporaryPassword();
    const hashedPassword = await hashPassword(tempPassword);
    const now = new Date().toISOString();

    employees[empIndex] = {
      ...employees[empIndex],
      password_hash: hashedPassword,
      passwordHash: hashedPassword,
      must_change_password: true,
      mustChangePassword: true,
      status: "Primeiro acesso pendente",
      password_reset_at: now
    };
    // Remove credenciais legadas em texto puro para invalidar a senha anterior
    delete employees[empIndex].password;
    delete employees[empIndex].temporary_password;
    delete employees[empIndex].temporaryPassword;

    db.employees = employees;

    // Audit log
    if (!Array.isArray(db.audit_logs)) db.audit_logs = [];
    db.audit_logs.unshift({
      id: `log_${Date.now()}`,
      company_id: session.companyId || "global",
      user_name: session.name || "Gestor",
      action: `Senha resetada para o colaborador ${emp.name} (${emp.email})`,
      resource: "Usuários & Equipe",
      created_at: now
    });

    saveDb(db);

    return NextResponse.json({
      success: true,
      message: "Nova senha temporária gerada com sucesso!",
      temporaryPassword: tempPassword,
      employeeName: emp.name,
      employeeEmail: emp.email
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Erro ao resetar senha." }, { status: 500 });
  }
}
