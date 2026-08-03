export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { readDb, writeDb } from "@/lib/db/localDb";
import { USD_TO_BRL } from "@/lib/ai/pricing";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session) {
      return NextResponse.json({ error: "NÃ£o autenticado.", code: "UNAUTHORIZED" }, { status: 401 });
    }

    const body = await req.json();
    const {
      company_id: requestedCompanyId,
      usuario_id,
      agente_id,
      agente_nome,
      modelo,
      funcionalidade,
      tipo_operacao,
      coins_consumed,
      tokens_input,
      tokens_output,
      reasoning_tokens,
      total_tokens,
      custo_openrouter_usd,
      custo_openrouter_brl
    } = body;

    // O tenant cobrado vem da sessÃ£o. Aceitar company_id do body permitiria
    // debitar OmniCoins da carteira de outra empresa.
    const company_id = session.role === "super_adm"
      ? (requestedCompanyId || session.companyId)
      : session.companyId;

    if (!company_id) {
      return NextResponse.json({ error: "company_id Ã© obrigatÃ³rio." }, { status: 400 });
    }

    const coinsToDeduct = typeof coins_consumed === 'number' && coins_consumed > 0 ? coins_consumed : 5;

    const db = await readDb();

    // â”€â”€ Deduzir da carteira da empresa especÃ­fica (isolamento por tenant) â”€â”€â”€â”€â”€â”€
    if (!Array.isArray(db.companies)) {
      return NextResponse.json({ error: "Nenhuma empresa encontrada no banco de dados." }, { status: 404 });
    }

    const companyIndex = db.companies.findIndex((c: any) => c.id === company_id);
    if (companyIndex < 0) {
      return NextResponse.json({ error: `Empresa '${company_id}' nÃ£o encontrada.` }, { status: 404 });
    }

    // Support both coins_franchise (snake_case) and coinsFranchise (camelCase)
    let currentBalance: number = db.companies[companyIndex].coins_franchise;
    if (currentBalance === undefined) currentBalance = db.companies[companyIndex].coinsFranchise || 0;

    if (currentBalance < coinsToDeduct) {
      return NextResponse.json(
        {
          error: "Saldo insuficiente de OmniCoins para realizar a operaÃ§Ã£o.",
          required: coinsToDeduct,
          current_balance: currentBalance,
          company_id
        },
        { status: 402 }
      );
    }

    const newBalance = currentBalance - coinsToDeduct;
    // Persist in both field names for full compatibility
    db.companies[companyIndex].coins_franchise = newBalance;
    db.companies[companyIndex].coinsFranchise = newBalance;

    // Track total consumed per company
    const totalConsumed = db.companies[companyIndex].consumed_coins || 0;
    db.companies[companyIndex].consumed_coins = totalConsumed + coinsToDeduct;

    const inputToks = tokens_input || 2000;
    const outputToks = tokens_output || 1500;
    const totalToks = total_tokens || (inputToks + outputToks);
    const costUsd = custo_openrouter_usd || parseFloat(((inputToks * 0.000003) + (outputToks * 0.000012)).toFixed(6));
    const costBrl = custo_openrouter_brl || parseFloat((costUsd * USD_TO_BRL).toFixed(4));

    const usageLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      company_id,
      usuario_id: usuario_id || "usr_gestor",
      agente_id: agente_id || "omni_ia_hub",
      agente_nome: agente_nome || "Gerador de ConteÃºdo IA",
      modelo: modelo || "anthropic/claude-3.7-sonnet",
      funcionalidade: funcionalidade || "GeraÃ§Ã£o de ConteÃºdo",
      tipo_operacao: tipo_operacao || "DOCUMENT_A4",
      input_tokens: inputToks,
      output_tokens: outputToks,
      reasoning_tokens: reasoning_tokens || 0,
      total_tokens: totalToks,
      custo_openrouter_usd: costUsd,
      custo_openrouter_brl: costBrl,
      omnicoins_consumed: coinsToDeduct,
      duracao_ms: 1200,
      status: "SUCCESS",
      created_at: new Date().toISOString()
    };

    if (!Array.isArray(db.ai_usage_logs)) db.ai_usage_logs = [];
    db.ai_usage_logs.unshift(usageLog);

    await writeDb(db);

    return NextResponse.json({ success: true, consumed: coinsToDeduct, newBalance });
  } catch (err: any) {
    console.error("Error consuming coins:", err);
    return NextResponse.json({ error: "Erro interno ao descontar moedas." }, { status: 500 });
  }
}

