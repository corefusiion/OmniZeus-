export const dynamic = "force-dynamic";
import { NextResponse, NextRequest } from "next/server";
import { getContaAzulTokens, saveContaAzulTokens } from "@/lib/contaazul/store";
import { supabase } from "@/lib/db/supabaseClient";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get("companyId") || req.headers.get("x-company-id") || "comp_zenitus";

    const tokens = await getContaAzulTokens(companyId);

    let lastSyncAt: string | null = null;
    let nextSyncAt: string | null = null;
    let lastLog: any = null;

    const { data: configs } = await supabase
      .from("contaazul_config")
      .select("*")
      .eq("company_id", companyId)
      .limit(1);
    
    if (configs && configs.length > 0) {
      lastSyncAt = configs[0].last_sync_at || null;
      nextSyncAt = configs[0].next_sync_at || null;
    }

    const { data: logs } = await supabase
      .from("contaazul_sync_logs")
      .select("*")
      .in("company_id", [companyId, "global"])
      .order("completed_at", { ascending: false })
      .limit(1);
    
    if (logs && logs.length > 0) {
      lastLog = logs[0];
    }

    return NextResponse.json({
      success: true,
      company_id: companyId,
      isConnected: !!(tokens.accessToken && tokens.refreshToken),
      clientId: tokens.clientId,
      hasAccessToken: !!tokens.accessToken,
      hasRefreshToken: !!tokens.refreshToken,
      updatedAt: tokens.updatedAt,
      lastSyncAt: lastSyncAt || tokens.updatedAt,
      nextSyncAt: nextSyncAt,
      lastLog: lastLog
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { companyId = "comp_zenitus", ...tokens } = body;
    const updated = await saveContaAzulTokens(companyId, tokens);
    return NextResponse.json({ success: true, company_id: companyId, tokens: updated });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

