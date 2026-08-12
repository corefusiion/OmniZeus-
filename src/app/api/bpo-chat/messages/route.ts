import { NextResponse, NextRequest } from "next/server";
import { supabase } from "@/lib/db/supabaseClient";
import { getSession } from "@/lib/auth/session";

export const runtime = "edge";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession(req);
    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get("conversationId");

    if (!conversationId) {
      return NextResponse.json({ success: false, error: "ID da conversa ausente." }, { status: 400 });
    }

    // Verify conversation tenant ownership if session is present
    if (session && session.role !== "super_adm") {
      const { data: conv } = await supabase.from("conversations").select("*").eq("id", conversationId).single();
      if (conv && conv.company_id && conv.company_id !== session.companyId) {
        return NextResponse.json({ success: false, error: "Acesso não autorizado a esta conversa." }, { status: 403 });
      }
    }

    const { data: messages, error } = await supabase.from("messages").select("*").eq("conversation_id", conversationId).order("created_at", { ascending: true });
    if (error) throw error;

    return NextResponse.json({ success: true, messages: messages || [] });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession(req);
    const { conversationId, content, model, provider, accessToken, refreshToken, clientId, clientSecret, companyId } = await req.json();

    if (!conversationId || !content) {
      return NextResponse.json({ success: false, error: "ID da conversa e conteúdo são obrigatórios." }, { status: 400 });
    }

    const activeTenantId = session
      ? (session.role === "super_adm" && companyId ? companyId : session.companyId)
      : (companyId || req.headers.get("x-company-id") || "comp_zenitus");

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

    await supabase.from("messages").insert(userMsg);

    // Update conversation title and timestamps
    const { data: conv } = await supabase.from("conversations").select("*").eq("id", conversationId).single();
    if (conv) {
      const title = (conv.title === "Nova Conversa BPO" || !conv.title) 
        ? userText.substring(0, 30) + (userText.length > 30 ? "..." : "")
        : conv.title;
      await supabase.from("conversations").update({
        title,
        updated_at: now,
        last_message_at: now
      }).eq("id", conversationId);
    }

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

          await supabase.from("messages").insert(aiMsgObj);

          return NextResponse.json({ success: true, message: aiTextResponse, actionExecuted: true });
        } catch (e) {}
      }
    }

    // Fetch conversation history for LLM
    const { data: dbMsgs } = await supabase.from("messages").select("*").eq("conversation_id", conversationId).order("created_at", { ascending: true });
    const historyMsgs = (dbMsgs || [])
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

    const systemPrompt = `Você é o Zeus BPO â€” Especialista Master em BPO Financeiro, Rotinas Contábeis e API RESTful v2 da ContaAzul Pro.
Você possui autonomia e autoridade para responder dúvidas contábeis, orientar conciliação bancária, DRE, impostos e sugerir comandos de execução direta de tarefas no sistema.

[CONTEXTO TEMPORAL]
- Data: ${dateStrBr} | Horário de Brasília: ${timeStrBr} | Período: ${periodBr}
- Se o usuário cumprimentar, responda de forma cordial, profissional e direta ao ponto, apenas dando o ${greetingBr} correspondente ao horário. NUNCA seja sarcástico.`;

    const { executeAIRequest } = await import("@/lib/ai/openRouterClient");

    const aiRes = await executeAIRequest({
      companyId: activeTenantId,
      userRole: 'gestor',

      requestedModel: model || "google/gemini-2.5-pro",
      messages: [
        { role: "system", content: systemPrompt },
        ...historyMsgs
      ],
      featureContext: "BPO Chat"
    });

    if (aiRes.isError) {
      const errText = aiRes.content || "Não foi possível obter resposta do servidor da IA.";
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
      
      await supabase.from("messages").insert(aiErrObj);

      return NextResponse.json({ success: true, message: errText, isConfigError: true });
    }

    let aiResponseText = aiRes.content;

    const aiMsgObj = {
      id: `msg_${Date.now()}_ai`,
      conversation_id: conversationId,
      role: "assistant",
      content: aiResponseText,
      model: model || "google/gemini-2.5-pro",
      provider: provider || "openrouter",
      created_at: new Date().toISOString()
    };

    await supabase.from("messages").insert(aiMsgObj);

    return NextResponse.json({
      success: true,
      message: aiResponseText
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}


