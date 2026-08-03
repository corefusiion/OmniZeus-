export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { resolveAIProvider } from "@/lib/ai/providerResolver";
import { MODEL_MAP } from "@/lib/ai/openRouterClient";
import { recordAIMetrics, estimateCostByFixedRates } from "@/lib/ai/metrics";
import { getSession } from "@/lib/auth/session";

export const runtime = "edge";

const EXTRACT_MODEL = "google/gemini-2.5-pro";
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * POST /api/document-extract
 * ExtraÃ§Ã£o automÃ¡tica de documentos (fotos e PDFs) via modelo multimodal:
 * envia a imagem/PDF em base64 para o LLM com vision e devolve a transcriÃ§Ã£o
 * + resumo estruturado. Custa 5 OmniCoins (dÃ©bito Ãºnico aqui).
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now();
  try {
    const session = await getSession(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    const isSuperAdmin = session.role === "super_adm";
    const requestedCompanyId = req.headers.get("x-company-id");
    const companyId = isSuperAdmin && requestedCompanyId && requestedCompanyId !== "global"
      ? requestedCompanyId
      : (session.companyId || "comp_zenitus");

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
    }

    const fileName = file.name;
    const fileExt = fileName.split(".").pop()?.toLowerCase() || "";
    if (!["pdf", "png", "jpg", "jpeg", "webp"].includes(fileExt)) {
      return NextResponse.json({
        error: `Tipo de arquivo nÃ£o suportado: .${fileExt}. Envie PDF, PNG, JPG ou WEBP.`
      }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length > MAX_BYTES) {
      return NextResponse.json({ error: "Arquivo muito grande (mÃ¡x. 10 MB)." }, { status: 400 });
    }

    const resolved = await resolveAIProvider({
      companyId,
      userRole: session.role,
      userEmail: session.email,
      requestedModel: EXTRACT_MODEL
    });

    if (!resolved.apiKey || resolved.apiKey.includes("sk-or-v1-master-****")) {
      return NextResponse.json({
        error: "Servidor fora de operaÃ§Ã£o, aguarde um momento e tente novamente."
      }, { status: 502 });
    }

    const base64 = buffer.toString("base64");
    const mime = file.type || (fileExt === "pdf" ? "application/pdf" : `image/${fileExt}`);
    const model = MODEL_MAP[resolved.model] || resolved.model;

    const prompt = [
      "VocÃª Ã© o extrator de documentos da plataforma OmniZeus (BPO contÃ¡bil/financeiro).",
      "Analise o documento enviado (foto de nota fiscal, contrato, boleto, comprovante, PDF digitalizado etc.) e responda EXATAMENTE neste formato:",
      "",
      "=== TEXTO EXTRAÃDO ===",
      "Transcreva fielmente TODO o texto legÃ­vel do documento, preservando nÃºmeros, CNPJ/CPF, valores, datas e nomes.",
      "",
      "=== RESUMO ESTRUTURADO ===",
      "Em bullets curtos: tipo de documento, emitente, destinatÃ¡rio, valor total, data, vencimento, nÃºmero/chave, observaÃ§Ãµes relevantes.",
      "Se algum campo nÃ£o existir no documento, escreva 'NÃ£o identificado'. Responda em portuguÃªs."
    ].join("\n");

    const visionRes = await fetch(resolved.apiUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resolved.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: `data:${mime};base64,${base64}` } }
            ]
          }
        ],
        max_tokens: 4096
      })
    });

    if (!visionRes.ok) {
      return NextResponse.json({
        error: "Servidor fora de operaÃ§Ã£o, aguarde um momento e tente novamente."
      }, { status: 502 });
    }

    const visionData = await visionRes.json();
    const extracted = visionData.choices?.[0]?.message?.content || "";

    const durationMs = Date.now() - startTime;
    const inT = visionData.usage?.prompt_tokens || visionData.usage?.input_tokens || Math.round(buffer.length / 4000);
    const outT = visionData.usage?.completion_tokens || visionData.usage?.output_tokens || Math.round(extracted.length / 4);
    const { costUsd, costBrl } = estimateCostByFixedRates(inT, outT);

    await recordAIMetrics({
      companyId,
      userId: session.userId,
      model: model || resolved.model,
      functionality: "ExtraÃ§Ã£o de Documento",
      operationType: "DOCUMENT_ANALYSIS",
      agentId: "document-extract",
      agentName: "Extrator de Documentos (OCR IA)",
      coins: 5,
      inputTokens: inT,
      outputTokens: outT,
      totalTokens: (inT + outT),
      costUsd,
      costBrl,
      latencyMs: durationMs
    });

    return NextResponse.json({
      success: true,
      fileName,
      extracted,
      model,
      sizeKb: Math.round(buffer.length / 1024)
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

