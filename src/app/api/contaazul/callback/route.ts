export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { saveContaAzulTokens, getContaAzulTokens } from "@/lib/contaazul/store";

export const runtime = "edge";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      `http://localhost:3000/contaazul?error=${encodeURIComponent(error)}`
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `http://localhost:3000/contaazul?error=code_missing`
    );
  }

  return NextResponse.redirect(
    `http://localhost:3000/contaazul?code=${encodeURIComponent(code)}`
  );
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const code = body.code;
    const companyId = body.companyId || "comp_techcontabil_01";
    
    // Obter tokens e credenciais salvas do banco se não fornecidas no body
    const stored = await getContaAzulTokens(companyId);
    
    const clientId = (body.clientId || stored.clientId || "").trim();
    const clientSecret = (body.clientSecret || stored.clientSecret || "").trim();
    const redirectUri = body.redirectUri || stored.redirectUri || "https://contaazul.com";

    if (!code) {
      return NextResponse.json(
        { error: "O parâmetro 'code' de autorização é obrigatório." },
        { status: 400 }
      );
    }

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: "Client ID e Client Secret não configurados. Preencha na aba Credenciais & OAuth." },
        { status: 400 }
      );
    }

    const credentials = btoa(`${clientId}:${clientSecret}`);

    const params = new URLSearchParams({
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      code: code.trim(),
      client_id: clientId,
      client_secret: clientSecret
    });

    // Tentativa 1: https://auth.contaazul.com/oauth2/token
    let tokenRes = await fetch("https://auth.contaazul.com/oauth2/token", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: params
    });

    let tokenData = await tokenRes.json().catch(() => ({}));

    // Tentativa 2: https://api.contaazul.com/oauth2/token
    if (!tokenRes.ok || !tokenData.access_token) {
      tokenRes = await fetch("https://api.contaazul.com/oauth2/token", {
        method: "POST",
        headers: {
          "Authorization": `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: params
      });
      tokenData = await tokenRes.json().catch(() => ({}));
    }

    if (!tokenRes.ok || !tokenData.access_token) {
      const errorMsg = tokenData.error_description || tokenData.message || tokenData.error || `HTTP ${tokenRes.status}: Falha ao trocar código pelo token. O código expira em 3 min ou já foi utilizado.`;
      return NextResponse.json(
        { 
          error: errorMsg,
          details: tokenData 
        },
        { status: tokenRes.status || 400 }
      );
    }

    // Persistir os tokens recuperados com sucesso para a empresa
    await saveContaAzulTokens(companyId, {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      clientId,
      clientSecret,
      redirectUri
    });

    return NextResponse.json({
      success: true,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      companyId,
      message: "Access Token trocado e salvo com sucesso!"
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Erro interno ao processar OAuth callback." },
      { status: 500 }
    );
  }
}
