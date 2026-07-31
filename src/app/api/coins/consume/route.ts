import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE_PATH = path.join(DATA_DIR, "omnizeus_local_sql_database.json");

function getLocalDbFile(): any {
  try {
    if (fs.existsSync(DB_FILE_PATH)) {
      const raw = fs.readFileSync(DB_FILE_PATH, "utf-8");
      return JSON.parse(raw);
    }
  } catch (e) {}
  return {};
}

function saveLocalDbFile(db: any): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(db, null, 2), "utf-8");
  } catch (err) {
    console.error("Error saving local SQL database file:", err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      company_id,
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

    if (!company_id) {
      return NextResponse.json({ error: "company_id é obrigatório." }, { status: 400 });
    }

    const coinsToDeduct = typeof coins_consumed === 'number' && coins_consumed > 0 ? coins_consumed : 5;

    const db = getLocalDbFile();

    // ── Deduzir da carteira da empresa específica (isolamento por tenant) ──────
    if (!Array.isArray(db.companies)) {
      return NextResponse.json({ error: "Nenhuma empresa encontrada no banco de dados." }, { status: 404 });
    }

    const companyIndex = db.companies.findIndex((c: any) => c.id === company_id);
    if (companyIndex < 0) {
      return NextResponse.json({ error: `Empresa '${company_id}' não encontrada.` }, { status: 404 });
    }

    // Support both coins_franchise (snake_case) and coinsFranchise (camelCase)
    const currentBalance: number =
      typeof db.companies[companyIndex].coins_franchise === 'number'
        ? db.companies[companyIndex].coins_franchise
        : (typeof db.companies[companyIndex].coinsFranchise === 'number'
            ? db.companies[companyIndex].coinsFranchise
            : 0);

    if (currentBalance < coinsToDeduct) {
      return NextResponse.json(
        {
          error: "Saldo insuficiente de OmniCoins para realizar a operação.",
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
    const costBrl = custo_openrouter_brl || parseFloat((costUsd * 5.80).toFixed(4));

    const usageLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      company_id,
      usuario_id: usuario_id || "usr_gestor",
      agente_id: agente_id || "omni_ia_hub",
      agente_nome: agente_nome || "Gerador de Conteúdo IA",
      modelo: modelo || "anthropic/claude-3.7-sonnet",
      funcionalidade: funcionalidade || "Geração de Conteúdo",
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

    saveLocalDbFile(db);

    return NextResponse.json({
      success: true,
      coins_consumed: coinsToDeduct,
      new_balance: newBalance,
      company_id,
      log: usageLog
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Falha ao processar consumo de OmniCoins" }, { status: 500 });
  }
}

