import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE_PATH = path.join(DATA_DIR, "omnizeus_local_sql_database.json");

function getLocalDbFile(): any {
  try {
    if (fs.existsSync(DB_FILE_PATH)) {
      return JSON.parse(fs.readFileSync(DB_FILE_PATH, "utf-8"));
    }
  } catch (e) {}
  return {};
}

function saveLocalDbFile(db: any): void {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(db, null, 2), "utf-8");
  } catch (err) {
    console.error("[IA-Workspace] Erro ao salvar DB local:", err);
  }
}

function getSavedSettings(): any {
  const db = getLocalDbFile();
  return db?.settings || {};
}

/**
 * Clean JSON output from LLM Markdown Code Fences
 */
function cleanAndParseJson(rawContent: string): any {
  if (!rawContent) return null;
  let text = rawContent.trim();

  // Strip ```json and ``` code block wrappers
  if (text.startsWith("```json")) text = text.slice(7);
  if (text.startsWith("```")) text = text.slice(3);
  if (text.endsWith("```")) text = text.slice(0, -3);
  text = text.trim();

  // Attempt direct JSON parse
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object") return parsed;
  } catch (e) {}

  // Attempt regex extraction of first JSON object
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed && typeof parsed === "object") return parsed;
    } catch (e) {}
  }

  return null;
}

/**
 * Motor Local de Respostas Baseado nos Dados Reais Sincronizados do ContaAzul
 */
function generateLocalEngineResponse(prompt: string): any {
  const db = getLocalDbFile();
  const lower = prompt.toLowerCase();

  const clients = db.contaazul_clients || [];
  const suppliers = db.contaazul_suppliers || [];
  const entries = db.contaazul_entries || [];
  const categories = db.contaazul_categories || [];

  // 0. Interceptar Ações de Cadastro (CREATE)
  if (lower.includes("cadastrar") || lower.includes("crie") || lower.includes("criar") || lower.includes("novo cliente") || lower.includes("novo fornecedor")) {
    
    if (lower.includes("cliente") || lower.includes("supermercado")) {
      // Tentar extrair CNPJ e Email do texto
      const cnpjMatch = prompt.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/) || [""];
      const emailMatch = prompt.match(/[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}/) || [""];
      
      return {
        message: "Encontrei os dados para o cadastro deste novo cliente. Por favor, confira as informações abaixo e aprove a sincronização com o ContaAzul:",
        actions: [
          {
            id: `act_${Date.now()}`,
            type: "CREATE_CLIENT",
            label: "Novo Cliente ERP",
            description: "Sincronização de cliente para a base do ContaAzul",
            status: "pending",
            requiresConfirmation: true,
            data: {
              nome: prompt.replace(/.*chamado /i, '').split(',')[0].trim() || "Novo Cliente",
              documento: cnpjMatch[0] || "Não informado",
              email: emailMatch[0] || "Não informado",
              telefone: "(00) 00000-0000"
            }
          }
        ]
      };
    }
  }

  // 1. Consulta de Gráfico / Infográfico / Contas a Pagar
  if (lower.includes("gráfico") || lower.includes("grafico") || lower.includes("infográfico") || lower.includes("infograficos") || lower.includes("contas a pagar")) {
    if (entries.length === 0) {
      return {
        message: `PANORAMA DO ERP CONTAAZUL DO SEU CLIENTE

Não encontrei nenhum título financeiro ou conta a pagar sincronizada no ERP ContaAzul para este período.
O saldo atual de previsões pendentes no ERP está zerado (R$ 0,00).

*(Nota: Importe dados ou aguarde a sincronização oficial do ContaAzul para visualizar gráficos e métricas).*`,
        actions: []
      };
    }

    // Se houver dados reais, agrupamos dinamicamente (lógica base para dados reais):
    const pendentes = entries.filter((p: any) => String(p.status || "").toLowerCase().includes("pendente"));
    let totalPendente = pendentes.reduce((sum: number, p: any) => sum + (Number(p.amount || p.value) || 0), 0);

    const rows = entries.map((e: any) => ({
      categoria: e.categoryName || e.description || "Sem Categoria",
      dreLine: e.dreLine || "Não classificado",
      valor: Number(e.amount || e.value || 0),
      percentual: totalPendente > 0 ? `${Math.round(((Number(e.amount || e.value || 0)) / totalPendente) * 100)}%` : "0%",
      status: e.status || "Pendente"
    }));

    return {
      message: `PANORAMA DO ERP CONTAAZUL DO SEU CLIENTE

O valor total previsto de Contas a Pagar importado do ContaAzul para o período consultado é de ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalPendente)}. 
*(Nota: Estes são dados isolados do ERP do seu cliente).*

Confira abaixo o infográfico visual com o balanço de despesas do ERP e a tabela detalhada:`,
      chart: {
        title: "Distribuição das Despesas Por Categoria (ERP)",
        totalPayable: totalPendente,
        totalReceivable: 0,
        netBalance: 0 - totalPendente,
        items: rows.map(r => ({ label: r.categoria, value: r.valor, percentage: parseInt(r.percentual) }))
      },
      table: {
        columns: [
          { key: "categoria", label: "Categoria de Despesa", sortable: true, type: "text" },
          { key: "dreLine", label: "Linha DRE", sortable: true, type: "text" },
          { key: "valor", label: "Valor (R$)", sortable: true, type: "currency" },
          { key: "percentual", label: "% do Total", sortable: true, type: "badge" },
          { key: "status", label: "Status", sortable: true, type: "status" }
        ],
        rows,
        totalRows: rows.length,
        exportable: true
      },
      actions: []
    };
  }

  // 2. Consulta de Clientes
  if (lower.includes("cliente") || lower.includes("quantos clientes") || lower.includes("listar clientes")) {
    if (clients.length === 0) {
      return { message: "Não encontrei nenhum cliente sincronizado na sua base do ContaAzul ERP no momento." };
    }

    const rows = clients.map((c: any) => ({
      nome: c.nome || c.name || "Sem nome",
      documento: c.cpf_cnpj || c.documento || c.cnpj || "Não informado",
      email: c.email || "Não informado",
      telefone: c.telefone || "Não informado",
      status: c.ativo !== false ? "Ativo" : "Inativo"
    }));

    return {
      message: `Encontrei ${clients.length} clientes cadastrados na sua base do ContaAzul ERP. Confira os detalhes na tabela abaixo:`,
      table: {
        columns: [
          { key: "nome", label: "Nome / Razão Social", sortable: true, type: "text" },
          { key: "documento", label: "CNPJ / CPF", sortable: true, type: "text" },
          { key: "email", label: "E-mail", sortable: true, type: "text" },
          { key: "telefone", label: "Telefone", type: "text" },
          { key: "status", label: "Status", sortable: true, type: "status" }
        ],
        rows,
        totalRows: clients.length,
        exportable: true
      },
      actions: [],
      dashboardUpdate: { metric: "clientes", value: clients.length }
    };
  }

  // 3. Consulta de Fornecedores
  if (lower.includes("fornecedor") || lower.includes("fornecedores")) {
    if (suppliers.length === 0) {
      return { message: "Não encontrei nenhum fornecedor sincronizado na base do ERP ContaAzul no momento." };
    }

    const rows = suppliers.map((s: any) => ({
      nome: s.nome || s.name || "Sem nome",
      documento: s.cpf_cnpj || s.documento || "Não informado",
      email: s.email || "Não informado",
      tipo: s.tipo_pessoa || "Jurídica"
    }));

    return {
      message: `Localizei ${suppliers.length} fornecedores na base ContaAzul:`,
      table: {
        columns: [
          { key: "nome", label: "Nome do Fornecedor", sortable: true, type: "text" },
          { key: "documento", label: "CNPJ / CPF", sortable: true, type: "text" },
          { key: "email", label: "E-mail", sortable: true, type: "text" },
          { key: "tipo", label: "Tipo", type: "badge" }
        ],
        rows,
        totalRows: suppliers.length,
        exportable: true
      },
      actions: [],
      dashboardUpdate: { metric: "fornecedores", value: suppliers.length }
    };
  }

  // 4. Plano de Contas / Categorias e DRE
  if (lower.includes("plano de contas") || lower.includes("categoria") || lower.includes("dre")) {
    if (categories.length === 0) {
      return { message: "Nenhuma categoria ou mapeamento de DRE foi encontrado na base do ContaAzul ERP." };
    }

    const rows = categories.map((cat: any) => ({
      categoria: cat.categoryName || "Sem Nome",
      tipo: cat.type || "DESPESA",
      dreLine: cat.dreLine || "Não Mapeado"
    }));

    return {
      message: `Plano de Contas DRE Sincronizado do ContaAzul. Total de ${categories.length} categorias identificadas:`,
      table: {
        columns: [
          { key: "categoria", label: "Categoria ContaAzul", sortable: true, type: "text" },
          { key: "tipo", label: "Natureza", sortable: true, type: "badge" },
          { key: "dreLine", label: "Mapeamento DRE (OmniZeus)", sortable: true, type: "text" }
        ],
        rows,
        totalRows: categories.length,
        exportable: true
      },
      actions: [],
      dashboardUpdate: { metric: "categorias", value: categories.length }
    };
  }

  // 5. Resumo de Despesas / Lançamentos
  if (lower.includes("resumo") || lower.includes("despesa") || lower.includes("agosto") || lower.includes("lançamento") || lower.includes("lancamento")) {
    if (entries.length === 0) {
      return {
        message: `RESUMO EXECUTIVO DE DESPESAS

Não há despesas ou lançamentos sincronizados no ERP ContaAzul para este período.
*(Status da Base: 0 lançamentos encontrados).*`
      };
    }

    const pendentes = entries.filter((p: any) => String(p.status || "").toLowerCase().includes("pendente"));
    let totalPendente = pendentes.reduce((sum: number, p: any) => sum + (Number(p.amount || p.value) || 0), 0);

    const rows = entries.map((e: any) => ({
      categoria: e.categoryName || e.description || "Sem Categoria",
      dreLine: e.dreLine || "Não classificado",
      valor: Number(e.amount || e.value || 0),
      percentual: totalPendente > 0 ? `${Math.round(((Number(e.amount || e.value || 0)) / totalPendente) * 100)}%` : "0%",
      status: e.status || "Pendente"
    }));

    return {
      message: `RESUMO EXECUTIVO DE DESPESAS

• Total de Despesas Registradas: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalPendente)}
• Status da Base: ${entries.length} lançamentos encontrados

Confira a composição detalhada na tabela paginada abaixo:`,
      table: {
        columns: [
          { key: "categoria", label: "Categoria de Despesa", sortable: true, type: "text" },
          { key: "dreLine", label: "Linha DRE", sortable: true, type: "text" },
          { key: "valor", label: "Valor (R$)", sortable: true, type: "currency" },
          { key: "percentual", label: "% do Total", sortable: true, type: "badge" },
          { key: "status", label: "Status", sortable: true, type: "status" }
        ],
        rows,
        totalRows: rows.length,
        exportable: true
      },
      actions: [],
      dashboardUpdate: { metric: "lancamentos", value: rows.length }
    };
  }

  // 5. Categorias / DRE
  if (lower.includes("categoria") || lower.includes("dre") || lower.includes("plano de conta")) {
    const rows = categories.map((c: any) => ({
      categoria: c.categoryName || c.nome || c.name || "Sem nome",
      tipo: c.type || c.tipo || "RECEITA",
      dreLine: c.dreLine || "Não mapeado"
    }));

    return {
      message: `Encontrei ${categories.length} categorias no seu Plano de Contas mapeado para a DRE Gerencial:`,
      table: {
        columns: [
          { key: "categoria", label: "Categoria", sortable: true, type: "text" },
          { key: "tipo", label: "Tipo Evento", sortable: true, type: "badge" },
          { key: "dreLine", label: "Linha da DRE", sortable: true, type: "text" }
        ],
        rows,
        totalRows: categories.length,
        exportable: true
      },
      actions: []
    };
  }

  // Resposta padrão analítica limpa sem asteriscos no meio de frases
  return {
    message: `Resumo Operacional ERP ContaAzul

Analisei os registros sincronizados no seu ambiente e identifiquei:

• Clientes: ${clients.length} contatos ativos na base
• Fornecedores: ${suppliers.length} fornecedores cadastrados
• Lançamentos: ${entries.length} títulos financeiros gravados
• Categorias DRE: ${categories.length} linhas de plano de contas

Você pode me pedir para listar clientes, consultar lançamentos, analisar fornecedores ou gerar infográficos financeiros a qualquer momento.`,
    table: null,
    actions: []
  };
}

/**
 * POST /api/contaazul/ia-workspace
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await req.json();
    const { prompt, conversationId, model, attachmentData } = body;

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { success: false, error: "Prompt é obrigatório." },
        { status: 400 }
      );
    }

    const dbSettings = getSavedSettings();
    const lower = prompt.toLowerCase();
    const isDirectDataQuery = lower.includes("cliente") || 
                              lower.includes("fornecedor") || 
                              lower.includes("lançamento") || 
                              lower.includes("lancamento") || 
                              lower.includes("categoria") || 
                              lower.includes("dre") || 
                              lower.includes("cadastrar") || 
                              lower.includes("lançar") || 
                              lower.includes("lancar") ||
                              lower.includes("gráfico") ||
                              lower.includes("grafico") ||
                              lower.includes("infográfico") ||
                              lower.includes("contas a pagar");

    let parsedResponse: any = null;

    if (isDirectDataQuery) {
      parsedResponse = generateLocalEngineResponse(prompt);
    } else {
      let apiUrl = "https://openrouter.ai/api/v1/chat/completions";
      let activeApiKey = dbSettings.openrouter_api_key || process.env.OPENROUTER_API_KEY;
      let activeModel = model || "google/gemini-2.5-pro";

      if (dbSettings.custom_ai_enabled && dbSettings.custom_ai_url && dbSettings.custom_ai_key) {
        apiUrl = `${dbSettings.custom_ai_url.replace(/\/$/, "")}/chat/completions`;
        activeApiKey = dbSettings.custom_ai_key;
        activeModel = dbSettings.custom_ai_model || "auto";
      }

      if (activeApiKey && !activeApiKey.includes("sk-or-v1-master-****") && activeApiKey.length > 10) {
        try {
          const db = getLocalDbFile();
          const clients = db.contaazul_clients || [];
          const suppliers = db.contaazul_suppliers || [];
          const entries = db.contaazul_entries || [];
          const categories = db.contaazul_categories || [];

          const systemPrompt = `Você é o Omni Conta Azul IA, assistente operacional nativo do ERP ContaAzul no OmniZeus.

IMPORTANTE: VOCÊ TEM ACESSO VERDADEIRO E COMPLETO AOS DADOS REAIS ABAIXO. NUNCA DIGA AO USUÁRIO QUE NÃO TEM ACESSO AO BANCO DE DADOS DA CONTAAZUL!

DADOS REAIS SINCRONIZADOS DA CONTAAZUL:
- Clientes (${clients.length} cadastrados): ${JSON.stringify(clients.slice(0, 10))}
- Fornecedores (${suppliers.length}): ${JSON.stringify(suppliers.slice(0, 10))}
- Lançamentos (${entries.length}): ${JSON.stringify(entries.slice(0, 10))}
- Categorias (${categories.length}): ${JSON.stringify(categories.slice(0, 10))}

DIRETRIZES DE RESPOSTA (OBRIGATÓRIO):
1. NÃO imprima blocos de código JSON brutos como \`\`\`json na mensagem. Responda em JSON puro na raiz do corpo HTTP.
2. NÃO use negrito com asteriscos duplos (**texto**) no meio de frases.
3. Estrutura do JSON:
{
  "message": "resposta explicativa em texto limpo sem asteriscos",
  "table": null ou {"columns": [{"key": "nome", "label": "Nome", "type": "text"}], "rows": [...]},
  "actions": []
}`;

          const response = await fetch(apiUrl, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${activeApiKey}`,
              "HTTP-Referer": "https://omnizeus.zenitus.com.br",
              "X-Title": "OmniZeus ContaAzul IA Workspace",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: activeModel,
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: prompt }
              ],
              stream: false,
              temperature: 0.2,
              max_tokens: 4096,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            const rawContent = data.choices?.[0]?.message?.content || "";
            const parsedObj = cleanAndParseJson(rawContent);

            if (parsedObj && parsedObj.message) {
              const cleanMsg = parsedObj.message.replace(/\*\*([^*]+)\*\*/g, '$1');
              parsedResponse = {
                message: cleanMsg,
                chart: parsedObj.chart || null,
                table: parsedObj.table || null,
                actions: parsedObj.actions || []
              };
            } else if (rawContent) {
              const cleanMsg = rawContent.replace(/```json/g, '').replace(/```/g, '').replace(/\*\*([^*]+)\*\*/g, '$1').trim();
              parsedResponse = { message: cleanMsg, table: null, actions: [] };
            }
          }
        } catch (e) {
          console.error("Erro ao chamar LLM remota:", e);
        }
      }
    }

    if (!parsedResponse) {
      parsedResponse = generateLocalEngineResponse(prompt);
    }

    // Persistir mensagem limpa e sem marcações JSON no banco SQLite
    const db = getLocalDbFile();
    const msgId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const aiMsgId = `msg_${Date.now() + 1}_${Math.random().toString(36).substr(2, 5)}`;
    const now = new Date().toISOString();

    if (!Array.isArray(db.contaazul_ia_messages)) db.contaazul_ia_messages = [];

    db.contaazul_ia_messages.push({
      id: msgId,
      conversation_id: conversationId || `conv_${Date.now()}`,
      sender: "user",
      text: prompt,
      created_at: now
    });

    // Guardar resposta como string JSON estruturada interna mas limpa
    const cleanStorageText = JSON.stringify({
      message: parsedResponse.message,
      chart: parsedResponse.chart || null,
      table: parsedResponse.table || null,
      actions: parsedResponse.actions || []
    });

    db.contaazul_ia_messages.push({
      id: aiMsgId,
      conversation_id: conversationId || `conv_${Date.now()}`,
      sender: "ai",
      text: cleanStorageText,
      model: model || "google/gemini-2.5-pro",
      created_at: now
    });

    if (!Array.isArray(db.contaazul_ia_audit_logs)) db.contaazul_ia_audit_logs = [];
    db.contaazul_ia_audit_logs.unshift({
      id: `audit_${Date.now()}`,
      userId: "super_adm",
      companyId: "comp_zenitus",
      timestamp: now,
      prompt,
      documentsAttached: attachmentData ? ["arquivo_importado"] : [],
      actionsProposed: parsedResponse.actions?.length || 0,
      provider: "CONTAAZUL_IA_ENGINE",
      model: model || "google/gemini-2.5-pro",
      result: "SUCCESS",
      responseTimeMs: Date.now() - startTime
    });

    saveLocalDbFile(db);

    return NextResponse.json({
      success: true,
      ...parsedResponse,
      conversationId: conversationId || `conv_${Date.now()}`,
      model: model || "google/gemini-2.5-pro",
      responseTimeMs: Date.now() - startTime
    });

  } catch (err: any) {
    console.error("[IA-Workspace Error]:", err);
    const fallback = generateLocalEngineResponse("resumo");
    return NextResponse.json({
      success: true,
      ...fallback,
      conversationId: `conv_${Date.now()}`,
      model: "local-engine",
      responseTimeMs: Date.now() - startTime
    });
  }
}
