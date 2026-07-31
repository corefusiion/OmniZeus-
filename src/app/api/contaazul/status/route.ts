import { NextResponse, NextRequest } from "next/server";
import { getContaAzulTokens, saveContaAzulTokens } from "@/lib/contaazul/store";
import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE_PATH = path.join(DATA_DIR, "omnizeus_local_sql_database.json");

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get("companyId") || req.headers.get("x-company-id") || "comp_zenitus";

    const tokens = getContaAzulTokens(companyId);

    let lastSyncAt: string | null = null;
    let nextSyncAt: string | null = null;
    let lastLog: any = null;

    if (fs.existsSync(DB_FILE_PATH)) {
      try {
        let raw = fs.readFileSync(DB_FILE_PATH, "utf-8");
        if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
        const dbData = JSON.parse(raw);

        if (Array.isArray(dbData.contaazul_config)) {
          const cfg = dbData.contaazul_config.find((c: any) => c.company_id === companyId);
          if (cfg) {
            lastSyncAt = cfg.last_sync_at || null;
            nextSyncAt = cfg.next_sync_at || null;
          }
        }

        if (Array.isArray(dbData.contaazul_sync_logs)) {
          lastLog = dbData.contaazul_sync_logs.find((l: any) => l.company_id === companyId || l.company_id === "global") || null;
        }
      } catch (e) {}
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
    const updated = saveContaAzulTokens(companyId, tokens);
    return NextResponse.json({ success: true, company_id: companyId, tokens: updated });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
