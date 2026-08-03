export const dynamic = "force-dynamic";
// API Route: POST /api/employees/reset-password
// Allows Gestor or Super Admin to reset a collaborator's password securely.
// Generates a random temporary password, hashes it, sets must_change_password = true, logs audit.

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { generateTemporaryPassword, hashPassword } from "@/lib/auth/passwordUtils";
import { supabase } from "@/lib/db/supabaseClient";

export const runtime = "edge";

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

    const { data: emp, error: fetchError } = await supabase
      .from("employees")
      .select("*")
      .eq("id", employeeId)
      .single();

    if (fetchError || !emp) {
      return NextResponse.json({ error: "Colaborador não encontrado." }, { status: 404 });
    }

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

    const { error: updateError } = await supabase
      .from("employees")
      .update({
        password_hash: hashedPassword,
        passwordHash: hashedPassword,
        must_change_password: true,
        mustChangePassword: true,
        status: "Primeiro acesso pendente",
        password_reset_at: now,
        password: null, // Remove credenciais legadas em texto puro para invalidar a senha anterior
        temporary_password: null,
        temporaryPassword: null
      })
      .eq("id", employeeId);

    if (updateError) {
      throw updateError;
    }

    // Audit log
    await supabase.from("audit_logs").insert([{
      company_id: session.companyId || "global",
      user_name: session.name || "Gestor",
      action: `Senha resetada para o colaborador ${emp.name} (${emp.email})`,
      resource: "Usuários & Equipe"
    }]);

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



