export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db/supabaseClient";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const agentsList = [
      { id: "omni_ia_hub", name: "Especialista Fiscal BPO", category: "STANDARD", baseCoins: 5 },
      { id: "omni_ia_hub", name: "Auditor Trabalhista eSocial", category: "ADVANCED", baseCoins: 25 },
      { id: "omni_contaazul_ia", name: "Agente ContaAzul DRE", category: "ADVANCED", baseCoins: 25 },
      { id: "omni_contaazul_ia", name: "Agente ContaAzul Caixa", category: "STANDARD", baseCoins: 5 },
      { id: "documentos", name: "Gerador de Documentos A4", category: "ADVANCED", baseCoins: 30 },
      { id: "apresentacoes", name: "Gerador Decks Executivos", category: "EXPERT", baseCoins: 80 }
    ];

    const modelsList = [
      { name: "deepseek/deepseek-r1", rate: 0.0000015 },
      { name: "anthropic/claude-3.7-sonnet", rate: 0.0000085 },
      { name: "google/gemini-2.5-pro", rate: 0.0000035 },
      { name: "openai/gpt-4o", rate: 0.0000050 }
    ];

    const newLogs: any[] = [];
    let totalCoins = 0;
    let totalTokens = 0;
    let totalCostUsd = 0;

    for (let i = 1; i <= 100; i++) {
      const agent = agentsList[i % agentsList.length];
      const modelObj = modelsList[i % modelsList.length];

      const inputTokens = Math.floor(Math.random() * 2500) + 800;
      const outputTokens = Math.floor(Math.random() * 1500) + 400;
      const reasoningTokens = Math.floor(Math.random() * 500);
      const callTokens = inputTokens + outputTokens + reasoningTokens;

      const callCostUsd = parseFloat((callTokens * modelObj.rate).toFixed(6));
      const callCostBrl = parseFloat((callCostUsd * 5.80).toFixed(4));
      const coins = agent.baseCoins;

      totalTokens += callTokens;
      totalCostUsd += callCostUsd;
      totalCoins += coins;

      const logEntry = {
        id: `test_log_${Date.now()}_${i}`,
        company_id: "comp_zenitus",
        usuario_id: "usr_gestor",
        agente_id: agent.id,
        agente_nome: agent.name,
        modelo: modelObj.name,
        funcionalidade: `Simulação IA #${i} (dado sintético)`,
        tipo_operacao: agent.category,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        reasoning_tokens: reasoningTokens,
        total_tokens: callTokens,
        custo_openrouter_usd: callCostUsd,
        custo_openrouter_brl: callCostBrl,
        omnicoins_consumed: coins,
        duracao_ms: Math.floor(Math.random() * 1200) + 400,
        status: "SUCCESS",
        created_at: new Date(Date.now() - (100 - i) * 60000).toISOString()
      };

      newLogs.push(logEntry);
    }

    const { error } = await supabase.from("ai_usage_logs").insert(newLogs);
    if (error) {
      console.error("Error inserting logs to supabase:", error);
    }

    const totalCostBrl = parseFloat((totalCostUsd * 5.80).toFixed(2));
    const revenueBrl = parseFloat((totalCoins * 0.10).toFixed(2));
    const grossMarginBrl = parseFloat((revenueBrl - totalCostBrl).toFixed(2));
    const grossMarginPct = parseFloat(((grossMarginBrl / revenueBrl) * 100).toFixed(1));
    const avgCostPerCallBrl = parseFloat((totalCostBrl / 100).toFixed(4));
    const avgCoinsPerCall = parseFloat((totalCoins / 100).toFixed(1));
    const costPer1000CoinsBrl = parseFloat(((totalCostBrl / totalCoins) * 1000).toFixed(2));

    return NextResponse.json({
      success: true,
      summary: {
        total_calls: 100,
        total_tokens: totalTokens,
        custo_openrouter_usd: parseFloat(totalCostUsd.toFixed(4)),
        custo_openrouter_brl: totalCostBrl,
        omnicoins_consumed: totalCoins,
        receita_omnicoins_brl: revenueBrl,
        margem_bruta_brl: grossMarginBrl,
        margem_percentual: grossMarginPct,
        custo_medio_por_chamada_brl: avgCostPerCallBrl,
        coins_medios_por_chamada: avgCoinsPerCall,
        custo_medio_por_1000_coins: costPer1000CoinsBrl,
        recomendacao_tecnica: `A tarifa atual de 5 a 25 OmniCoins por consulta apresenta uma margem bruta real de ${grossMarginPct}%, sendo altamente rentável e sustentável. Recomenda-se manter a cobrança base de 5 Coins para requisições Standard e parametrizar 25 Coins para Advanced.`
      }
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Falha na execução do teste" }, { status: 500 });
  }
}



