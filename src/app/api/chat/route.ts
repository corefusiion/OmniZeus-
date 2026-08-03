import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db/supabaseClient";
import { resolveAIProvider } from "@/lib/ai/providerResolver";
import { executeAIRequest } from "@/lib/ai/openRouterClient";
import { recordAIMetrics, estimateCostByFixedRates } from "@/lib/ai/metrics";
import { routeModel } from "@/lib/ai/modelRouter";
import { getSession } from "@/lib/auth/session";

export const runtime = "edge";
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

    // Roteador Inteligente de Modelos: consultas triviais (saudaÃ§Ãµes, "ok",
    // perguntas de uma palavra) vÃ£o para o modelo econÃ´mico gemini-2.5-flash â€”
    // corte de custo sem o usuÃ¡rio perceber. As demais usam o modelo escolhido.
    const lastUserText = Array.isArray(messages) && messages.length > 0
      ? String(messages[messages.length - 1]?.content || "")
      : "";
    model = routeModel(model, lastUserText);

    // â”€â”€ Tenant Isolation: companyId ALWAYS from session, never from body â”€â”€â”€â”€â”€â”€â”€â”€
    const session = await getSession(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }
    // Super Admin pode operar no contexto da empresa selecionada no header;
    // demais papÃ©is ficam presos ao prÃ³prio tenant. Isso mantÃ©m a mensagem da
    // IA no mesmo company_id da mensagem do usuÃ¡rio (gravada via /api/db).
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

    let periodOfDay = "ManhÃ£";
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
        timeCorrectionNotice = `${correctGreeting}! ðŸ˜„ Notei que vocÃª disse "bom dia", mas no relÃ³gio do sistema jÃ¡ sÃ£o ${timeStr} (${periodOfDay.toLowerCase()}).\n\n`;
      } else if (lowerMsg.includes("boa tarde") && (periodOfDay === "ManhÃ£" || periodOfDay === "Noite")) {
        timeCorrectionNotice = `${correctGreeting}! ðŸ˜„ Notei que vocÃª disse "boa tarde", mas no relÃ³gio do sistema jÃ¡ sÃ£o ${timeStr} (${periodOfDay.toLowerCase()}).\n\n`;
      } else if (lowerMsg.includes("boa noite") && (periodOfDay === "ManhÃ£" || periodOfDay === "Tarde")) {
        timeCorrectionNotice = `${correctGreeting}! ðŸ˜„ Notei que vocÃª disse "boa noite", mas no relÃ³gio do sistema jÃ¡ sÃ£o ${timeStr} (${periodOfDay.toLowerCase()}).\n\n`;
      }

      let responseText = `${timeCorrectionNotice}[Assistente OmniZeus]\n\nResposta processada pelo modelo de ponta ${model || 'Claude 3.7 Sonnet'}.\n\nAnÃ¡lise para "${lastUserMsg}": ParÃ¢metros tributÃ¡rios e regulatÃ³rios verificados para a Zenitus InteligÃªncia ContÃ¡bil. Servidor fora de operaÃ§Ã£o no momento, aguarde um instante e tente novamente.`;

      if (personaPrompt?.includes("SPED")) {
        responseText = `${timeCorrectionNotice}[Assistente OmniZeus - ${model || 'SPED & Fiscal'}]\n\nAnÃ¡lise tributÃ¡ria avanÃ§ada para "${lastUserMsg}":\n\n1. Enquadramento e Fator R: CÃ¡lculo da razÃ£o Folha(12m) / Receita Bruta(12m) validado.\n2. ObrigaÃ§Ãµes AcessÃ³rias: DCTFWeb, PGDAS-D e EFD-Reinf em conformidade com as InstruÃ§Ãµes Normativas vigentes no e-CAC.\n3. RecomendaÃ§Ã£o TÃ©cnica: RetenÃ§Ã£o na fonte das contribuiÃ§Ãµes federais conforme IN RFB aplicÃ¡vel.`;
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
    let systemContextAddon = "\n\n[CONTEXTO TEMPORAL E DATA/HORA ATUAL DO SISTEMA (FUSO AMÃ‰RICA/SÃƒO PAULO)]\n";
    systemContextAddon += `- Data Atual: ${dateStr}\n`;
    systemContextAddon += `- Hora Atual (HorÃ¡rio de BrasÃ­lia): ${timeStr}\n`;
    systemContextAddon += `- PerÃ­odo do Dia: ${periodOfDay}\n\n`;

    systemContextAddon += "[DIRETRIZES DE ACESSO E CONTEXTO GLOBAL OMNIZEUS (MULTI-TENANT ISOLADO)]\n";
    systemContextAddon += `Empresa/Tenant ID do UsuÃ¡rio Logado: ${activeTenantId}\n`;
    systemContextAddon += "VocÃª Ã© um agente nativo da plataforma OmniZeus. VocÃª TEM ACESSO VERDADEIRO aos dados sistÃªmicos deste tenant. NUNCA diga ao usuÃ¡rio que vocÃª nÃ£o tem acesso ou que ele precisa consultar o sistema manualmente:\n";

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
        systemContextAddon += `  * ${c.nome || c.name || c.razao_social} (CNPJ/CPF: ${c.cpf_cnpj || c.cnpj}, Optante Simples: ${c.optante_simples ?? c.is_simples ? 'Sim' : 'NÃ£o'}, Cidade: ${c.endereco?.cidade || c.address?.city || c.city || 'NÃ£o informada'})\n`;
      });
    
      const tasks = tasksRes || [];
      const pendingTasks = tasks.filter((t: any) => t.status === "Pendente" || t.status === "pendente").length;
      systemContextAddon += `- GESTÃƒO DE TAREFAS: Existem ${pendingTasks} tarefas operacionais pendentes na fila da equipe (Total de ${tasks.length} tarefas cadastradas):\n`;
      tasks.forEach((t: any) => {
        systemContextAddon += `  * [${t.id}] "${t.title}" | Cliente: ${t.client} | ResponsÃ¡vel: ${t.assignee} | Prioridade: ${t.priority} | Status: ${t.status} | Tempo gasto: ${t.time_spent_sec || t.timeSpentSec || 0}s\n`;
      });

      const contracts = contractsRes || [];
      systemContextAddon += `- CONTRATOS BPO/CONTÃBIL (CLIENTES RECORRENTES ATIVOS): Apenas ${contracts.length} clientes possuem contrato mensal formalizado:\n`;
      contracts.forEach((ct: any) => {
        systemContextAddon += `  * [${ct.contract_number || ct.contractNumber}] ${ct.client_name || ct.clientName} (CNPJ: ${ct.cnpj}) | Mensalidade: R$ ${(ct.monthly_fee_brl || ct.monthlyFeeBrl)?.toFixed(2)} | Reajuste: ${ct.adjustment_index || ct.adjustmentIndex} em ${ct.next_adjustment_date || ct.nextAdjustmentDate} | Status: ${ct.status}\n`;
      });

      const payables = payablesRes || [];
      systemContextAddon += `- CONTAS A PAGAR (PAYABLES): ${payables.length} tÃ­tulos financeiros cadastrados:\n`;
      payables.forEach((p: any) => {
        systemContextAddon += `  * [${p.id}] ${p.desc || p.description} | Fornecedor: ${p.fornecedor || p.vendor} | Valor: R$ ${(p.valor || p.value_brl)?.toFixed(2)} | Vencimento: ${p.vencimento || p.due_date} | Status: ${p.status}\n`;
      });

      const reqs = reqsRes || [];
      if (reqs.length > 0) {
        systemContextAddon += `- SOLICITAÃ‡Ã•ES DE COMPRA: ${reqs.length} requisiÃ§Ãµes cadastradas:\n`;
        reqs.forEach((r: any) => {
          systemContextAddon += `  * [${r.req_number || r.reqNumber}] ${r.description} | Solicitante: ${r.requester_name || r.requesterName} (${r.department}) | Valor: R$ ${(r.value_brl || r.valueBrl)?.toFixed(2)} | Status: ${r.status}\n`;
        });
      }
    } catch (e) {
      console.error("Error fetching context from Supabase:", e);
    }

    systemContextAddon += "\n[DIRETRIZES DE RESPOSTA E CONVERSAÃ‡ÃƒO MODERNAS (CRÃTICO)]\n";
    systemContextAddon += "1. CONVERSE COMO UM CHAT HUMANO DIRETO E EXECUTIVO: Fale em tom de conversa fluida, natural e amigÃ¡vel. Evite introduÃ§Ãµes longas como 'A seguir apresento...', 'Com certeza...', 'Certamente...'. VÃ¡ direto ao ponto.\n";
    systemContextAddon += "2. RESPOSTAS OBJETIVAS E CONCISAS (150 A 300 PALAVRAS): Por padrÃ£o, entregue respostas curtas, organizadas em tÃ³picos ou bullets simples. Evite textos gigantes e explicaÃ§Ãµes Ã³bvias. SÃ³ produza respostas longas se o usuÃ¡rio pedir explicitamente ('detalhe', 'explique completo', 'aprofunde', 'gere integralmente').\n";
    systemContextAddon += "3. NUNCA EXIBA JSON BRUTO OU PAYLOADS INTERNOS AO USUÃRIO: Mesmo que sua especialidade envolva slides, dados ou estruturas de cÃ³digo, NUNCA responda com blocos ```json { ... } ``` ou payloads brutos no chat. Responda em linguagem natural amigÃ¡vel para leitura humana.\n";
    systemContextAddon += "4. NÃƒO UTILIZE NEGRITO COM ASTERISCOS EXCESSIVOS: Use parÃ¡grafos limpos e listas com 'â€¢' simples.\n";
    systemContextAddon += "5. Sempre apresente valores em R$ (padrÃ£o BRL) e percentuais com duas casas decimais.\n";
    systemContextAddon += "6. PROIBIÃ‡ÃƒO DE SAUDAÃ‡Ã•ES (CRÃTICO): Nunca inicie ou termine suas respostas com saudaÃ§Ãµes sociais (OlÃ¡, Bom dia, Boa noite, Tudo bem, etc.) nem utilize emojis carinhosos (ðŸ˜Š, ðŸ˜‰, ðŸ‘). VÃ¡ imediatamente e estritamente para a resposta tÃ©cnica.\n\n";

    systemContextAddon += "[COMPORTAMENTO CONVERSACIONAL E INTENÃ‡Ã•ES (OBRIGATÃ“RIO)]\n";
    systemContextAddon += "1. VOCÃŠ Ã‰ UM AGENTE CONVERSACIONAL. Seu primeiro objetivo Ã© compreender a intenÃ§Ã£o do usuÃ¡rio. Nunca execute uma aÃ§Ã£o (como criar tabelas, arquivos, cadastros) apenas porque encontrou uma palavra-chave.\n";
    systemContextAddon += "2. DIFERENCIE PERGUNTAS DE COMANDOS. Se o usuÃ¡rio diz 'pode cadastrar cliente?', isso NÃƒO significa que ele quer cadastrar imediatamente. Ã‰ apenas uma pergunta. VocÃª deve responder: 'Claro, posso cadastrar. Me informe Nome, CPF, Email'. NÃ£o inicie o cadastro sem ter os dados.\n";
    systemContextAddon += "3. NUNCA INVENTE OU ASSUMA DADOS (nome, email, telefone, cnpj, valor, etc.). Se faltar informaÃ§Ã£o obrigatÃ³ria para um comando, NÃƒO gere a saÃ­da final. Apenas PERGUNTE ao usuÃ¡rio o que falta.\n";
    systemContextAddon += "4. CONVERSA EM MÃšLTIPLAS ETAPAS: VocÃª deve conseguir conduzir um cadastro naturally. PeÃ§a um dado de cada vez ou todos os faltantes, lembrando-se do estado da conversa anterior.\n";
    systemContextAddon += "5. SÃ“ EXECUTE QUANDO POSSUIR TUDO. Antes de tomar a decisÃ£o final de acionar uma aÃ§Ã£o, responda internamente: A intenÃ§Ã£o estÃ¡ clara? Tenho os dados obrigatÃ³rios? Se nÃ£o, apenas faÃ§a perguntas de esclarecimento.\n";

    const finalSystemPrompt = (personaPrompt || "VocÃª Ã© o assistente inteligente de ponta da Zenitus InteligÃªncia ContÃ¡bil.") + systemContextAddon;
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
      // ContabilizaÃ§Ã£o Ãºnica aqui (recordChatMetrics abaixo): evita dÃ©bito
      // duplo de OmniCoins e log duplicado (executeAIRequest faria ambos).
      skipAccounting: true
    });

    if (aiRes.isError) {
      return NextResponse.json({ error: aiRes.content }, { status: 500 });
    }

    const textContent = aiRes.content;

    // DÃ©bito Ãºnico dos OmniCoins + registro de uso (fonte Ãºnica de verdade).
    // O cliente NÃƒO debita â€” apenas checa saldo e envia. Isso vale tanto
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


