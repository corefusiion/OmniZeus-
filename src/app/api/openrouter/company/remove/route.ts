export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { supabase } from "@/lib/db/supabaseClient";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session) {
      return NextResponse.json({ error: "Não autenticado.", code: "UNAUTHORIZED" }, { status: 401 });
    }
    if (session.role !== "super_adm") {
      return NextResponse.json({ error: "Acesso negado.", code: "FORBIDDEN" }, { status: 403 });
    }

    const { companyId } = await req.json();

    if (!companyId) {
      return NextResponse.json({ error: "Identificador da empresa é obrigatório." }, { status: 400 });
    }

    const now = new Date().toISOString();

    const { data: company, error: findError } = await supabase.from('companies').select('id').eq('id', companyId).maybeSingle();
    if (findError || !company) {
      return NextResponse.json({ error: "Empresa não encontrada." }, { status: 404 });
    }

    await supabase.from('companies').update({
      openrouter_api_key: null,
      openrouter_key_status: 'master_fallback',
      updated_at: now
    }).eq('id', companyId);

    // Record Audit Log
    await supabase.from('audit_logs').insert([{
      id: `log_audit_${Date.now()}`,
      company_id: companyId,
      user_name: session.name || "Super Admin",
      action: "REMOVE_COMPANY_OPENROUTER_KEY",
      resource: `Empresa ${companyId}`,
      details: "Chave OpenRouter removida. Empresa revertida para a API Master (Fallback).",
      created_at: now
    }]);

    return NextResponse.json({
      success: true,
      message: "Chave removida. Empresa revertida para a API Master (Fallback).",
      status: 'master_fallback'
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}



