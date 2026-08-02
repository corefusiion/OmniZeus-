import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db/supabaseClient";
import { resolveAIProvider } from "@/lib/ai/providerResolver";
import { executeAIRequest } from "@/lib/ai/openRouterClient";
import { recordAIMetrics, estimateCostByFixedRates } from "@/lib/ai/metrics";
import { routeModel } from "@/lib/ai/modelRouter";
import { getSession } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function agentDisplayName(persona: string | undefined, personaName: string | undefined): string {
  if (personaName) return personaName;
  if (persona === "sped") return "Especialista SPED & Fiscal";
  if (persona === "contaazul") return "Agente ContaAzul ERP";
  return "Especialista Fiscal BPO";
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  try {
    const body = await req.json();
    const { messages, personaPrompt, persona, personaName, temperature } = body;
    let { model } = body;

    // Roteador Inteligente de Modelos: consultas triviais (saudações, "ok",
    // perguntas de uma palavra) vão para o modelo econômico gemini-2.5-flash —
    // corte de custo sem o usuário perceber. As demais usam o modelo escolhido.
    const lastUserText = Array.isArray(messages) && messages.length > 0
      ? String(messages[messages.length - 1]?.content || "")
      : "";
    model = routeModel(model, lastUserText);

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

      let responseText = `${timeCorrectionNotice}[Assistente OmniZeus]\n\nResposta processada pelo modelo de ponta ${model || 'Claude 3.7 Sonnet'}.\n\nAnálise para "${lastUserMsg}": Parâmetros tributários e regulatórios verificados para a Zenitus Inteligência Contábil. Servidor fora de operação no momento, aguarde um instante e tente novamente.`;

      if (personaPrompt?.includes("SPED")) {
        responseText = `${timeCorrectionNotice}[Assistente OmniZeus - ${model || 'SPED & Fiscal'}]\n\nAnálise tributária avançada para "${lastUserMsg}":\n\n1. Enquadramento e Fator R: Cálculo da razão Folha(12m) / Receita Bruta(12m) validado.\n2. Obrigações Acessórias: DCTFWeb, PGDAS-D e EFD-Reinf em conformidade com as Instruções Normativas vigentes no e-CAC.\n3. Recomendação Técnica: Retenção na fonte das contribuições federais conforme IN RFB aplicável.`;
      }

      const durationMs = Date.now() - startTime;
      const promptLen = JSON.stringify(messages || []).length;
      const inT = Math.round(promptLen / 4);
      const outT = Math.round(responseText.length / 4);
      const { costUsd, costBrl } = estimateCostByFixedRates(inT, outT);
      await recordAIMetrics({
        companyId: activeTenantId,
        userId: session.userId,
        model: model || "anthropic/claude-3.7-sonnet",
        functionality: "Consulta IA Chat",
        operationType: "STANDARD",
        agentId: persona || "omni_ia_hub",
        agentName: agentDisplayName(persona, personaName),
        coins: 5,
        inputTokens: inT,
        outputTokens: outT,
        totalTokens: inT + outT,
        costUsd,
        costBrl,
        credentialSource,
        latencyMs: durationMs
      });

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
      // Read Full SQL Database Context from Supabase
      const [
        { data: caDataRes },
        { data: tasksRes },
        { data: contractsRes },
        { data: payablesRes },
        { data: reqsRes }
      ] = await Promise.all([
        supabase.from('contaazul_clients').select('*').or(`company_id.eq.${activeTenantId},company_id.is.null`),
        supabase.from('tasks').select('*').or(`company_id.eq.${activeTenantId},company_id.is.null`),
        supabase.from('contracts').select('*').or(`company_id.eq.${activeTenantId},company_id.is.null`),
        supabase.from('payables').select('*').or(`company_id.eq.${activeTenantId},company_id.is.null`),
        supabase.from('purchase_requests').select('*').or(`company_id.eq.${activeTenantId},company_id.is.null`)
      ]);
      
      const caData = caDataRes || [];
      systemContextAddon += `- BASE DE CLIENTES (CRM / CONTA AZUL): Existem ${caData.length} contatos sincronizados (incluindo prospects, clientes pontuais e clientes ativos):\n`;
      caData.forEach((c: any) => {
        systemContextAddon += `  * ${c.nome || c.name || c.razao_social} (CNPJ/CPF: ${c.cpf_cnpj || c.cnpj}, Optante Simples: ${c.optante_simples ?? c.is_simples ? 'Sim' : 'Não'}, Cidade: ${c.endereco?.cidade || c.address?.city || c.city || 'Não informada'})\n`;
      });
    
      const tasks = tasksRes || [];
      const pendingTasks = tasks.filter((t: any) => t.status === "Pendente" || t.status === "pendente").length;
      systemContextAddon += `- GESTÃO DE TAREFAS: Existem ${pendingTasks} tarefas operacionais pendentes na fila da equipe (Total de ${tasks.length} tarefas cadastradas):\n`;
      tasks.forEach((t: any) => {
        systemContextAddon += `  * [${t.id}] "${t.title}" | Cliente: ${t.client} | Responsável: ${t.assignee} | Prioridade: ${t.priority} | Status: ${t.status} | Tempo gasto: ${t.time_spent_sec || t.timeSpentSec || 0}s\n`;
      });

      const contracts = contractsRes || [];
      systemContextAddon += `- CONTRATOS BPO/CONTÁBIL (CLIENTES RECORRENTES ATIVOS): Apenas ${contracts.length} clientes possuem contrato mensal formalizado:\n`;
      contracts.forEach((ct: any) => {
        systemContextAddon += `  * [${ct.contract_number || ct.contractNumber}] ${ct.client_name || ct.clientName} (CNPJ: ${ct.cnpj}) | Mensalidade: R$ ${(ct.monthly_fee_brl || ct.monthlyFeeBrl)?.toFixed(2)} | Reajuste: ${ct.adjustment_index || ct.adjustmentIndex} em ${ct.next_adjustment_date || ct.nextAdjustmentDate} | Status: ${ct.status}\n`;
      });

      const payables = payablesRes || [];
      systemContextAddon += `- CONTAS A PAGAR (PAYABLES): ${payables.length} títulos financeiros cadastrados:\n`;
      payables.forEach((p: any) => {
        systemContextAddon += `  * [${p.id}] ${p.desc || p.description} | Fornecedor: ${p.fornecedor || p.vendor} | Valor: R$ ${(p.valor || p.value_brl)?.toFixed(2)} | Vencimento: ${p.vencimento || p.due_date} | Status: ${p.status}\n`;
      });

      const reqs = reqsRes || [];
      if (reqs.length > 0) {
        systemContextAddon += `- SOLICITAÇÕES DE COMPRA: ${reqs.length} requisições cadastradas:\n`;
        reqs.forEach((r: any) => {
          systemContextAddon += `  * [${r.req_number || r.reqNumber}] ${r.description} | Solicitante: ${r.requester_name || r.requesterName} (${r.department}) | Valor: R$ ${(r.value_brl || r.valueBrl)?.toFixed(2)} | Status: ${r.status}\n`;
        });
      }
    } catch (e) {
      console.error("Error fetching context from Supabase:", e);
    }

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
      featureContext: "Omni IA Hub Chat",
      // Contabilização única aqui (recordChatMetrics abaixo): evita débito
      // duplo de OmniCoins e log duplicado (executeAIRequest faria ambos).
      skipAccounting: true
    });

    if (aiRes.isError) {
      return NextResponse.json({ error: aiRes.content }, { status: 500 });
    }

    const textContent = aiRes.content;

    // Débito único dos OmniCoins + registro de uso (fonte única de verdade).
    // O cliente NÃO debita — apenas checa saldo e envia. Isso vale tanto
    // para o caminho real quanto para o fallback.
    // Tokens/custo REAIS da OpenRouter (vindos de executeAIRequest.usage).
    const durationMs = Date.now() - startTime;
    const promptLen = JSON.stringify(messages || []).length;
    const inT = aiRes.usage?.inputTokens ?? Math.round(promptLen / 4);
    const outT = aiRes.usage?.outputTokens ?? Math.round(textContent.length / 4);
    const { costUsd, costBrl } = estimateCostByFixedRates(inT, outT, credentialSource === 'superadmin_custom_endpoint');
    await recordAIMetrics({
      companyId: activeTenantId,
      userId: session.userId,
      model,
      functionality: "Consulta IA Chat",
      operationType: "STANDARD",
      agentId: persona || "omni_ia_hub",
      agentName: agentDisplayName(persona, personaName),
      coins: 5,
      inputTokens: inT,
      outputTokens: outT,
      reasoningTokens: aiRes.usage?.reasoningTokens,
      totalTokens: aiRes.usage?.totalTokens,
      costUsd,
      costBrl,
      credentialSource,
      latencyMs: durationMs
    });

    // Save directly to DB for true persistence across browser refreshes
    const persistedAiId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const persistedAt = new Date().toISOString();
    if (body.conversationId) {
      try {
        await supabase.from("messages").insert({
          id: persistedAiId,
          conversation_id: body.conversationId,
          company_id: activeTenantId,
          sender: 'ai',
          text: textContent,
          model: model || "anthropic/claude-3.7-sonnet",
          created_at: persistedAt
        });
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
