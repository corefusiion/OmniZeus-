export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { executeAIRequest } from "@/lib/ai/openRouterClient";
import { recordAIMetrics, estimateCostByFixedRates } from "@/lib/ai/metrics";
import { buildTenantContext } from "@/lib/ai/tenantContext";
import { getSession } from "@/lib/auth/session";

export const runtime = "nodejs";

// Modelo único fixo do assistente "Pergunte sobre esta empresa" — sem seletor.
const RAG_MODEL = "anthropic/claude-3.7-sonnet";

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  try {
    const body = await req.json();
    const { question } = body;

    const session = getSession(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    if (!question || String(question).trim().length === 0) {
      return NextResponse.json({ error: "Pergunta vazia." }, { status: 400 });
    }

    const isSuperAdmin = session.role === "super_adm";
    const requestedCompanyId = req.headers.get("x-company-id");
    const companyId = isSuperAdmin && requestedCompanyId && requestedCompanyId !== "global"
      ? requestedCompanyId
      : (session.companyId || "comp_zenitus");

    // Contexto factual do tenant, respeitando os módulos do funcionário.
    const context = await buildTenantContext({
      companyId,
      allowedModules: session.allowedModules
    });

    const systemPrompt = [
      "Você é o assistente interno \"Pergunte sobre esta empresa\" da plataforma OmniZeus.",
      "Responda perguntas sobre a EMPRESA ATUAL usando APENAS o contexto fornecido abaixo.",
      "Se o dado não estiver no contexto, diga claramente que não há registro — NUNCA invente números, nomes ou valores.",
      "Seja objetivo e direto, em português, com frases curtas. Quando houver valores, use R$.",
      "",
      "=== CONTEXTO DA EMPRESA ===",
      context
    ].join("\n");

    const aiRes = await executeAIRequest({
      companyId,
      userRole: session.role,
      userEmail: session.email,
      requestedModel: RAG_MODEL,
      temperature: 0.3,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: String(question) }
      ],
      persona: "company-rag",
      featureContext: "Pergunte sobre esta empresa (RAG)",
      skipAccounting: true
    });

    if (aiRes.isError) {
      // Mensagem amigável: nunca expõe detalhes de infraestrutura/fornecedor.
      return NextResponse.json({
        error: "Servidor fora de operação, aguarde um momento e tente novamente."
      }, { status: 502 });
    }

    const textContent = aiRes.content;
    const durationMs = Date.now() - startTime;
    const inT = aiRes.usage?.inputTokens ?? 0;
    const outT = aiRes.usage?.outputTokens ?? Math.round(textContent.length / 4);
    const { costUsd, costBrl } = estimateCostByFixedRates(inT, outT);

    await recordAIMetrics({
      companyId,
      userId: session.userId,
      model: aiRes.usage?.model || RAG_MODEL,
      functionality: "Pergunte sobre esta empresa",
      operationType: "STANDARD",
      agentId: "company-rag",
      agentName: "Assistente da Empresa (RAG)",
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
      text: textContent,
      model: aiRes.usage?.model || RAG_MODEL,
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

