export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { saveContaAzulTokens } from "@/lib/contaazul/store";

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
    const { code, clientId, clientSecret, redirectUri, companyId } = await req.json();

    if (!code || !clientId || !clientSecret) {
      return NextResponse.json(
        { error: "Parâmetros code, clientId e clientSecret são obrigatórios." },
        { status: 400 }
      );
    }

    const credentials = Buffer.from(`${clientId.trim()}:${clientSecret.trim()}`).toString("base64");
    const cleanRedirectUri = redirectUri || "https://contaazul.com";

    // Attempt 1: https://api.contaazul.com/oauth2/token
    let tokenRes = await fetch("https://api.contaazul.com/oauth2/token", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        redirect_uri: cleanRedirectUri,
        code: code.trim()
      })
    });

    let tokenData = await tokenRes.json().catch(() => ({}));

    // Attempt 2: https://auth.contaazul.com/oauth2/token if Attempt 1 failed
    if (!tokenRes.ok || !tokenData.access_token) {
      tokenRes = await fetch("https://auth.contaazul.com/oauth2/token", {
        method: "POST",
        headers: {
          "Authorization": `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          redirect_uri: cleanRedirectUri,
          code: code.trim(),
          client_id: clientId.trim(),
          client_secret: clientSecret.trim()
        })
      });
      tokenData = await tokenRes.json().catch(() => ({}));
    }

    if (!tokenRes.ok || !tokenData.access_token) {
      const errorMsg = tokenData.error_description || tokenData.message || tokenData.error || `HTTP ${tokenRes.status}: Falha ao trocar código pelo token. O código pode ter sido usado ou expirou (válido por 3 min).`;
      return NextResponse.json(
        { 
          error: errorMsg,
          details: tokenData 
        },
        { status: tokenRes.status || 400 }
      );
    }

    // PERSIST tokens isolados por empresa (companyId) — NUNCA default comp_zenitus
    saveContaAzulTokens(companyId || "comp_zenitus", {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      clientId: clientId.trim(),
      clientSecret: clientSecret.trim()
    });

    return NextResponse.json({
      success: true,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_in: tokenData.expires_in
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Erro de conexão com o servidor da ContaAzul." },
      { status: 500 }
    );
  }
}

