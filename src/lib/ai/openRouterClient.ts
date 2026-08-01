import { resolveAIProvider } from "./providerResolver";
import { readDb, writeDb } from "@/lib/db/localDb";
import { FALLBACK_PRICING, USD_TO_BRL } from "./pricing";

// Mapping futuristic models to actual models available on OpenRouter
export const MODEL_MAP: Record<string, string> = {
  // OpenAI
  "openai/gpt-5.5-turbo": "openai/gpt-4o",
  "openai/gpt-5.0-pro": "openai/o3-mini-high",
  "openai/o4-mini": "openai/o3-mini",
  
  // Anthropic
  "anthropic/claude-4.8-sonnet": "anthropic/claude-3.7-sonnet",
  "anthropic/claude-4.7-opus": "anthropic/claude-3.5-haiku",
  "anthropic/claude-3.7-sonnet": "anthropic/claude-3.7-sonnet",
  
  // Google
  "google/gemini-3.6-pro": "google/gemini-2.5-pro",
  "google/gemini-3.5-flash": "google/gemini-2.5-flash",
  "google/gemini-3.0-ultra": "google/gemini-pro-1.5",
  
  // DeepSeek
  "deepseek/deepseek-v4": "deepseek/deepseek-chat",
  "deepseek/deepseek-r2": "deepseek/deepseek-r1",
  "deepseek/deepseek-v3.5": "deepseek/deepseek-chat",
  
  // Open Source / Others
  "qwen/qwen-3-72b": "qwen/qwen-2.5-72b-instruct",
  "meta-llama/llama-4-405b": "meta-llama/llama-3.1-405b-instruct",
  "moonshot/kimi-256k": "google/gemini-2.5-flash", // Fallback if moonshot not available
};

export interface AIResponse {
  content: string;
  isError: boolean;
  errorDetail?: string;
}

export async function executeAIRequest(options: {
  companyId: string;
  userRole?: string;
  userEmail?: string;
  requestedModel: string;
  temperature?: number;
  messages: any[];
  persona?: string;
  featureContext: string;
}): Promise<AIResponse> {
  const startTime = Date.now();
  
  // 1. Resolve Provider and Key
  const resolved = await resolveAIProvider({
    companyId: options.companyId,
    userRole: options.userRole,
    userEmail: options.userEmail,
    requestedModel: options.requestedModel
  });

  // Map to real model if futuristic
  const realModel = MODEL_MAP[resolved.model] || resolved.model || "anthropic/claude-3.7-sonnet";
  
  // Check if no master key provided (initial setup)
  if (!resolved.apiKey || resolved.apiKey.includes("sk-or-v1-master-****")) {
    return {
      isError: true,
      content: "Nenhuma chave de API configurada. Por favor, adicione sua chave da OpenRouter no Painel Super ADM.",
      errorDetail: "Missing API Key"
    };
  }

  // Balance check logic (Item 6)
  if (!resolved.isCustomEndpoint) {
    const dbCheck = await readDb();
    if (dbCheck.companies) {
      const companyIndex = dbCheck.companies.findIndex((c: any) => c.id === options.companyId);
      if (companyIndex >= 0) {
        let currentFranchise = dbCheck.companies[companyIndex].coins_franchise;
        if (currentFranchise === undefined) currentFranchise = dbCheck.companies[companyIndex].coinsFranchise;
        if (currentFranchise === undefined || currentFranchise < 1) {
          return {
            isError: true,
            content: "Saldo insuficiente de OmniCoins para realizar a operação. Recarregue no módulo financeiro.",
            errorDetail: "Insufficient Coins"
          };
        }
      }
    }
  }

  try {
    const { buildAgentSystemPrompt } = await import("./agentContextBuilder");

    // 2. Prepare Context-Enriched Messages for Tenant
    let finalMessages = [...options.messages];
    const systemIdx = finalMessages.findIndex(m => m.role === "system");

    if (systemIdx >= 0) {
      const enrichedSystemPrompt = await buildAgentSystemPrompt({
        companyId: options.companyId || "",
        agentId: options.persona,
        baseSystemPrompt: finalMessages[systemIdx].content
      });
      finalMessages[systemIdx] = { ...finalMessages[systemIdx], content: enrichedSystemPrompt };
    } else {
      const enrichedSystemPrompt = await buildAgentSystemPrompt({
        companyId: options.companyId || "",
        agentId: options.persona,
        baseSystemPrompt: "Você é um especialista assistente da plataforma OmniZeus."
      });
      finalMessages.unshift({ role: "system", content: enrichedSystemPrompt });
    }

    // Fetch OpenRouter / Endpoint
    const response = await fetch(resolved.apiUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resolved.apiKey}`,
        "HTTP-Referer": "https://omnizeus.zenitus.com.br",
        "X-Title": "OmniZeus Accounting BPO",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: realModel,
        messages: finalMessages,
        temperature: options.temperature,
        stream: false,
      }),
    });


    if (!response.ok) {
      const errorText = await response.text();
      return {
        isError: true,
        content: `Falha na API da OpenRouter: ${response.statusText}`,
        errorDetail: errorText
      };
    }

    const data = await response.json();
    const textContent = data.choices?.[0]?.message?.content || "";
    
    // 3. Accounting & Isolation (Metrics)
    const durationMs = Date.now() - startTime;
    const promptLen = JSON.stringify(options.messages).length;
    
    let inputTokens = data.usage?.prompt_tokens || data.usage?.input_tokens || Math.round(promptLen / 4);
    let outputTokens = data.usage?.completion_tokens || data.usage?.output_tokens || Math.round(textContent.length / 4);
    let totalTokens = data.usage?.total_tokens || (inputTokens + outputTokens);
    
    let costUsd = 0;
    // Attempt to parse OpenRouter native cost (if available) or use fallback
    if (data.usage?.total_cost !== undefined) {
      costUsd = data.usage.total_cost;
    } else {
      const rates = FALLBACK_PRICING[realModel] || FALLBACK_PRICING["anthropic/claude-3.7-sonnet"];
      costUsd = ((inputTokens / 1_000_000) * rates.prompt) + ((outputTokens / 1_000_000) * rates.completion);
    }
    
    // Custom endpoints cost 0
    if (resolved.isCustomEndpoint) costUsd = 0;
    
    const costBrl = parseFloat((costUsd * USD_TO_BRL).toFixed(6));
    
    // Coins logic: $0.10 USD = 1 Coin? 
    // Wait, the documentation says "1 OmniCoin = R$ 0,10". Let's use costBrl / 0.10
    // Always consume at least 1 coin if there's any cost, or 0 if custom
    let omnicoinsConsumed = resolved.isCustomEndpoint ? 0 : Math.max(1, Math.ceil(costBrl / 0.10));

    // Deduzir Coins da Empresa Específica e Salvar Métricas
    const db = await readDb();
    
    if (db.companies) {
      const companyIndex = db.companies.findIndex((c: any) => c.id === options.companyId);
      if (companyIndex >= 0) {
        let currentFranchise = db.companies[companyIndex].coins_franchise;
        if (currentFranchise === undefined) currentFranchise = db.companies[companyIndex].coinsFranchise || 0;
        
        let newFranchise = Math.max(0, currentFranchise - omnicoinsConsumed);
        db.companies[companyIndex].coins_franchise = newFranchise;
        db.companies[companyIndex].coinsFranchise = newFranchise; // Compatibility
        
        let totalConsumed = db.companies[companyIndex].consumed_coins || 0;
        db.companies[companyIndex].consumed_coins = totalConsumed + omnicoinsConsumed;
      }
    }
    
    const now = new Date().toISOString();
    const usageLog = {
      id: `log_ai_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,

      company_id: options.companyId,
      usuario_id: "usr_gestor", // could extract from token in a real env
      agente_id: options.persona || "agente_padrao",
      agente_nome: options.persona || "Assistente IA",
      modelo: realModel,
      funcionalidade: options.featureContext,
      tipo_operacao: "STANDARD",
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      total_tokens: totalTokens,
      custo_openrouter_usd: costUsd,
      custo_openrouter_brl: costBrl,
      omnicoins_consumed: omnicoinsConsumed,
      credential_source: resolved.credentialSource,
      duracao_ms: durationMs,
      status: "SUCCESS",
      created_at: now
    };

    if (!Array.isArray(db.ai_usage_logs)) db.ai_usage_logs = [];
    if (!Array.isArray(db.ai_usage_metrics)) db.ai_usage_metrics = [];

    db.ai_usage_logs.unshift(usageLog);
    db.ai_usage_metrics.unshift({
      id: `metric_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,

      company_id: options.companyId,
      model: realModel,
      persona: options.persona || "geral",
      prompt_length: promptLen,
      response_length: textContent.length,
      latency_ms: durationMs,
      tokens_est: totalTokens,
      token_throughput_tps: durationMs > 0 ? parseFloat((outputTokens / (durationMs / 1000)).toFixed(2)) : 0,
      context_memory_kb: parseFloat((promptLen / 1024).toFixed(2)),
      created_at: now
    });

    await writeDb(db);

    return {
      isError: false,
      content: textContent,
    };

  } catch (error: any) {
    return {
      isError: true,
      content: "Erro interno ao processar a requisição LLM.",
      errorDetail: error.message
    };
  }
}
