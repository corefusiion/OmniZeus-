import { NextRequest, NextResponse } from "next/server";
import { readDb } from "@/lib/db/localDb";
import { getSession } from "@/lib/auth/session";
import { executeAIRequest } from "@/lib/ai/openRouterClient";
import { recordAIMetrics, estimateCostByFixedRates } from "@/lib/ai/metrics";
import { buildTenantContext } from "@/lib/ai/tenantContext";

export const runtime = "nodejs";

// Modelo fixo do rascunhista de respostas — sem seletor.
const DRAFT_MODEL = "anthropic/claude-3.7-sonnet";

function money(v: number): string {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function typeLabel(type: string): string {
  if (type === "compra_material") return "Compra de Suprimento / Equipamento";
  if (type === "servico_terceiro") return "Serviço Terceirizado";
  return "Inclusão de Saldo de OmniCoins";
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  try {
    const session = getSession(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    const body = await req.json();
    const { reqId, decision } = body;
    if (!reqId) {
      return NextResponse.json({ error: "Solicitação não informada." }, { status: 400 });
    }
    if (decision !== "aprovar" && decision !== "recusar") {
      return NextResponse.json({ error: "Decisão inválida. Use 'aprovar' ou 'recusar'." }, { status: 400 });
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
      return NextResponse.json({ error: "Solicitação não encontrada para esta empresa." }, { status: 404 });
    }

    const status = String(record.status || "Pendente").trim().toLowerCase();
    if (status !== "pendente" && status !== "pending") {
      return NextResponse.json({
        error: "Apenas solicitações pendentes podem receber rascunho de resposta com IA."
      }, { status: 400 });
    }

    // Contexto factual do tenant, respeitando os módulos do funcionário.
    const context = await buildTenantContext({
      companyId,
      allowedModules: session.allowedModules
    });

    const requestFacts = [
      `- Código: ${record.req_number || record.reqNumber || "—"}`,
      `- Solicitante: ${record.requester_name || record.requesterName || "—"}`,
      `- Departamento: ${record.department || "—"}`,
      `- Tipo: ${typeLabel(record.type || "")}`,
      `- Valor estimado: R$ ${money(Number(record.value_brl) || Number(record.valueBrl) || 0)}`,
      record.coins_amount || record.coinsAmount
        ? `- OmniCoins solicitadas: ${Number(record.coins_amount || record.coinsAmount).toLocaleString("pt-BR")}`
        : null,
      `- Data da solicitação: ${new Date(record.created_at || record.createdAt || new Date()).toLocaleDateString("pt-BR")}`,
      `- Descrição/justificativa: ${record.description || "—"}`
    ].filter(Boolean).join("\n");

    const isApproval = decision === "aprovar";
    const systemPrompt = [
      "Você é o assistente \"Auto-resposta de Solicitações\" da plataforma OmniZeus, especializado em redigir",
      "respostas profissionais do gestor ao solicitante dentro do fluxo formal de aprovações BPO.",
      isApproval
        ? "Redija um RASCUNHO DE OBSERVAÇÃO DE APROVAÇÃO: reconheça o pedido, cite os dados da solicitação,"
          + " sinalize a aprovação e descreva os próximos passos (ex.: encaminhamento ao setor responsável,"
          + " liberação da verba, emissão de pedido)."
        : "Redija um RASCUNHO DE MOTIVO DE REPROVAÇÃO: reconheça o pedido com respeito, explique de forma"
          + " objetiva e profissional os motivos que levaram à recusa, e sugira eventuais ajustes que permitiriam"
          + " nova submissão.",
      "Regras:",
      "- Use APENAS os dados da solicitação e o contexto da empresa abaixo — NUNCA invente valores, prazos ou informações.",
      "- Escreva em português, tom profissional e cordial, sem rebuscamento, em 3 a 6 frases curtas.",
      "- O texto será revisado e enviado por um gestor humano — não cite a IA nem a plataforma.",
      "- Saída apenas com o texto da resposta, sem cabeçalhos, sem marcadores e sem explicações adicionais.",
      "",
      "=== SOLICITAÇÃO ===",
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
        { role: "user", content: `Redija o rascunho de ${isApproval ? "aprovação" : "reprovação"} para a solicitação ${record.req_number || record.reqNumber || reqId}.` }
      ],
      persona: "solicitacao-auto-resposta",
      featureContext: "Auto-resposta de Solicitação (draft)",
      skipAccounting: true
    });

    if (aiRes.isError) {
      return NextResponse.json({
        error: "Servidor fora de operação, aguarde um momento e tente novamente."
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
      functionality: "Auto-resposta de Solicitação",
      operationType: "STANDARD",
      agentId: "solicitacao-auto-resposta",
      agentName: "Auto-resposta de Solicitações",
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
