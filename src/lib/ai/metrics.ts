// Contabilização central de consumo de IA: débito de OmniCoins + ai_usage_logs
// + ai_usage_metrics. Única fonte de verdade — o /api/chat e todas as rotas de
// IA que usam executeAIRequest(skipAccounting: true) chamam este helper com
// suas próprias regras de coins/funcionalidade.

import { readDb, writeDb } from "@/lib/db/localDb";
import { USD_TO_BRL } from "@/lib/ai/pricing";

export interface RecordAIMetricsOptions {
  companyId: string;
  userId: string;
  model: string;
  functionality: string;
  operationType?: string;
  agentId?: string;
  agentName?: string;
  coins: number;
  inputTokens?: number;
  outputTokens?: number;
  reasoningTokens?: number;
  totalTokens?: number;
  costUsd?: number;
  costBrl?: number;
  credentialSource?: string;
  latencyMs?: number;
  status?: string;
}

export async function recordAIMetrics(opts: RecordAIMetricsOptions): Promise<void> {
  try {
    const db = await readDb();
    const now = new Date().toISOString();

    const inputTokens = opts.inputTokens || 0;
    const outputTokens = opts.outputTokens || 0;
    const reasoningTokens = opts.reasoningTokens || 0;
    const totalTokens = opts.totalTokens || (inputTokens + outputTokens);

    // ── Deduzir Coins da carteira da empresa específica ─────────────────────
    if (Array.isArray(db.companies)) {
      const companyIndex = db.companies.findIndex((c: any) => c.id === (opts.companyId || "comp_zenitus"));
      if (companyIndex >= 0) {
        const currentFranchise: number =
          typeof db.companies[companyIndex].coins_franchise === 'number'
            ? db.companies[companyIndex].coins_franchise
            : (typeof db.companies[companyIndex].coinsFranchise === 'number'
                ? db.companies[companyIndex].coinsFranchise : 0);
        const newFranchise = Math.max(0, currentFranchise - opts.coins);
        db.companies[companyIndex].coins_franchise = newFranchise;
        db.companies[companyIndex].coinsFranchise = newFranchise;
        db.companies[companyIndex].consumed_coins = (db.companies[companyIndex].consumed_coins || 0) + opts.coins;
      }
    }

    const usageLog = {
      id: `log_ai_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      company_id: opts.companyId || "comp_zenitus",
      usuario_id: opts.userId || "usr_gestor",
      agente_id: opts.agentId || "omni_ia_hub",
      agente_nome: opts.agentName || "Assistente IA",
      modelo: opts.model || "anthropic/claude-3.7-sonnet",
      funcionalidade: opts.functionality,
      tipo_operacao: opts.operationType || "STANDARD",
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      reasoning_tokens: reasoningTokens,
      total_tokens: totalTokens,
      custo_openrouter_usd: opts.costUsd ?? 0,
      custo_openrouter_brl: opts.costBrl ?? 0,
      omnicoins_consumed: opts.coins,
      credential_source: opts.credentialSource || 'master_fallback',
      duracao_ms: opts.latencyMs || 0,
      status: opts.status || "SUCCESS",
      created_at: now
    };

    if (!Array.isArray(db.ai_stress_test_logs)) db.ai_stress_test_logs = [];
    if (!Array.isArray(db.ai_usage_metrics)) db.ai_usage_metrics = [];
    if (!Array.isArray(db.ai_usage_logs)) db.ai_usage_logs = [];

    db.ai_usage_logs.unshift(usageLog);
    db.ai_usage_metrics.unshift({
      id: `metric_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      company_id: opts.companyId || "comp_zenitus",
      model: opts.model || "anthropic/claude-3.7-sonnet",
      persona: opts.agentId || "geral",
      prompt_length: 0,
      response_length: 0,
      latency_ms: opts.latencyMs || 0,
      tokens_est: totalTokens,
      token_throughput_tps: opts.latencyMs ? parseFloat((outputTokens / (opts.latencyMs / 1000)).toFixed(2)) : 0,
      context_memory_kb: 0,
      created_at: now
    });

    await writeDb(db);
  } catch (err) {
    console.error("Error recording AI usage metrics:", err);
  }
}

// ─── Helpers de conveniência ──────────────────────────────────────────────────

/** Calcula custo em USD/BRL por taxas fixas (compatível com o padrão do chat). */
export function estimateCostByFixedRates(inputTokens: number, outputTokens: number, isCustom = false) {
  const costUsd = isCustom ? 0 : parseFloat(((inputTokens * 0.0000025) + (outputTokens * 0.000010)).toFixed(6));
  const costBrl = isCustom ? 0 : parseFloat((costUsd * USD_TO_BRL).toFixed(4));
  return { costUsd, costBrl };
}
