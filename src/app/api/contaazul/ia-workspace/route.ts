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

    let parsedResponse: any = null;

    if (!parsedResponse) {
      const dbSettings = getSavedSettings();
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

          // Recuperar histórico da conversa para manter contexto (ex: "sim")
          const messagesHistory = (db.contaazul_ia_messages || [])
            .filter((m: any) => m.conversation_id === conversationId)
            .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
            .slice(-10)
            .map((m: any) => {
              if (m.sender === "ai") {
                try {
                  const parsed = JSON.parse(m.text);
                  return { role: "assistant", content: parsed.message || "" };
                } catch (e) {
                  return { role: "assistant", content: m.text };
                }
              }
              return { role: "user", content: m.text };
            });

          const systemPrompt = `Você é o Omni Conta Azul IA, assistente operacional nativo do ERP ContaAzul no OmniZeus. Seu objetivo primário é comportar-se como um consultor humano experiente, conduzindo a conversa naturalmente.

COMPORTAMENTO CONVERSACIONAL (OBRIGATÓRIO):
1. Diferencie perguntas de comandos. Se o usuário diz "pode cadastrar cliente?", isso é uma PERGUNTA, não um comando. Responda naturalmente ("Claro, posso cadastrar. Me informe Nome, CNPJ e Email.") e NÃO tente executar a ação.
2. NUNCA assuma ou invente dados. Não preencha nome, email, telefone ou CNPJ com base em suposições (como usar "pode cadastrar um cliente?" como o Nome da pessoa).
3. Somente crie registros / widgets (array actions) QUANDO possuir todas as informações obrigatórias (ex: para cliente precisa de Nome, Nome Fantasia, Documento (CPF/CNPJ), Email, Tipo de Pessoa, Papel (Cliente/Fornecedor) e se é Optante pelo Simples). Se faltar algo, apenas PERGUNTE ao usuário o que falta e NÃO gere a action.
4. Antes de tomar uma decisão de gerar a action, valide internamente:
   - A intenção está clara? É um pedido de cadastro real?
   - Tenho todos os dados?
   - Se "não", pergunte o que falta.

IMPORTANTE: VOCÊ TEM ACESSO VERDADEIRO E COMPLETO AOS DADOS REAIS ABAIXO. NUNCA DIGA AO USUÁRIO QUE NÃO TEM ACESSO AO BANCO DE DADOS DA CONTAAZUL!

DADOS REAIS SINCRONIZADOS DA CONTAAZUL:
- Clientes (${clients.length} cadastrados): ${JSON.stringify(clients.slice(0, 10))}
- Fornecedores (${suppliers.length}): ${JSON.stringify(suppliers.slice(0, 10))}
- Lançamentos (${entries.length}): ${JSON.stringify(entries.slice(0, 10))}
- Categorias (${categories.length}): ${JSON.stringify(categories.slice(0, 10))}

DIRETRIZES DE RESPOSTA (OBRIGATÓRIO):
1. NÃO imprima blocos de código JSON brutos como \`\`\`json na mensagem. Responda em JSON puro na raiz do corpo HTTP.
2. NÃO use negrito com asteriscos duplos (**texto**) no meio de frases.
3. PROIBIDO GERAÇÃO DE LINKS DE IMAGEM MARRKDOWN DO TIPO ![...](sandbox://...) OU ![...](file://...). NUNCA INVENTE CAMINHOS DE SANDBOX!
4. QUANDO O USUÁRIO SOLICITAR UM GRÁFICO (linha, barras, evolução, despesas, vencimentos), RETORNE O OBJETO JSON "chart" PREENCHIDO com o tipo "line" ou "bar", totais e itens (cada item contendo "label" e "value").
5. Apenas retorne objetos de criação dentro da array "actions" se a intenção for clara E você tiver os dados.
6. Estrutura do JSON base de resposta:
{
  "message": "Sua resposta conversacional em texto limpo e legível.",
  "chart": {
    "title": "Gráfico de Linhas — Evolução de Lançamentos",
    "chartType": "line",
    "totalPayable": 11500,
    "totalReceivable": 15400,
    "netBalance": 3900,
    "items": [
      { "label": "02/08", "value": 1100 },
      { "label": "06/08", "value": 1700 },
      { "label": "10/08", "value": 2300 },
      { "label": "14/08", "value": 2900 },
      { "label": "18/08", "value": 3500 }
    ]
  },
  "table": null,
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
                ...messagesHistory,
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

            // Automatic Table Synthesizer for Client/Supplier/Entry Table Queries
            const promptLower = prompt.toLowerCase();
            const db = getLocalDbFile();
            const clients = db.contaazul_clients || [];
            const suppliers = db.contaazul_suppliers || [];
            const entries = db.contaazul_entries || [];

            if (!parsedResponse.table && (promptLower.includes("tabela") || promptLower.includes("liste") || promptLower.includes("quantos") || promptLower.includes("mostrar"))) {
              if (promptLower.includes("cliente")) {
                parsedResponse.table = {
                  columns: [
                    { key: "name", label: "Nome / Razão Social" },
                    { key: "document", label: "Documento (CNPJ/CPF)" },
                    { key: "email", label: "E-mail de Contato" }
                  ],
                  rows: clients.map((c: any) => ({
                    id: c.id,
                    name: c.name || c.nome || c.company_name || c.razao_social || "Cliente CA",
                    document: c.document || c.cnpj || c.cpf || c.documento || "Não informado",
                    email: c.email || "Sem e-mail"
                  }))
                };
              } else if (promptLower.includes("fornecedor")) {
                parsedResponse.table = {
                  columns: [
                    { key: "name", label: "Razão Social / Fornecedor" },
                    { key: "document", label: "CNPJ / Documento" },
                    { key: "email", label: "E-mail de Contato" }
                  ],
                  rows: suppliers.map((s: any) => ({
                    id: s.id,
                    name: s.name || s.nome || "Fornecedor ERP",
                    document: s.document || s.cnpj || s.documento || "Não informado",
                    email: s.email || "Sem e-mail"
                  }))
                };
              } else if (promptLower.includes("lançamento") || promptLower.includes("despesa") || promptLower.includes("conta")) {
                parsedResponse.table = {
                  columns: [
                    { key: "description", label: "Descrição do Título" },
                    { key: "nome_pessoa", label: "Favorecido" },
                    { key: "valor", label: "Valor (R$)", type: "currency" },
                    { key: "situacao", label: "Situação", type: "status" }
                  ],
                  rows: entries.map((e: any) => ({
                    id: e.id || e.id_evento,
                    description: e.description || e.desc || "Lançamento Financeiro",
                    nome_pessoa: e.nome_pessoa || e.cliente || e.fornecedor || "-",
                    valor: Number(e.valor || 0),
                    situacao: e.situacao || e.status || "PENDENTE"
                  }))
                };
              }
            }
          }
        } catch (e) {
          console.error("Erro ao chamar LLM remota:", e);
        }
      }
    }

    if (!parsedResponse) {
      parsedResponse = {
        message: "Não consegui processar a resposta no momento. Tente novamente.",
        table: null,
        actions: []
      };
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
    return NextResponse.json({
      success: true,
      message: "Erro interno ao consultar IA. Tente novamente.",
      table: null,
      actions: [],
      conversationId: `conv_${Date.now()}`,
      model: "local-engine",
      responseTimeMs: Date.now() - startTime
    });
  }
}
