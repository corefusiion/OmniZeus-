import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE_PATH = path.join(DATA_DIR, "omnizeus_local_sql_database.json");

function getLocalDb(): any {
  try {
    if (fs.existsSync(DB_FILE_PATH)) {
      const raw = fs.readFileSync(DB_FILE_PATH, "utf-8");
      return JSON.parse(raw);
    }
  } catch (e) {}
  return {};
}

function saveLocalDb(db: any) {
  try {
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(db, null, 2), "utf-8");
  } catch (e) {}
}

function recordAuditLog(user: string, company: string, action: string, details: string) {
  try {
    const db = getLocalDb();
    if (!Array.isArray(db.ai_stress_test_logs)) db.ai_stress_test_logs = [];
    
    db.ai_stress_test_logs.unshift({
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      user: user || "Super ADM Master",
      company: company || "Zenitus Inteligência Contábil Ltda",
      action: action || "ZEUS_BPO_IA_CONSULTATION",
      details: details,
      timestamp: new Date().toISOString()
    });

    saveLocalDb(db);
  } catch (e) {}
}

export async function POST(req: Request) {
  try {
    const { prompt, audioText, history, conversationId, model, accessToken, refreshToken, clientId, clientSecret, currentUser, companyName } = await req.json();

    const userInput = (audioText || prompt || "").trim();

    if (!userInput) {
      return NextResponse.json(
        { success: false, error: "Envie um comando por texto ou áudio." },
        { status: 400 }
      );
    }

    const db = getLocalDb();
    const dbSettings = db.settings || {};
    
    // Configurações dinâmicas baseadas no painel Super ADM
    const useCustomEndpoint = dbSettings.custom_ai_enabled === true;
    const aiEndpoint = useCustomEndpoint && dbSettings.custom_ai_url 
      ? `${dbSettings.custom_ai_url}/chat/completions` 
      : "https://openrouter.ai/api/v1/chat/completions";
      
    const apiKey = useCustomEndpoint && dbSettings.custom_ai_key
      ? dbSettings.custom_ai_key
      : process.env.OPENROUTER_API_KEY || dbSettings.openrouter_api_key || "sk-or-v1-mock-key";

    const systemPrompt = `Você é o "Zeus BPO IA" — o Engenheiro e Especialista Master em BPO Financeiro e Operações Contábeis.

### DIRETRIZES DE PERSONA E SEGURANÇA:
1. Você responde de forma elegante, profissional e prestativa em Português Brasileiro.
2. NUNCA exponha credenciais privadas.

### REGRAS PARA CADASTRO DE CLIENTE (CREATE_CUSTOMER):
Para cadastrar um cliente, você PRECISA OBRIGATORIAMENTE dos seguintes dados:
- Tipo de pessoa: Física ou Jurídica
- CPF ou CNPJ válido
- Razão Social / Nome Completo
- Tipo de papel: Cliente, Fornecedor ou Transportadora
- Número do WhatsApp (para disparos automáticos)
- E-mail(s) para Cobrança e Faturamento

Dados opcionais que você pode coletar: Nome Fantasia, Optante pelo Simples Nacional? (Sim/Não), Endereço completo, Observações Gerais.

Se o usuário pedir para cadastrar um cliente e NÃO fornecer TODOS os dados obrigatórios listados acima, sua "action" deve ser "NONE", e na sua "message" você deve avisar que está faltando informações e perguntar QUAIS SÃO os dados que faltam de forma natural e empática, um a um ou agrupados, até ter tudo.
SÓ RETORNE a "action" como "CREATE_CUSTOMER" se você já tiver todos os dados obrigatórios!

### FORMATO OBRIGATÓRIO DE RESPOSTA EM JSON:
Responda EXCLUSIVAMENTE em formato JSON com a estrutura:
{
  "message": "Sua resposta amigável e profissional. Se faltarem dados, pergunte-os aqui.",
  "action": "CREATE_CUSTOMER" | "CREATE_ENTRY" | "NONE",
  "extractedData": {
    "personType": "Física | Jurídica",
    "document": "CPF ou CNPJ limpo",
    "name": "Razão Social / Nome Completo",
    "tradeName": "Nome Fantasia",
    "roleType": "Cliente | Fornecedor | Transportadora",
    "whatsapp": "Número do WhatsApp",
    "email": "E-mail(s) de Cobrança",
    "simplesNacional": "Sim | Não",
    "address": "Endereço completo",
    "notes": "Observações Gerais"
  }
}`;

    let aiMessage = "";
    let action = "NONE";
    let extractedData: any = {};

    try {
      const openRouterRes = await fetch(aiEndpoint, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: (useCustomEndpoint ? dbSettings.custom_ai_model : undefined) || "google/gemini-2.5-pro",
          messages: [
            { role: "system", content: systemPrompt },
            ...(history || []),
            { role: "user", content: userInput }
          ],
          stream: false
        })
      });

      if (openRouterRes.ok) {
        const rawText = await openRouterRes.text();
        let contentStr = "";
        try {
          const aiJson = JSON.parse(rawText);
          contentStr = aiJson.choices?.[0]?.message?.content || "";
        } catch (parseErr) {
          // O proxy (como LMStudio/Ollama) devolveu um Stream (SSE) forçado.
          // Vamos reconstruir a mensagem pegando todos os deltas 'data: {...}'
          const lines = rawText.split('\\n');
          let hasData = false;
          for (const line of lines) {
            if (line.trim().startsWith('data: ') && !line.includes('[DONE]')) {
              try {
                const chunk = JSON.parse(line.replace('data: ', '').trim());
                contentStr += chunk.choices?.[0]?.delta?.content || chunk.choices?.[0]?.message?.content || "";
                hasData = true;
              } catch (e) {}
            }
          }
          if (!hasData) throw new Error(`Resposta do proxy inválida: ${rawText.substring(0, 50)}...`);
        }
        
        // Remove markdown wrappers se presentes
        let cleanStr = contentStr.replace(/```json/gi, "").replace(/```/g, "").trim();
        
        try {
          const parsed = JSON.parse(cleanStr);
          aiMessage = parsed.message || contentStr;
          action = parsed.action || "NONE";
          extractedData = parsed.extractedData || {};
        } catch (parseError) {
          aiMessage = contentStr; 
          action = "NONE";
        }
      } else {
        const errorText = await openRouterRes.text();
        return NextResponse.json({ success: false, error: `Erro OpenRouter: ${openRouterRes.status} - ${errorText}` }, { status: 500 });
      }
    } catch (apiError: any) {
      return NextResponse.json({ success: false, error: `Falha na requisição da IA: ${apiError.message}` }, { status: 500 });
    }

    // Direct Action Execution with Auto-Refresh Token!
    let actionResult = null;
    if (action === "CREATE_CUSTOMER" && extractedData.name && extractedData.document) {
      const customerRes = await fetch(`${req.headers.get("origin") || "http://localhost:3000"}/api/contaazul/customers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessToken,
          refreshToken,
          clientId,
          clientSecret,
          name: extractedData.name,
          document: extractedData.document,
          email: extractedData.email,
          phone: extractedData.phone
        })
      });

      actionResult = await customerRes.json().catch(() => ({}));
      if (customerRes.ok && actionResult.success) {
        aiMessage += `\n\n✅ **Cliente '${extractedData.name}' cadastrado e sincronizado com sucesso no ERP ContaAzul Pro!**`;
      }
    }

    // Persistir no histórico de conversas e mensagens
    if (conversationId) {
      const db = getLocalDb();
      if (!db.messages) db.messages = [];
      if (!db.conversations) db.conversations = [];
      
      const now = new Date().toISOString();
      
      db.messages.push({
        id: `msg_${Date.now()}_u`,
        conversation_id: conversationId,
        role: "user",
        content: userInput,
        model: model,
        provider: "openrouter",
        created_at: now
      });
      
      db.messages.push({
        id: `msg_${Date.now()}_ai`,
        conversation_id: conversationId,
        role: "assistant",
        content: aiMessage,
        model: model,
        provider: "openrouter",
        created_at: new Date().toISOString()
      });
      
      db.conversations = db.conversations.map((c: any) => {
        if (c.id === conversationId) {
          const title = (c.title === "Nova Conversa BPO" || !c.title) 
            ? userInput.substring(0, 30) + (userInput.length > 30 ? "..." : "")
            : c.title;
          return {
            ...c,
            title,
            updated_at: now,
            last_message_at: now
          };
        }
        return c;
      });
      saveLocalDb(db);
    }

    recordAuditLog(
      currentUser || "Super ADM Master",
      companyName || "Zenitus Inteligência Contábil Ltda",
      "ZEUS_BPO_IA_INTERACTION",
      `Comando: "${userInput.substring(0, 100)}" | Ação: ${action}`
    );

    return NextResponse.json({
      success: true,
      message: aiMessage,
      action,
      extractedData,
      actionResult
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Erro no Assistente de IA." },
      { status: 500 }
    );
  }
}
