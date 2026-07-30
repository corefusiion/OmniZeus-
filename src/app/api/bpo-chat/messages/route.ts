import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE_PATH = path.join(DATA_DIR, "omnizeus_local_sql_database.json");

function getDbData() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(DB_FILE_PATH)) {
      const defaultDb = { conversations: [], messages: [] };
      fs.writeFileSync(DB_FILE_PATH, JSON.stringify(defaultDb, null, 2), "utf-8");
      return defaultDb;
    }
    const raw = fs.readFileSync(DB_FILE_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    if (!parsed.conversations) parsed.conversations = [];
    if (!parsed.messages) parsed.messages = [];
    return parsed;
  } catch (e) {
    return { conversations: [], messages: [] };
  }
}

function saveDbData(data: any) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(data, null, 2), "utf-8");
  } catch (e) {
    console.error("Error saving DB data:", e);
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get("conversationId");

    if (!conversationId) {
      return NextResponse.json({ success: false, error: "ID da conversa ausente." }, { status: 400 });
    }

    const db = getDbData();
    const filteredMsgs = (db.messages || []).filter((m: any) => m.conversation_id === conversationId)
      .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    return NextResponse.json({ success: true, messages: filteredMsgs });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { conversationId, content, model, provider, accessToken, refreshToken, clientId, clientSecret } = await req.json();

    if (!conversationId || !content) {
      return NextResponse.json({ success: false, error: "ID da conversa e conteúdo são obrigatórios." }, { status: 400 });
    }

    const db = getDbData();
    const now = new Date().toISOString();
    const userMsgId = `msg_${Date.now()}_u`;
    const userText = content.trim();

    const userMsg = {
      id: userMsgId,
      conversation_id: conversationId,
      role: "user",
      content: userText,
      model: model || "google/gemini-2.5-pro",
      provider: provider || "openrouter",
      created_at: now
    };

    db.messages.push(userMsg);

    // Update conversation title and timestamps
    db.conversations = (db.conversations || []).map((c: any) => {
      if (c.id === conversationId) {
        const title = (c.title === "Nova Conversa BPO" || !c.title) 
          ? userText.substring(0, 30) + (userText.length > 30 ? "..." : "")
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

    saveDbData(db);

    // Intent detection for automatic execution of ContaAzul tasks via AI
    const lowerText = userText.toLowerCase();

    // Check if user is asking to create a customer
    if (lowerText.includes("cadastr") || lowerText.includes("criar cliente") || lowerText.includes("adicionar cliente")) {
      // Extract name & doc if present
      const docMatch = userText.match(/\d{11,14}/);
      const doc = docMatch ? docMatch[0] : "03418330533";
      
      let clientName = "Empresa Cadastrada via IA";
      if (lowerText.includes("empresa")) {
        const parts = userText.split(/empresa/i);
        if (parts[1]) clientName = parts[1].split(/com|cnpj|cpf/i)[0].trim();
      } else if (lowerText.includes("cliente")) {
        const parts = userText.split(/cliente/i);
        if (parts[1]) clientName = parts[1].split(/com|cnpj|cpf/i)[0].trim();
      }

      if (accessToken) {
        try {
          const createRes = await fetch(`${req.headers.get("origin") || "http://localhost:3000"}/api/contaazul/customers`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              accessToken,
              refreshToken,
              clientId,
              clientSecret,
              name: clientName,
              document: doc,
              personType: doc.length > 11 ? "Jurídica" : "Física"
            })
          });

          const createData = await createRes.json();
          let aiTextResponse = `Excelente! O cadastro do cliente **${clientName}** (CPF/CNPJ: ${doc}) foi transmitido e sincronizado com sucesso no ERP ContaAzul Pro!`;

          if (!createRes.ok) {
            aiTextResponse = `Tentei realizar o cadastro de **${clientName}** na ContaAzul, porém a API retornou: ${createData.error || 'Verifique o token de acesso'}.`;
          }

          const aiMsgObj = {
            id: `msg_${Date.now()}_ai_action`,
            conversation_id: conversationId,
            role: "assistant",
            content: aiTextResponse,
            model: model || "google/gemini-2.5-pro",
            provider: provider || "openrouter",
            created_at: new Date().toISOString()
          };

          db.messages.push(aiMsgObj);
          saveDbData(db);

          return NextResponse.json({ success: true, message: aiTextResponse, actionExecuted: true });
        } catch (e) {}
      }
    }

    // Check if openrouter API key is configured
    const openRouterApiKey = process.env.OPENROUTER_API_KEY;

    if (!openRouterApiKey || openRouterApiKey === "sk-or-v1-mock-key") {
      const errText = "Nenhum provedor de IA está configurado no momento";
      const aiErrObj = {
        id: `msg_${Date.now()}_ai_err`,
        conversation_id: conversationId,
        role: "assistant",
        content: errText,
        model: model || "google/gemini-2.5-pro",
        provider: provider || "openrouter",
        created_at: new Date().toISOString(),
        isError: true
      };
      db.messages.push(aiErrObj);
      saveDbData(db);

      return NextResponse.json({
        success: true,
        message: errText,
        isConfigError: true
      });
    }

    // Fetch conversation history for LLM
    const historyMsgs = (db.messages || [])
      .filter((m: any) => m.conversation_id === conversationId)
      .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .slice(-20)
      .map((m: any) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content
      }));

    const nowBr = new Date();
    const dateStrBr = nowBr.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", year: "numeric", month: "long", day: "numeric" });
    const timeStrBr = nowBr.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
    const hourBr = parseInt(nowBr.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", hour12: false }), 10);
    const periodBr = hourBr >= 12 && hourBr < 18 ? "Tarde" : (hourBr >= 18 || hourBr < 5 ? "Noite" : "Manhã");
    const greetingBr = periodBr === "Tarde" ? "Boa tarde" : (periodBr === "Noite" ? "Boa noite" : "Bom dia");

    const systemPrompt = `Você é o Zeus BPO — Especialista Master em BPO Financeiro, Rotinas Contábeis e API RESTful v2 da ContaAzul Pro.
Você possui autonomia e autoridade para responder dúvidas contábeis, orientar conciliação bancária, DRE, impostos e sugerir comandos de execução direta de tarefas no sistema.

[CONTEXTO TEMPORAL]
- Data: ${dateStrBr} | Horário de Brasília: ${timeStrBr} | Período: ${periodBr}
- Se o usuário usar uma saudação incompatível com o horário (${timeStrBr}), responda com "${greetingBr}" e comente a divergência de horário de forma gentil e bem-humorada.`;

    const openRouterRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openRouterApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: model || "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: systemPrompt },
          ...historyMsgs
        ]
      })
    });

    if (!openRouterRes.ok) {
      const errText = "Não foi possível obter resposta do servidor da IA (OpenRouter indisponível).";
      const aiErrObj = {
        id: `msg_${Date.now()}_ai_err`,
        conversation_id: conversationId,
        role: "assistant",
        content: errText,
        model: model || "google/gemini-2.5-pro",
        provider: provider || "openrouter",
        created_at: new Date().toISOString(),
        isError: true
      };
      db.messages.push(aiErrObj);
      saveDbData(db);

      return NextResponse.json({ success: true, message: errText, isConfigError: true });
    }

    const aiData = await openRouterRes.json();
    const aiResponseText = aiData.choices?.[0]?.message?.content || "Entendido! Como posso ajudar você na operação?";

    const aiMsgObj = {
      id: `msg_${Date.now()}_ai`,
      conversation_id: conversationId,
      role: "assistant",
      content: aiResponseText,
      model: model || "google/gemini-2.5-pro",
      provider: provider || "openrouter",
      created_at: new Date().toISOString()
    };

    db.messages.push(aiMsgObj);
    saveDbData(db);

    return NextResponse.json({
      success: true,
      message: aiResponseText
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
