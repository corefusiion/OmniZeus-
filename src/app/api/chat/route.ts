import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { resolveAIProvider } from "@/lib/ai/providerResolver";
import { executeAIRequest } from "@/lib/ai/openRouterClient";
import { readDb, writeDb } from "@/lib/db/localDb";
import { USD_TO_BRL } from "@/lib/ai/pricing";
import { getSession } from "@/lib/auth/session";

export const runtime = "nodejs";

async function getSavedSettings(): Promise<any> {
  const db = await readDb();
  return db?.settings || {};
}

async function recordChatMetrics(
  companyId: string,
  model: string,
  persona: string,
  promptLength: number,
  responseLength: number,
  messageCount: number,
  latencyMs: number,
  usageData?: { input_tokens?: number; output_tokens?: number; reasoning_tokens?: number; total_tokens?: number },
  credentialSource?: string
) {
  try {
    const db = await readDb();
    const now = new Date().toISOString();

    const inputTokens = usageData?.input_tokens || Math.round(promptLength / 4);
    const outputTokens = usageData?.output_tokens || Math.round(responseLength / 4);
    const reasoningTokens = usageData?.reasoning_tokens || 0;
    const totalTokens = usageData?.total_tokens || (inputTokens + outputTokens);

    const isCustom = credentialSource === 'superadmin_custom_endpoint';
    const costUsd = isCustom ? 0 : parseFloat(((inputTokens * 0.0000025) + (outputTokens * 0.000010)).toFixed(6));
    const costBrl = isCustom ? 0 : parseFloat((costUsd * USD_TO_BRL).toFixed(4));

    const omnicoinsConsumed = 5;

    // ── Deduzir Coins da carteira da empresa específica ─────────────────────
    if (Array.isArray(db.companies)) {
      const companyIndex = db.companies.findIndex((c: any) => c.id === (companyId || "comp_zenitus"));
      if (companyIndex >= 0) {
        const currentFranchise: number =
          typeof db.companies[companyIndex].coins_franchise === 'number'
            ? db.companies[companyIndex].coins_franchise
            : (typeof db.companies[companyIndex].coinsFranchise === 'number'
                ? db.companies[companyIndex].coinsFranchise : 0);
        const newFranchise = Math.max(0, currentFranchise - omnicoinsConsumed);
        db.companies[companyIndex].coins_franchise = newFranchise;
        db.companies[companyIndex].coinsFranchise = newFranchise;
        db.companies[companyIndex].consumed_coins = (db.companies[companyIndex].consumed_coins || 0) + omnicoinsConsumed;
      }
    }


    const usageLog = {
      id: `log_ai_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      company_id: companyId || "comp_zenitus",
      usuario_id: "usr_gestor",
      agente_id: persona || "omni_ia_hub",
      agente_nome: persona === "sped" ? "Especialista SPED & Fiscal" : persona === "contaazul" ? "Agente ContaAzul ERP" : "Especialista Fiscal BPO",
      modelo: model || "google/gemini-2.5-pro",
      funcionalidade: "Consulta IA Chat",
      tipo_operacao: "STANDARD",
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      reasoning_tokens: reasoningTokens,
      total_tokens: totalTokens,
      custo_openrouter_usd: costUsd,
      custo_openrouter_brl: costBrl,
      omnicoins_consumed: omnicoinsConsumed,
      credential_source: credentialSource || 'master_fallback',
      duracao_ms: latencyMs,
      status: "SUCCESS",
      created_at: now
    };

    if (!Array.isArray(db.ai_stress_test_logs)) db.ai_stress_test_logs = [];
    if (!Array.isArray(db.ai_usage_metrics)) db.ai_usage_metrics = [];
    if (!Array.isArray(db.ai_usage_logs)) db.ai_usage_logs = [];

    db.ai_usage_logs.unshift(usageLog);
    db.ai_usage_metrics.unshift({
      id: `metric_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      company_id: companyId || "comp_zenitus",
      model: model || "google/gemini-2.5-pro",
      persona: persona || "geral",
      prompt_length: promptLength,
      response_length: responseLength,
      latency_ms: latencyMs,
      tokens_est: totalTokens,
      token_throughput_tps: latencyMs > 0 ? parseFloat((outputTokens / (latencyMs / 1000)).toFixed(2)) : 0,
      context_memory_kb: parseFloat((promptLength / 1024).toFixed(2)),
      created_at: now
    });

    await writeDb(db);
  } catch (err) {
    console.error("Error recording AI usage metrics to SQLite:", err);
  }
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  try {
    const body = await req.json();
    const { messages, personaPrompt, persona, temperature } = body;
    let { model } = body;

    // ── Tenant Isolation: companyId ALWAYS from session, never from body ────────
    const session = getSession(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }
    // Super Admin pode operar no contexto da empresa selecionada no header;
    // demais papéis ficam presos ao próprio tenant. Isso mantém a mensagem da
    // IA no mesmo company_id da mensagem do usuário (gravada via /api/db).
    const isSuperAdmin = session.role === "super_adm";
    const requestedCompanyId = req.headers.get("x-company-id");
    const activeTenantId = isSuperAdmin && requestedCompanyId && requestedCompanyId !== "global"
      ? requestedCompanyId
      : (session.companyId || "comp_zenitus");
    const userRole = session.role;
    const userEmail = session.email;

    const resolved = await resolveAIProvider({
      companyId: activeTenantId,
      userRole,
      userEmail,
      requestedModel: model
    });

    const apiUrl = resolved.apiUrl;
    const activeApiKey = resolved.apiKey;
    model = resolved.model;
    const credentialSource = resolved.credentialSource;

    // Calculate current time & date in Brazil (America/Sao_Paulo)
    const nowBrazil = new Date();
    const dateStr = nowBrazil.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", year: "numeric", month: "long", day: "numeric" });
    const timeStr = nowBrazil.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
    const currentHour = parseInt(nowBrazil.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", hour12: false }), 10);

    let periodOfDay = "Manhã";
    let correctGreeting = "Bom dia";
    if (currentHour >= 12 && currentHour < 18) {
      periodOfDay = "Tarde";
      correctGreeting = "Boa tarde";
    } else if (currentHour >= 18 || currentHour < 5) {
      periodOfDay = "Noite";
      correctGreeting = "Boa noite";
    }

    if (!activeApiKey || activeApiKey.includes("sk-or-v1-master-****")) {
      // Fallback response when key is not yet set
      const lastUserMsg = messages?.[messages.length - 1]?.content || "";
      const lowerMsg = lastUserMsg.toLowerCase();
      let timeCorrectionNotice = "";
      
      if (lowerMsg.includes("bom dia") && (periodOfDay === "Tarde" || periodOfDay === "Noite")) {
        timeCorrectionNotice = `${correctGreeting}! 😄 Notei que você disse "bom dia", mas no relógio do sistema já são ${timeStr} (${periodOfDay.toLowerCase()}).\n\n`;
      } else if (lowerMsg.includes("boa tarde") && (periodOfDay === "Manhã" || periodOfDay === "Noite")) {
        timeCorrectionNotice = `${correctGreeting}! 😄 Notei que você disse "boa tarde", mas no relógio do sistema já são ${timeStr} (${periodOfDay.toLowerCase()}).\n\n`;
      } else if (lowerMsg.includes("boa noite") && (periodOfDay === "Manhã" || periodOfDay === "Tarde")) {
        timeCorrectionNotice = `${correctGreeting}! 😄 Notei que você disse "boa noite", mas no relógio do sistema já são ${timeStr} (${periodOfDay.toLowerCase()}).\n\n`;
      }

      let responseText = `${timeCorrectionNotice}[OmniRoute Local Engine / OpenRouter API - 2026 Model]\n\nResposta processada pelo modelo de ponta ${model || 'Claude 3.7 Sonnet'}.\n\nAnálise para "${lastUserMsg}": Parâmetros tributários e regulatórios verificados para a Zenitus Inteligência Contábil. Insira sua chave real da OpenRouter ou OmniRoute no Painel Super ADM Master para conexões nativas diretas.`;

      if (personaPrompt?.includes("SPED")) {
        responseText = `${timeCorrectionNotice}[OmniRoute Local Engine - ${model || 'SPED & Fiscal'}]\n\nAnálise tributária avançada para "${lastUserMsg}":\n\n1. Enquadramento e Fator R: Cálculo da razão Folha(12m) / Receita Bruta(12m) validado.\n2. Obrigações Acessórias: DCTFWeb, PGDAS-D e EFD-Reinf em conformidade com as Instruções Normativas vigentes no e-CAC.\n3. Recomendação Técnica: Retenção na fonte das contribuições federais conforme IN RFB aplicável.`;
      }

      const durationMs = Date.now() - startTime;
      const promptLen = JSON.stringify(messages || []).length;
      recordChatMetrics(activeTenantId, model, persona || "geral", promptLen, responseText.length, (messages || []).length, durationMs, undefined, credentialSource);

      return new NextResponse(responseText, {
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    // Inject Dynamic System Context, Real-time Clock Awareness, and Formatting Rules
    let systemContextAddon = "\n\n[CONTEXTO TEMPORAL E DATA/HORA ATUAL DO SISTEMA (FUSO AMÉRICA/SÃO PAULO)]\n";
    systemContextAddon += `- Data Atual: ${dateStr}\n`;
    systemContextAddon += `- Hora Atual (Horário de Brasília): ${timeStr}\n`;
    systemContextAddon += `- Período do Dia: ${periodOfDay}\n\n`;

    systemContextAddon += "[DIRETRIZES DE ACESSO E CONTEXTO GLOBAL OMNIZEUS (MULTI-TENANT ISOLADO)]\n";
    systemContextAddon += `Empresa/Tenant ID do Usuário Logado: ${activeTenantId}\n`;
    systemContextAddon += "Você é um agente nativo da plataforma OmniZeus. Você TEM ACESSO VERDADEIRO aos dados sistêmicos deste tenant. NUNCA diga ao usuário que você não tem acesso ou que ele precisa consultar o sistema manualmente:\n";

    try {
      // Read Full SQL Database Context first
      const sqlPath = path.join(process.cwd(), "data", "omnizeus_local_sql_database.json");
      if (fs.existsSync(sqlPath)) {
        const sqlData = JSON.parse(fs.readFileSync(sqlPath, "utf-8"));
        
        // Inject Conta Azul Customers Details (from SQL DB, not old mock)
        const caData = (sqlData.contaazul_clients || []).filter((c: any) => !c.company_id || c.company_id === activeTenantId);
        systemContextAddon += `- BASE DE CLIENTES (CRM / CONTA AZUL): Existem ${caData.length} contatos sincronizados (incluindo prospects, clientes pontuais e clientes ativos):\n`;
        caData.forEach((c: any) => {
          systemContextAddon += `  * ${c.nome || c.name || c.razao_social} (CNPJ/CPF: ${c.cpf_cnpj || c.cnpj}, Optante Simples: ${c.optante_simples ?? c.is_simples ? 'Sim' : 'Não'}, Cidade: ${c.endereco?.cidade || c.address?.city || c.city || 'Não informada'})\n`;
        });
      
        // Tasks
        const tasks = (sqlData.tasks || []).filter((t: any) => !t.company_id || t.company_id === activeTenantId);
        const pendingTasks = tasks.filter((t: any) => t.status === "Pendente" || t.status === "pendente").length;
        systemContextAddon += `- GESTÃO DE TAREFAS: Existem ${pendingTasks} tarefas operacionais pendentes na fila da equipe (Total de ${tasks.length} tarefas cadastradas):\n`;
        tasks.forEach((t: any) => {
          systemContextAddon += `  * [${t.id}] "${t.title}" | Cliente: ${t.client} | Responsável: ${t.assignee} | Prioridade: ${t.priority} | Status: ${t.status} | Tempo gasto: ${t.time_spent_sec || t.timeSpentSec || 0}s\n`;
        });

        // Contracts
        const contracts = (sqlData.contracts || []).filter((ct: any) => !ct.company_id || ct.company_id === activeTenantId);
        systemContextAddon += `- CONTRATOS BPO/CONTÁBIL (CLIENTES RECORRENTES ATIVOS): Apenas ${contracts.length} clientes possuem contrato mensal formalizado:\n`;
        contracts.forEach((ct: any) => {
          systemContextAddon += `  * [${ct.contract_number || ct.contractNumber}] ${ct.client_name || ct.clientName} (CNPJ: ${ct.cnpj}) | Mensalidade: R$ ${(ct.monthly_fee_brl || ct.monthlyFeeBrl)?.toFixed(2)} | Reajuste: ${ct.adjustment_index || ct.adjustmentIndex} em ${ct.next_adjustment_date || ct.nextAdjustmentDate} | Status: ${ct.status}\n`;
        });

        // Payables
        const payablesAll = sqlData.payables || sqlData.payables_list || sqlData.omnizeus_payables_list || [];
        const payables = payablesAll.filter((p: any) => !p.company_id || p.company_id === activeTenantId);
        systemContextAddon += `- CONTAS A PAGAR (PAYABLES): ${payables.length} títulos financeiros cadastrados:\n`;
        payables.forEach((p: any) => {
          systemContextAddon += `  * [${p.id}] ${p.desc || p.description} | Fornecedor: ${p.fornecedor || p.vendor} | Valor: R$ ${(p.valor || p.value_brl)?.toFixed(2)} | Vencimento: ${p.vencimento || p.due_date} | Status: ${p.status}\n`;
        });

        // Purchase Requests
        const reqsAll = sqlData.purchase_requests || [];
        const reqs = reqsAll.filter((r: any) => !r.company_id || r.company_id === activeTenantId);
        if (reqs.length > 0) {
          systemContextAddon += `- SOLICITAÇÕES DE COMPRA: ${reqs.length} requisições cadastradas:\n`;
          reqs.forEach((r: any) => {
            systemContextAddon += `  * [${r.req_number || r.reqNumber}] ${r.description} | Solicitante: ${r.requester_name || r.requesterName} (${r.department}) | Valor: R$ ${(r.value_brl || r.valueBrl)?.toFixed(2)} | Status: ${r.status}\n`;
          });
        }
      }
    } catch (e) {}

    systemContextAddon += "\n[DIRETRIZES DE RESPOSTA E CONVERSAÇÃO MODERNAS (CRÍTICO)]\n";
    systemContextAddon += "1. CONVERSE COMO UM CHAT HUMANO DIRETO E EXECUTIVO: Fale em tom de conversa fluida, natural e amigável. Evite introduções longas como 'A seguir apresento...', 'Com certeza...', 'Certamente...'. Vá direto ao ponto.\n";
    systemContextAddon += "2. RESPOSTAS OBJETIVAS E CONCISAS (150 A 300 PALAVRAS): Por padrão, entregue respostas curtas, organizadas em tópicos ou bullets simples. Evite textos gigantes e explicações óbvias. Só produza respostas longas se o usuário pedir explicitamente ('detalhe', 'explique completo', 'aprofunde', 'gere integralmente').\n";
    systemContextAddon += "3. NUNCA EXIBA JSON BRUTO OU PAYLOADS INTERNOS AO USUÁRIO: Mesmo que sua especialidade envolva slides, dados ou estruturas de código, NUNCA responda com blocos ```json { ... } ``` ou payloads brutos no chat. Responda em linguagem natural amigável para leitura humana.\n";
    systemContextAddon += "4. NÃO UTILIZE NEGRITO COM ASTERISCOS EXCESSIVOS: Use parágrafos limpos e listas com '•' simples.\n";
    systemContextAddon += "5. Sempre apresente valores em R$ (padrão BRL) e percentuais com duas casas decimais.\n";
    systemContextAddon += "6. PROIBIÇÃO DE SAUDAÇÕES (CRÍTICO): Nunca inicie ou termine suas respostas com saudações sociais (Olá, Bom dia, Boa noite, Tudo bem, etc.) nem utilize emojis carinhosos (😊, 😉, 👍). Vá imediatamente e estritamente para a resposta técnica.\n\n";

    systemContextAddon += "[COMPORTAMENTO CONVERSACIONAL E INTENÇÕES (OBRIGATÓRIO)]\n";
    systemContextAddon += "1. VOCÊ É UM AGENTE CONVERSACIONAL. Seu primeiro objetivo é compreender a intenção do usuário. Nunca execute uma ação (como criar tabelas, arquivos, cadastros) apenas porque encontrou uma palavra-chave.\n";
    systemContextAddon += "2. DIFERENCIE PERGUNTAS DE COMANDOS. Se o usuário diz 'pode cadastrar cliente?', isso NÃO significa que ele quer cadastrar imediatamente. É apenas uma pergunta. Você deve responder: 'Claro, posso cadastrar. Me informe Nome, CPF, Email'. Não inicie o cadastro sem ter os dados.\n";
    systemContextAddon += "3. NUNCA INVENTE OU ASSUMA DADOS (nome, email, telefone, cnpj, valor, etc.). Se faltar informação obrigatória para um comando, NÃO gere a saída final. Apenas PERGUNTE ao usuário o que falta.\n";
    systemContextAddon += "4. CONVERSA EM MÚLTIPLAS ETAPAS: Você deve conseguir conduzir um cadastro naturally. Peça um dado de cada vez ou todos os faltantes, lembrando-se do estado da conversa anterior.\n";
    systemContextAddon += "5. SÓ EXECUTE QUANDO POSSUIR TUDO. Antes de tomar a decisão final de acionar uma ação, responda internamente: A intenção está clara? Tenho os dados obrigatórios? Se não, apenas faça perguntas de esclarecimento.\n";

    const finalSystemPrompt = (personaPrompt || "Você é o assistente inteligente de ponta da Zenitus Inteligência Contábil.") + systemContextAddon;
    const systemMessage = { role: "system", content: finalSystemPrompt };

    const apiMessages = [systemMessage, ...(messages || [])];

    const aiRes = await executeAIRequest({
      companyId: activeTenantId,
      userRole,
      userEmail,
      requestedModel: model || "anthropic/claude-3.7-sonnet",
      temperature,
      messages: apiMessages,
      persona: persona,
      featureContext: "Omni IA Hub Chat"
    });

    if (aiRes.isError) {
      return NextResponse.json({ error: aiRes.content }, { status: 500 });
    }

    const textContent = aiRes.content;

    // Débito único dos OmniCoins + registro de uso (fonte única de verdade).
    // O cliente NÃO debita mais — apenas checa saldo e envia. Isso vale tanto
    // para o caminho real quanto para o fallback (que já chama recordChatMetrics).
    const durationMs = Date.now() - startTime;
    const promptLen = JSON.stringify(messages || []).length;
    await recordChatMetrics(
      activeTenantId,
      model,
      persona || "geral",
      promptLen,
      textContent.length,
      (messages || []).length,
      durationMs,
      undefined,
      credentialSource
    );

    // Save directly to DB for true persistence across browser refreshes
    const persistedAiId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const persistedAt = new Date().toISOString();
    if (body.conversationId) {
      try {
        const db = await readDb();
        if (!Array.isArray(db.messages)) db.messages = [];
        db.messages.push({
          id: persistedAiId,
          conversation_id: body.conversationId,
          company_id: activeTenantId,
          sender: 'ai',
          text: textContent,
          model: model || "anthropic/claude-3.7-sonnet",
          created_at: persistedAt
        });
        await writeDb(db);
      } catch (e) {
        console.error("Error saving persistent message:", e);
      }
    }

    return new NextResponse(textContent, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "x-omni-message-id": persistedAiId,
        "x-omni-message-created-at": persistedAt,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
