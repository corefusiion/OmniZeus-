export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getContaAzulTokens, saveContaAzulTokens } from "@/lib/contaazul/store";

export const runtime = "edge";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get("companyId") || req.headers.get("x-company-id") || "comp_techcontabil_01";
    const tokens = await getContaAzulTokens(companyId);

    return NextResponse.json({
      success: true,
      data: {
        clientId: tokens.clientId,
        clientSecret: tokens.clientSecret,
        redirectUri: tokens.redirectUri || "https://contaazul.com",
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        isConnected: !!tokens.accessToken,
        updatedAt: tokens.updatedAt
      }
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const targetCompanyId = body.companyId || body.company_id || req.headers.get("x-company-id") || "comp_techcontabil_01";
    
    const saved = await saveContaAzulTokens(targetCompanyId, {
      clientId: body.clientId || body.client_id,
      clientSecret: body.clientSecret || body.client_secret,
      accessToken: body.accessToken || body.access_token,
      refreshToken: body.refreshToken || body.refresh_token
    });

    return NextResponse.json({ success: true, data: saved });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
