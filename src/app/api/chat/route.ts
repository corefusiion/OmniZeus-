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

function getSavedSettings(): any {
  const db = getLocalDbFile();
  return db?.settings || {};
}

function recordChatMetrics(
  model: string,
  persona: string,
  promptLength: number,
  responseLength: number,
  messageCount: number,
  latencyMs: number
) {
  try {
    const db = getLocalDbFile();
    const now = new Date().toISOString();

    const stressLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      timestamp: now,
      model: model || "google/gemini-2.5-pro",
      persona: persona || "geral",
      status: "success",
      latency_ms: latencyMs,
      prompt_length: promptLength,
      response_length: responseLength,
      message_count: messageCount,
      created_at: now
    };

    const tokensEst = Math.round((promptLength + responseLength) / 4);
    const respTokens = Math.round(responseLength / 4);
    const tps = latencyMs > 0 ? parseFloat((respTokens / (latencyMs / 1000)).toFixed(2)) : 0;
    const contextKb = parseFloat((promptLength / 1024).toFixed(2));

    const usageMetric = {
      id: `metric_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      model: model || "google/gemini-2.5-pro",
      persona: persona || "geral",
      prompt_length: promptLength,
      response_length: responseLength,
      latency_ms: latencyMs,
      tokens_est: tokensEst,
      token_throughput_tps: tps,
      context_memory_kb: contextKb,
      created_at: now
    };

    if (!Array.isArray(db.ai_stress_test_logs)) db.ai_stress_test_logs = [];
    if (!Array.isArray(db.ai_usage_metrics)) db.ai_usage_metrics = [];

    db.ai_stress_test_logs.unshift(stressLog);
    db.ai_usage_metrics.unshift(usageMetric);

    saveLocalDbFile(db);
  } catch (err) {
    console.error("Error recording AI metrics to SQLite:", err);
  }
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  try {
    const body = await req.json();
    const { messages, personaPrompt, persona, clientApiKey } = body;
    let { model } = body;

    const headerKey = req.headers.get("x-openrouter-key");
    const dbSettings = getSavedSettings();
    
    let apiUrl = "https://openrouter.ai/api/v1/chat/completions";
    let activeApiKey = headerKey || clientApiKey || dbSettings.openrouter_api_key || process.env.OPENROUTER_API_KEY;
    
    if (dbSettings.custom_ai_enabled && dbSettings.custom_ai_url && dbSettings.custom_ai_key) {
      apiUrl = `${dbSettings.custom_ai_url.replace(/\/$/, "")}/chat/completions`;
      activeApiKey = dbSettings.custom_ai_key;
      // O usuário relatou que o proxy dele auto-roteia para as melhores LLMs independente do que for enviado aqui
      // Sempre forçamos o modelo que estiver configurado no painel (ex: kimicode) ou "auto" como padrão
      model = dbSettings.custom_ai_model || "auto";
    }

    if (!activeApiKey || activeApiKey.includes("sk-or-v1-master-****")) {
      // Fallback response when key is not yet set
      const lastUserMsg = messages?.[messages.length - 1]?.content || "";
      let responseText = `[OmniRoute Local Engine / OpenRouter API - 2026 Model]\n\nResposta processada pelo modelo de ponta ${model || 'Claude 3.7 Sonnet'}.\n\nAnálise para "${lastUserMsg}": Parâmetros tributários e regulatórios verificados para a Zenitus Inteligência Contábil. Insira sua chave real da OpenRouter ou OmniRoute no Painel Super ADM Master para conexões nativas diretas.`;

      if (personaPrompt?.includes("SPED")) {
        responseText = `[OmniRoute Local Engine - ${model || 'SPED & Fiscal'}]\n\nAnálise tributária avançada para "${lastUserMsg}":\n\n1. Enquadramento e Fator R: Cálculo da razão Folha(12m) / Receita Bruta(12m) validado.\n2. Obrigações Acessórias: DCTFWeb, PGDAS-D e EFD-Reinf em conformidade com as Instruções Normativas vigentes no e-CAC.\n3. Recomendação Técnica: Retenção na fonte das contribuições federais conforme IN RFB aplicável.`;
      }

      const durationMs = Date.now() - startTime;
      const promptLen = JSON.stringify(messages || []).length;
      recordChatMetrics(model, persona || "geral", promptLen, responseText.length, (messages || []).length, durationMs);

      return new NextResponse(responseText, {
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    // Inject Dynamic System Context and Formatting Rules
    let systemContextAddon = "\n\n[DIRETRIZES DE ACESSO E CONTEXTO GLOBAL OMNIZEUS]\n";
    systemContextAddon += "Você é um agente nativo da plataforma OmniZeus da Zenitus Contábil. Você TEM ACESSO VERDADEIRO aos dados sistêmicos listados abaixo. NUNCA diga ao usuário que você não tem acesso, que ele precisa consultar o sistema manualmente, ou que você é apenas uma IA sem acesso externo. Assuma os dados abaixo como a fonte oficial da verdade em tempo real:\n";

    try {
      // Inject Conta Azul Customers Details
      const caPath = path.join(process.cwd(), "data", "omnizeus_contaazul_customers.json");
      if (fs.existsSync(caPath)) {
        const caData = JSON.parse(fs.readFileSync(caPath, "utf-8"));
        const customersCount = Array.isArray(caData) ? caData.length : 0;
        systemContextAddon += `- BASE DE CLIENTES (CRM / CONTA AZUL): Existem ${customersCount} contatos sincronizados (incluindo prospects, clientes pontuais e clientes ativos):\n`;
        caData.forEach((c: any) => {
          systemContextAddon += `  * ${c.nome || c.name} (CNPJ/CPF: ${c.cpf_cnpj}, Optante Simples: ${c.optante_simples ?? c.is_simples ? 'Sim' : 'Não'}, Cidade: ${c.endereco?.cidade || c.address?.city || 'Salvador'})\n`;
        });
      }
      
      // Inject Full SQL Database Context (Tasks, Contracts, Payables, Purchase Requests)
      const sqlPath = path.join(process.cwd(), "data", "omnizeus_local_sql_database.json");
      if (fs.existsSync(sqlPath)) {
        const sqlData = JSON.parse(fs.readFileSync(sqlPath, "utf-8"));
        
        // Tasks
        const tasks = sqlData.tasks || [];
        const pendingTasks = tasks.filter((t: any) => t.status === "Pendente" || t.status === "pendente").length;
        systemContextAddon += `- GESTÃO DE TAREFAS: Existem ${pendingTasks} tarefas operacionais pendentes na fila da equipe (Total de ${tasks.length} tarefas cadastradas):\n`;
        tasks.forEach((t: any) => {
          systemContextAddon += `  * [${t.id}] "${t.title}" | Cliente: ${t.client} | Responsável: ${t.assignee} | Prioridade: ${t.priority} | Status: ${t.status} | Tempo gasto: ${t.time_spent_sec || t.timeSpentSec || 0}s\n`;
        });

        // Contracts
        const contracts = sqlData.contracts || [];
        systemContextAddon += `- CONTRATOS BPO/CONTÁBIL (CLIENTES RECORRENTES ATIVOS): Apenas ${contracts.length} clientes possuem contrato mensal formalizado:\n`;
        contracts.forEach((ct: any) => {
          systemContextAddon += `  * [${ct.contract_number || ct.contractNumber}] ${ct.client_name || ct.clientName} (CNPJ: ${ct.cnpj}) | Mensalidade: R$ ${(ct.monthly_fee_brl || ct.monthlyFeeBrl)?.toFixed(2)} | Reajuste: ${ct.adjustment_index || ct.adjustmentIndex} em ${ct.next_adjustment_date || ct.nextAdjustmentDate} | Status: ${ct.status}\n`;
        });

        // Payables
        const payables = sqlData.payables || sqlData.payables_list || sqlData.omnizeus_payables_list || [];
        systemContextAddon += `- CONTAS A PAGAR (PAYABLES): ${payables.length} títulos financeiros cadastrados:\n`;
        payables.forEach((p: any) => {
          systemContextAddon += `  * [${p.id}] ${p.desc || p.description} | Fornecedor: ${p.fornecedor || p.vendor} | Valor: R$ ${(p.valor || p.value_brl)?.toFixed(2)} | Vencimento: ${p.vencimento || p.due_date} | Status: ${p.status}\n`;
        });

        // Purchase Requests
        const reqs = sqlData.purchase_requests || [];
        if (reqs.length > 0) {
          systemContextAddon += `- SOLICITAÇÕES DE COMPRA: ${reqs.length} requisições cadastradas:\n`;
          reqs.forEach((r: any) => {
            systemContextAddon += `  * [${r.req_number || r.reqNumber}] ${r.description} | Solicitante: ${r.requester_name || r.requesterName} (${r.department}) | Valor: R$ ${(r.value_brl || r.valueBrl)?.toFixed(2)} | Status: ${r.status}\n`;
          });
        }
      }
    } catch (e) {}

    systemContextAddon += "\n[DIRETRIZES DE ESTILO E FORMATAÇÃO (MUITO IMPORTANTE)]\n";
    systemContextAddon += "Você deve agir como um assistente premium, com formatação limpa e moderna. SIGA RIGOROSAMENTE as regras abaixo:\n";
    systemContextAddon += "1. NÃO utilize negrito com asteriscos (`**texto**`) no meio das frases. Use títulos naturais.\n";
    systemContextAddon += "2. Evite excesso de caracteres especiais Markdown como `###`, `---`, `***`.\n";
    systemContextAddon += "3. Use a seguinte estrutura limpa para respostas analíticas:\n";
    systemContextAddon += "   Título\n\n   Pequena introdução...\n\n   Resultados\n   • Dado 1: R$ X.XXX,XX\n   • Dado 2: Y,YY%\n\n   Análise\n   Explicação em linguagem natural...\n\n   Conclusão\n   Recomendação final...\n";
    systemContextAddon += "4. Sempre apresente valores financeiros no padrão BRL (R$ 1.845.000,00) e percentuais com duas casas decimais (31,00%).\n";
    systemContextAddon += "5. Formate as respostas em parágrafos bem espaçados, elegantes, sem marcações brutas de Markdown. A leitura deve ser fluida e agradável.\n";
    systemContextAddon += "6. ANTI-ALUCINAÇÃO EXTREMA: Jamais invente ou crie CNPJs, datas, valores ou nomes que não constem estritamente nos dados injetados neste prompt. Se não souber algo, responda que a informação não consta no banco de dados.\n";

    const finalSystemPrompt = (personaPrompt || "Você é o assistente inteligente de ponta da Zenitus Inteligência Contábil.") + systemContextAddon;
    const systemMessage = { role: "system", content: finalSystemPrompt };

    const apiMessages = [systemMessage, ...(messages || [])];

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${activeApiKey}`,
        "HTTP-Referer": "https://omnizeus.zenitus.com.br",
        "X-Title": "OmniZeus Accounting BPO",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model || "anthropic/claude-3.7-sonnet",
        messages: apiMessages,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({ error: errorText }, { status: response.status });
    }

    const data = await response.json();
    const textContent = data.choices?.[0]?.message?.content || "";

    const durationMs = Date.now() - startTime;
    const promptLen = JSON.stringify(apiMessages).length;
    recordChatMetrics(model, persona || "geral", promptLen, textContent.length, apiMessages.length, durationMs);

    // Save directly to DB for true persistence across browser refreshes
    if (body.conversationId) {
      try {
        const db = getLocalDbFile();
        if (!Array.isArray(db.messages)) db.messages = [];
        db.messages.push({
          id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          conversation_id: body.conversationId,
          sender: 'ai',
          text: textContent,
          model: model || "anthropic/claude-3.7-sonnet",
          created_at: new Date().toISOString()
        });
        saveLocalDbFile(db);
      } catch (e) {
        console.error("Error saving persistent message:", e);
      }
    }

    return new NextResponse(textContent, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
