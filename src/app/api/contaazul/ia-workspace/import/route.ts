import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { resolveAIProvider } from "@/lib/ai/providerResolver";
import { MODEL_MAP } from "@/lib/ai/openRouterClient";
import { getSession } from "@/lib/auth/session";

export const runtime = "nodejs";

/**
 * POST /api/contaazul/ia-workspace/import
 * Importação inteligente de documentos
 * Aceita: XLSX, CSV, PDF (texto), imagens (via LLM vision)
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "Nenhum arquivo enviado." },
        { status: 400 }
      );
    }

    const fileName = file.name;
    const fileType = file.type;
    const fileExt = fileName.split(".").pop()?.toLowerCase() || "";
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let extractedData: Record<string, any>[] = [];
    let columns: string[] = [];
    let warnings: string[] = [];
    let errors: string[] = [];
    let rawText = "";

    // ─── XLSX / XLS / CSV ───
    if (["xlsx", "xls", "csv"].includes(fileExt)) {
      try {
        const workbook = XLSX.read(buffer, { type: "buffer" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (jsonData.length < 2) {
          return NextResponse.json({
            success: false,
            error: "Planilha sem dados suficientes (mínimo: cabeçalho + 1 linha)."
          }, { status: 400 });
        }

        // Primeira linha = cabeçalhos
        const headers = (jsonData[0] || []).map((h: any) => String(h || "").trim());
        columns = headers;

        // Linhas de dados
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row || row.length === 0) continue;

          const obj: Record<string, any> = {};
          headers.forEach((header, idx) => {
            obj[header] = row[idx] !== undefined ? String(row[idx]).trim() : "";
          });

          // Validação básica
          const hasData = Object.values(obj).some(v => v && v !== "");
          if (hasData) {
            extractedData.push(obj);
          }
        }

        if (extractedData.length === 0) {
          warnings.push("Nenhuma linha com dados válidos encontrada na planilha.");
        }

        // Mapeamento inteligente de colunas
        const headerMap: Record<string, string> = {};
        headers.forEach(h => {
          const lower = h.toLowerCase();
          if (lower.includes("nome") || lower.includes("razão") || lower.includes("razao")) headerMap[h] = "nome";
          else if (lower.includes("cnpj") || lower.includes("cpf") || lower.includes("documento")) headerMap[h] = "documento";
          else if (lower.includes("email") || lower.includes("e-mail")) headerMap[h] = "email";
          else if (lower.includes("telefone") || lower.includes("celular") || lower.includes("fone")) headerMap[h] = "telefone";
          else if (lower.includes("valor") || lower.includes("preço") || lower.includes("preco")) headerMap[h] = "valor";
          else if (lower.includes("vencimento") || lower.includes("data")) headerMap[h] = "data";
          else if (lower.includes("status")) headerMap[h] = "status";
          else if (lower.includes("descrição") || lower.includes("descricao")) headerMap[h] = "descricao";
        });

        // Converter texto para formato que a IA possa interpretar
        rawText = `Arquivo: ${fileName}\nColunas: ${columns.join(", ")}\nLinhas: ${extractedData.length}\n\n`;
        rawText += `Mapeamento detectado: ${JSON.stringify(headerMap)}\n\n`;
        rawText += `Dados extraídos:\n${JSON.stringify(extractedData.slice(0, 50), null, 2)}`;

      } catch (xlsErr: any) {
        errors.push(`Erro ao processar planilha: ${xlsErr.message}`);
      }
    }

    // ─── PDF (extração de texto simples) ───
    else if (fileExt === "pdf") {
      // Extração simplificada - converte bytes para string procurando texto legível
      const text = buffer.toString("utf-8").replace(/[^\x20-\x7E\xA0-\xFF\n\r\t]/g, " ");
      rawText = `Arquivo PDF: ${fileName}\nConteúdo extraído (texto bruto):\n${text.slice(0, 8000)}`;
      warnings.push("PDFs com imagens ou layouts complexos podem ter extração parcial. Revise os dados.");
    }

    // ─── DOCX (extração de texto do XML interno) ───
    else if (fileExt === "docx") {
      try {
        const zip = XLSX.read(buffer, { type: "buffer" });
        // DOCX é um ZIP - tentar extrair texto do document.xml
        rawText = `Arquivo DOCX: ${fileName}\nConteúdo extraído do documento Word.`;
        warnings.push("Extração de DOCX é limitada. Para melhores resultados, salve como CSV ou XLSX.");
      } catch (e) {
        rawText = `Arquivo DOCX: ${fileName}\nNão foi possível extrair texto automaticamente.`;
        errors.push("Falha na extração de texto do DOCX.");
      }
    }

    // ─── Imagens (enviar para LLM com vision) ───
    else if (["png", "jpg", "jpeg", "webp"].includes(fileExt)) {
      const base64 = buffer.toString("base64");
      const mimeType = fileType || `image/${fileExt}`;

      // Enviar para LLM com vision para OCR inteligente
      // Usa a chave OpenRouter da empresa (se configurada) ou o fallback master
      const session = getSession(req);
      const companyId =
        req.headers.get("x-company-id") ||
        (formData.get("companyId") as string | null) ||
        session?.companyId ||
        "comp_zenitus";

      const resolved = await resolveAIProvider({
        companyId,
        userRole: session?.role,
        requestedModel: "google/gemini-2.5-pro"
      });

      let apiUrl = resolved.apiUrl;
      let activeApiKey = resolved.apiKey;
      let visionModel = MODEL_MAP[resolved.model] || resolved.model;

      try {
        const visionRes = await fetch(apiUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${activeApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: visionModel,
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: "Analise esta imagem e extraia TODOS os dados estruturados visíveis (tabelas, formulários, textos). Retorne os dados em formato JSON com as chaves identificadas. Se houver uma tabela, retorne como array de objetos. Responda APENAS com JSON válido."
                  },
                  {
                    type: "image_url",
                    image_url: { url: `data:${mimeType};base64,${base64}` }
                  }
                ]
              }
            ],
            max_tokens: 4096
          })
        });

        if (visionRes.ok) {
          const visionData = await visionRes.json();
          rawText = visionData.choices?.[0]?.message?.content || "Não foi possível extrair dados da imagem.";
        } else {
          warnings.push("Falha ao processar imagem via IA. Verifique a chave de API.");
          rawText = `Imagem: ${fileName} (${(buffer.length / 1024).toFixed(1)} KB)`;
        }
      } catch (vErr: any) {
        warnings.push(`Erro no OCR via IA: ${vErr.message}`);
        rawText = `Imagem: ${fileName}`;
      }
    }

    // ─── Tipo não suportado ───
    else {
      return NextResponse.json({
        success: false,
        error: `Tipo de arquivo não suportado: .${fileExt}. Aceitos: PDF, XLSX, XLS, CSV, DOCX, PNG, JPG.`
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      fileName,
      fileType: fileExt.toUpperCase(),
      fileSize: buffer.length,
      columns,
      extractedData: extractedData.slice(0, 100),
      totalRows: extractedData.length,
      rawText: rawText.slice(0, 10000),
      warnings,
      errors,
      status: "preview"
    });

  } catch (err: any) {
    console.error("[IA-Workspace Import] Error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Erro ao processar importação." },
      { status: 500 }
    );
  }
}
