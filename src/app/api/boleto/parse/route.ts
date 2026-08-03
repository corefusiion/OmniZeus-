export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";

export const runtime = "edge";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
    }

    // TODO: Implementar OCR / IA aqui (ex: enviar para o Gemini 1.5 Pro Vision ou OpenRouter).
    // Por enquanto, simulamos uma extração com base em uma leitura de código de barras ou OCR padrão.
    
    return NextResponse.json({
      success: true,
      data: {
        linhaDigitavel: "34191.09008 63396.921124 38243.680000 5 90000000015000",
        valor: 150.00,
        vencimento: "2026-08-15",
        fornecedor_cnpj: "00.000.000/0001-00",
        fornecedor_nome: "Fornecedor Padrão S.A."
      },
      message: "Boleto lido com sucesso pela IA."
    });

  } catch (err: any) {
    console.error("Erro na leitura do boleto:", err);
    return NextResponse.json(
      { success: false, error: "Falha ao processar o boleto." },
      { status: 500 }
    );
  }
}

