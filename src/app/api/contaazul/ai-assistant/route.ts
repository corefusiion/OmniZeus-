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
    const { prompt, audioText, history, accessToken, refreshToken, clientId, clientSecret, currentUser, companyName } = await req.json();

    const userInput = (audioText || prompt || "").trim();

    if (!userInput) {
      return NextResponse.json(
        { success: false, error: "Envie um comando por texto ou áudio." },
        { status: 400 }
      );
    }

    const db = getLocalDb();
    const dbSettings = db.settings || {};
    const openRouterApiKey = process.env.OPENROUTER_API_KEY || dbSettings.openrouter_api_key || dbSettings.custom_ai_key || "sk-or-v1-mock-key";

    const systemPrompt = `Você é o "Zeus BPO IA" — o Engenheiro e Especialista Master em BPO Financeiro, Operações Contábeis e API RESTful v2 da ContaAzul Pro no OmniZeus.

### SUAS DIRETRIZES DE PERSONA E SEGURANÇA:
1. **EXPERT EM CONTAAZUL PRO & BPO:** Você conhece a fundo a plataforma ContaAzul Pro, suas APIs v2 (Pessoas, Sales, Financial Events, Categories, DRE), conciliação bancária, emissão de NFSe/NFe, liquidação de títulos, fluxo de caixa e regimes tributários (Simples Nacional, Lucro Presumido, Lucro Real).
2. **ATENDIMENTO HUMANIZADO E ENTERPRISE:** Você responde de forma elegante, clara, objetiva, profissional e prestativa em Português Brasileiro. Sem jargões confusos, sempre focando na praticidade para o gestor ou operador contábil.
3. **SEGURANÇA DA INFORMAÇÃO & AUDITORIA:** Você atua em ambiente auditado e nunca expõe credenciais privadas.

### SUAS CAPACIDADES OPERACIONAIS:
Você pode processar a mensagem do usuário e decidir se deve:
- **CREATE_CUSTOMER:** Cadastrar um novo cliente no ERP ContaAzul.
- **CREATE_ENTRY:** Lançar uma cobrança de honorários ou conta a pagar.
- **CONSULTATION:** Explicar normas contábeis, regras da ContaAzul, conciliação bancária ou tirar dúvidas fiscais/BPO.

### FORMATO OBRIGATÓRIO DE RESPOSTA EM JSON:
Responda EXCLUSIVAMENTE em formato JSON com a estrutura:
{
  "message": "Sua explicação detalhada, amigável e profissional para o usuário.",
  "action": "CREATE_CUSTOMER" | "CREATE_ENTRY" | "NONE",
  "extractedData": {
    "name": "Nome/Razão Social se extraído",
    "document": "CPF ou CNPJ limpo (apenas números) se extraído",
    "email": "E-mail se extraído",
    "phone": "Telefone se extraído",
    "description": "Descrição da cobrança se extraída",
    "value": 1500.00,
    "dueDate": "YYYY-MM-DD",
    "type": "RECEBIMENTO" | "PAGAMENTO"
  }
}`;

    let aiMessage = "";
    let action = "NONE";
    let extractedData: any = {};

    try {
      const openRouterRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openRouterApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: dbSettings.custom_ai_model || "google/gemini-2.5-pro",
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            ...(history || []),
            { role: "user", content: userInput }
          ]
        })
      });

      if (openRouterRes.ok) {
        const aiJson = await openRouterRes.json();
        const contentStr = aiJson.choices?.[0]?.message?.content || "";
        const parsed = JSON.parse(contentStr);
        aiMessage = parsed.message || "Entendido! Como posso ajudar você na operação BPO?";
        action = parsed.action || "NONE";
        extractedData = parsed.extractedData || {};
      } else {
        throw new Error("OpenRouter fallback");
      }
    } catch (e) {
      const lower = userInput.toLowerCase();
      if (lower.includes("cadastrar") || lower.includes("cliente") || lower.includes("pessoa")) {
        const docMatch = userInput.match(/\d{11,14}/);
        const emailMatch = userInput.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
        
        extractedData = {
          name: userInput.replace(/cadastrar|cliente|pessoa|com|cpf|cnpj|email|telefone/gi, "").trim(),
          document: docMatch ? docMatch[0] : "",
          email: emailMatch ? emailMatch[0] : ""
        };

        if (extractedData.name && extractedData.document) {
          action = "CREATE_CUSTOMER";
          aiMessage = `Excelente! Identifiquei os dados do cliente **${extractedData.name}** (CPF/CNPJ: ${extractedData.document}). Transmitindo agora para o ERP ContaAzul Pro.`;
        } else {
          aiMessage = "Com certeza! Para cadastrar o cliente na ContaAzul, informe o **Nome/Razão Social** e o **CPF ou CNPJ**.";
        }
      } else if (lower.includes("dre") || lower.includes("relatório") || lower.includes("conciliação")) {
        aiMessage = "Na ContaAzul, o DRE Gerencial classifica receitas brutas por competência e deduz custos operacionais e impostos. Todos os títulos sincronizados no OmniZeus são espelhados no DRE em tempo real.";
      } else {
        aiMessage = `Olá! Sou o **Zeus BPO IA**, especialista em ContaAzul Pro e gestão financeira BPO. Como posso auxiliar sua operação hoje?`;
      }
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

    // Audit Logging into SQLite
    recordAuditLog(
      currentUser || "Super ADM Master",
      companyName || "Zenitus Inteligência Contábil Ltda",
      "ZEUS_BPO_IA_INTERACTION",
      `Comando: "${userInput.substring(0, 100)}" | Ação: ${action}`
    );

    return NextResponse.json({
      success: true,
      reply: aiMessage,
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
