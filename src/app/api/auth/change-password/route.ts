export const dynamic = "force-dynamic";
// API Route: POST /api/auth/change-password
// Endpoint for first login / mandatory password change.
// Validates password security rules, hashes new password, sets must_change_password = false.

import { NextRequest, NextResponse } from "next/server";
import { getSession, setSessionCookie } from "@/lib/auth/session";
import { validatePasswordRequirements, hashPassword } from "@/lib/auth/passwordUtils";
import { supabase } from "@/lib/db/supabaseClient";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const session = getSession(req);
    if (!session) {
      return NextResponse.json({ error: "Sessão inválida ou expirada. Faça login novamente." }, { status: 401 });
    }

    const { newPassword, confirmPassword } = await req.json();

    // O alvo vem SEMPRE da sessão. Aceitar userId do body permitiria a qualquer
    // pessoa trocar a senha de outro usuário.
    const targetUserId = session.userId;

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

    const { data: employees, error: fetchError } = await supabase
      .from("employees")
      .select("*")
      .or(`id.eq.${targetUserId},email.ilike.${session.email}`);

    if (fetchError || !employees || employees.length === 0) {
      return NextResponse.json({ error: "Usuário não encontrado para atualização de senha." }, { status: 404 });
    }

    const employee = employees[0];
    const now = new Date().toISOString();

    const { error: updateError } = await supabase
      .from("employees")
      .update({
        password_hash: hashedPassword,
        passwordHash: hashedPassword,
        must_change_password: false,
        mustChangePassword: false,
        password_changed_at: now,
        passwordChangedAt: now,
        status: "Ativo",
        password: null,
        temporary_password: null,
        temporaryPassword: null
      })
      .eq("id", employee.id);

    if (updateError) {
      throw updateError;
    }

    // Log audit entry
    await supabase.from("audit_logs").insert([{
      company_id: employee.company_id || employee.companyId || "global",
      user_name: employee.name || "Usuário",
      action: "Senha alterada no primeiro acesso pelo próprio usuário",
      resource: "Autenticação"
    }]);

    const res = NextResponse.json({
      success: true,
      message: "Senha alterada com sucesso! Seu acesso foi liberado.",
      user: {
        id: employee.id,
        name: employee.name,
        email: employee.email,
        role: employee.role,
        companyId: employee.company_id || employee.companyId
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

