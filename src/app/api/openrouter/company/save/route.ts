export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { maskApiKey } from "@/lib/ai/providerResolver";
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
      return NextResponse.json({ error: "Acesso negado. Apenas o administrador da plataforma gerencia chaves de API.", code: "FORBIDDEN" }, { status: 403 });
    }

    const { companyId, apiKey } = await req.json();

    if (!companyId || !apiKey || apiKey.trim().length === 0) {
      return NextResponse.json({ error: "Empresa e chave de API são obrigatórias." }, { status: 400 });
    }

    const trimmedKey = apiKey.trim();

    // Perform live connection test first
    const testRes = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { "Authorization": `Bearer ${trimmedKey}` }
    });

    if (!testRes.ok) {
      const errText = await testRes.text();
      return NextResponse.json({ 
        error: `Falha no teste de conexão com a OpenRouter: ${testRes.status} ${testRes.statusText}`
      }, { status: 400 });
    }

    const testData = await testRes.json();
    const modelsCount = testData.data?.length || 0;

    const { data: company, error: findError } = await supabase.from('companies').select('id').eq('id', companyId).maybeSingle();
    if (findError || !company) {
      return NextResponse.json({ error: "Empresa não encontrada." }, { status: 444 });
    }

    const now = new Date().toISOString();

    await supabase.from('companies').update({
      openrouter_api_key: trimmedKey,
      openrouter_key_status: 'connected',
      openrouter_key_tested_at: now,
      updated_at: now
    }).eq('id', companyId);

    // Record Audit Log
    await supabase.from('audit_logs').insert([{
      id: `log_audit_${Date.now()}`,
      company_id: companyId,
      user_name: session.name || "Super Admin",
      action: "SAVE_COMPANY_OPENROUTER_KEY",
      resource: `Empresa ${companyId}`,
      details: `Chave OpenRouter cadastrada (Masked: ${maskApiKey(trimmedKey)})`,
      created_at: now
    }]);

    return NextResponse.json({
      success: true,
      maskedKey: maskApiKey(trimmedKey),
      status: 'connected',
      testedAt: now,
      modelsCount
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}



