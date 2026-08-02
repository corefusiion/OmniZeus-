import { NextResponse } from "next/server";
import { getContaAzulTokens, saveContaAzulTokens } from "@/lib/contaazul/store";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const stored = await getContaAzulTokens();

    const activeRefreshToken = body.refreshToken || stored.refreshToken;
    // Credenciais OAuth movidas para variáveis de ambiente (nunca hardcoded no código).
    const activeClientId = body.clientId || stored.clientId || process.env.CONTA_AZUL_CLIENT_ID || "";
    const activeClientSecret = body.clientSecret || stored.clientSecret || process.env.CONTA_AZUL_CLIENT_SECRET || "";

    if (!activeRefreshToken) {
      return NextResponse.json(
        { success: false, error: "Refresh Token ausente e não encontrado no banco em disco." },
        { status: 400 }
      );
    }
    if (!activeClientId || !activeClientSecret) {
      return NextResponse.json(
        { success: false, error: "Credenciais OAuth da ContaAzul não configuradas (CONTA_AZUL_CLIENT_ID / CONTA_AZUL_CLIENT_SECRET)." },
        { status: 400 }
      );
    }

    const credentials = Buffer.from(`${activeClientId.trim()}:${activeClientSecret.trim()}`).toString("base64");

    // Automatic silent OAuth token refresh via ContaAzul API
    let tokenRes = await fetch("https://auth.contaazul.com/oauth2/token", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: activeRefreshToken.trim()
      })
    });

    let tokenData = await tokenRes.json().catch(() => ({}));

    if (!tokenRes.ok || !tokenData.access_token) {
      tokenRes = await fetch("https://api.contaazul.com/oauth2/token", {
        method: "POST",
        headers: {
          "Authorization": `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: activeRefreshToken.trim()
        })
      });
      tokenData = await tokenRes.json().catch(() => ({}));
    }

    if (!tokenRes.ok || !tokenData.access_token) {
      return NextResponse.json(
        { 
          success: false, 
          error: tokenData.error_description || tokenData.error || "Não foi possível renovar o token silenciosamente." 
        },
        { status: 401 }
      );
    }

    const newAccess = tokenData.access_token;
    const newRefresh = tokenData.refresh_token || activeRefreshToken;

    // SAVE PERMANENTLY ON DISK!
    await saveContaAzulTokens({
      accessToken: newAccess,
      refreshToken: newRefresh,
      clientId: activeClientId,
      clientSecret: activeClientSecret
    });

    return NextResponse.json({
      success: true,
      access_token: newAccess,
      refresh_token: newRefresh,
      expires_in: tokenData.expires_in
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Erro na conexão de renovação." },
      { status: 500 }
    );
  }
}
