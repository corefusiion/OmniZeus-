export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/db/supabaseClient";

export const runtime = "edge";

async function recordAuditLog(user: string, company: string, action: string, details: string) {
  try {
    await supabase.from("ai_stress_test_logs").insert({
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      user: user || "Super ADM Master",
      company: company || "Zenitus Inteligência Contábil Ltda",
      action: action || "ZEUS_BPO_IA_CONSULTATION",
      details: details,
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    console.error("Failed to record audit log:", e);
  }
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
    
    // Configurações dinâmicas baseadas no painel Super ADM
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
      const { executeAIRequest } = await import("@/lib/ai/openRouterClient");
      const activeTenantId = req.headers.get("x-company-id") || "comp_zenitus";

      const aiRes = await executeAIRequest({
        companyId: activeTenantId,
        requestedModel: model || "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: systemPrompt },
          ...(history || []),
          { role: "user", content: userInput }
        ],
        featureContext: "Conta Azul AI Assistant"
      });

      if (!aiRes.isError) {
        let contentStr = aiRes.content;
        
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
        aiMessage = aiRes.content || "Não foi possível obter resposta da IA.";
        action = "NONE";
      }
    } catch (apiError: any) {
      return NextResponse.json({ success: false, error: `Falha na requisição da IA: ${apiError.message}` }, { status: 500 });
    }

    // Direct Action Execution with Auto-Refresh Token!
    let actionResult = null;
    if (action === "CREATE_CUSTOMER" && extractedData.name && extractedData.document) {
      const origin = req.headers.get("origin") || "http://localhost:3000";
      const customerRes = await fetch(`${origin}/api/contaazul/customers`, {
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
      const now = new Date().toISOString();
      
      await supabase.from("contaazul_ia_messages").insert([
        {
          id: `msg_${Date.now()}_u`,
          conversation_id: conversationId,
          sender: "user",
          text: userInput,
          model: model,
          created_at: now
        },
        {
          id: `msg_${Date.now()}_ai`,
          conversation_id: conversationId,
          sender: "ai",
          text: aiMessage,
          model: model,
          created_at: new Date().toISOString()
        }
      ]);
      
      const { data: convs } = await supabase
        .from("contaazul_ia_conversations")
        .select("*")
        .eq("id", conversationId)
        .limit(1);
        
      if (convs && convs.length > 0) {
        const c = convs[0];
        const title = (c.title === "Nova Conversa BPO" || !c.title) 
          ? userInput.substring(0, 30) + (userInput.length > 30 ? "..." : "")
          : c.title;
          
        await supabase
          .from("contaazul_ia_conversations")
          .update({
            title,
            updatedAt: now
          })
          .eq("id", conversationId);
      }
    }

    await recordAuditLog(
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



