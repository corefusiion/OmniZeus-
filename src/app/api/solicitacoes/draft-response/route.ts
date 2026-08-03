export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { readDb } from "@/lib/db/localDb";
import { getSession } from "@/lib/auth/session";
import { executeAIRequest } from "@/lib/ai/openRouterClient";
import { recordAIMetrics, estimateCostByFixedRates } from "@/lib/ai/metrics";
import { buildTenantContext } from "@/lib/ai/tenantContext";

export const runtime = "edge";

// Modelo fixo do rascunhista de respostas â€” sem seletor.
const DRAFT_MODEL = "anthropic/claude-3.7-sonnet";

function money(v: number): string {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function typeLabel(type: string): string {
  if (type === "compra_material") return "Compra de Suprimento / Equipamento";
  if (type === "servico_terceiro") return "ServiÃ§o Terceirizado";
  return "InclusÃ£o de Saldo de OmniCoins";
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  try {
    const session = await getSession(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    const body = await req.json();
    const { reqId, decision } = body;
    if (!reqId) {
      return NextResponse.json({ error: "SolicitaÃ§Ã£o nÃ£o informada." }, { status: 400 });
    }
    if (decision !== "aprovar" && decision !== "recusar") {
      return NextResponse.json({ error: "DecisÃ£o invÃ¡lida. Use 'aprovar' ou 'recusar'." }, { status: 400 });
    }

    const isSuperAdmin = session.role === "super_adm";
    const requestedCompanyId = req.headers.get("x-company-id");
    const companyId = isSuperAdmin && requestedCompanyId && requestedCompanyId !== "global"
      ? requestedCompanyId
      : (session.companyId || "comp_zenitus");

    const db = await readDb();
    const record = (db.purchase_requests || []).find(
      (r: any) => r.id === reqId && (r.company_id || r.companyId) === companyId
    );
    if (!record) {
      return NextResponse.json({ error: "SolicitaÃ§Ã£o nÃ£o encontrada para esta empresa." }, { status: 404 });
    }

    const status = String(record.status || "Pendente").trim().toLowerCase();
    if (status !== "pendente" && status !== "pending") {
      return NextResponse.json({
        error: "Apenas solicitaÃ§Ãµes pendentes podem receber rascunho de resposta com IA."
      }, { status: 400 });
    }

    // Contexto factual do tenant, respeitando os mÃ³dulos do funcionÃ¡rio.
    const context = await buildTenantContext({
      companyId,
      allowedModules: session.allowedModules
    });

    const requestFacts = [
      `- CÃ³digo: ${record.req_number || record.reqNumber || "â€”"}`,
      `- Solicitante: ${record.requester_name || record.requesterName || "â€”"}`,
      `- Departamento: ${record.department || "â€”"}`,
      `- Tipo: ${typeLabel(record.type || "")}`,
      `- Valor estimado: R$ ${money(Number(record.value_brl) || Number(record.valueBrl) || 0)}`,
      record.coins_amount || record.coinsAmount
        ? `- OmniCoins solicitadas: ${Number(record.coins_amount || record.coinsAmount).toLocaleString("pt-BR")}`
        : null,
      `- Data da solicitaÃ§Ã£o: ${new Date(record.created_at || record.createdAt || new Date()).toLocaleDateString("pt-BR")}`,
      `- DescriÃ§Ã£o/justificativa: ${record.description || "â€”"}`
    ].filter(Boolean).join("\n");

    const isApproval = decision === "aprovar";
    const systemPrompt = [
      "VocÃª Ã© o assistente \"Auto-resposta de SolicitaÃ§Ãµes\" da plataforma OmniZeus, especializado em redigir",
      "respostas profissionais do gestor ao solicitante dentro do fluxo formal de aprovaÃ§Ãµes BPO.",
      isApproval
        ? "Redija um RASCUNHO DE OBSERVAÃ‡ÃƒO DE APROVAÃ‡ÃƒO: reconheÃ§a o pedido, cite os dados da solicitaÃ§Ã£o,"
          + " sinalize a aprovaÃ§Ã£o e descreva os prÃ³ximos passos (ex.: encaminhamento ao setor responsÃ¡vel,"
          + " liberaÃ§Ã£o da verba, emissÃ£o de pedido)."
        : "Redija um RASCUNHO DE MOTIVO DE REPROVAÃ‡ÃƒO: reconheÃ§a o pedido com respeito, explique de forma"
          + " objetiva e profissional os motivos que levaram Ã  recusa, e sugira eventuais ajustes que permitiriam"
          + " nova submissÃ£o.",
      "Regras:",
      "- Use APENAS os dados da solicitaÃ§Ã£o e o contexto da empresa abaixo â€” NUNCA invente valores, prazos ou informaÃ§Ãµes.",
      "- Escreva em portuguÃªs, tom profissional e cordial, sem rebuscamento, em 3 a 6 frases curtas.",
      "- O texto serÃ¡ revisado e enviado por um gestor humano â€” nÃ£o cite a IA nem a plataforma.",
      "- SaÃ­da apenas com o texto da resposta, sem cabeÃ§alhos, sem marcadores e sem explicaÃ§Ãµes adicionais.",
      "",
      "=== SOLICITAÃ‡ÃƒO ===",
      requestFacts,
      "",
      "=== CONTEXTO DA EMPRESA ===",
      context
    ].join("\n");

    const aiRes = await executeAIRequest({
      companyId,
      userRole: session.role,
      userEmail: session.email,
      requestedModel: DRAFT_MODEL,
      temperature: 0.4,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Redija o rascunho de ${isApproval ? "aprovaÃ§Ã£o" : "reprovaÃ§Ã£o"} para a solicitaÃ§Ã£o ${record.req_number || record.reqNumber || reqId}.` }
      ],
      persona: "solicitacao-auto-resposta",
      featureContext: "Auto-resposta de SolicitaÃ§Ã£o (draft)",
      skipAccounting: true
    });

    if (aiRes.isError) {
      return NextResponse.json({
        error: "Servidor fora de operaÃ§Ã£o, aguarde um momento e tente novamente."
      }, { status: 502 });
    }

    const draft = aiRes.content.trim();
    const durationMs = Date.now() - startTime;
    const inT = aiRes.usage?.inputTokens ?? 0;
    const outT = aiRes.usage?.outputTokens ?? Math.round(draft.length / 4);
    const { costUsd, costBrl } = estimateCostByFixedRates(inT, outT);

    await recordAIMetrics({
      companyId,
      userId: session.userId,
      model: aiRes.usage?.model || DRAFT_MODEL,
      functionality: "Auto-resposta de SolicitaÃ§Ã£o",
      operationType: "STANDARD",
      agentId: "solicitacao-auto-resposta",
      agentName: "Auto-resposta de SolicitaÃ§Ãµes",
      coins: 5,
      inputTokens: inT,
      outputTokens: outT,
      reasoningTokens: aiRes.usage?.reasoningTokens,
      totalTokens: aiRes.usage?.totalTokens,
      costUsd,
      costBrl,
      latencyMs: durationMs
    });

    return NextResponse.json({
      draft,
      decision,
      model: aiRes.usage?.model || DRAFT_MODEL,
      usage: {
        inputTokens: inT,
        outputTokens: outT,
        totalTokens: aiRes.usage?.totalTokens
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

