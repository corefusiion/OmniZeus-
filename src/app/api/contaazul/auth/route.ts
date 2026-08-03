export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";

export const runtime = "edge";

export async function POST(req: Request) {
  try {
    const { clientId, clientSecret, redirectUri } = await req.json();

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: "Client ID e Client Secret são obrigatórios." },
        { status: 400 }
      );
    }

    const cleanRedirectUri = redirectUri || "https://contaazul.com";

    // Standard ContaAzul OAuth 2.0 Login Consent Screen URL (without invalid scope param)
    const authUrl = `https://auth.contaazul.com/login?response_type=code&client_id=${encodeURIComponent(
      clientId
    )}&redirect_uri=${encodeURIComponent(cleanRedirectUri)}&state=omnizeus_oauth`;

    return NextResponse.json({
      success: true,
      authUrl,
      message: "URL de Autorização OAuth 2.0 gerada com sucesso."
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Falha ao gerar URL de autorização." },
      { status: 500 }
    );
  }
}

