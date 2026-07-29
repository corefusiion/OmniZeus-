import { NextResponse } from "next/server";
import { getContaAzulTokens, saveContaAzulTokens } from "@/lib/contaazul/store";

export async function GET() {
  try {
    const tokens = getContaAzulTokens();
    return NextResponse.json({
      success: true,
      isConnected: !!(tokens.accessToken && tokens.refreshToken),
      clientId: tokens.clientId,
      hasAccessToken: !!tokens.accessToken,
      hasRefreshToken: !!tokens.refreshToken,
      updatedAt: tokens.updatedAt
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const updated = saveContaAzulTokens(body);
    return NextResponse.json({ success: true, tokens: updated });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
