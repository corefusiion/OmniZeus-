import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { maskApiKey } from "@/lib/ai/providerResolver";

export const runtime = "nodejs";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE_PATH = path.join(DATA_DIR, "omnizeus_local_sql_database.json");

function getLocalDb(): any {
  try {
    if (fs.existsSync(DB_FILE_PATH)) {
      return JSON.parse(fs.readFileSync(DB_FILE_PATH, "utf-8"));
    }
  } catch (e) {}
  return {};
}

function saveLocalDb(db: any): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(db, null, 2), "utf-8");
  } catch (err) {
    console.error("Error saving local DB file:", err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { companyId, apiKey } = await req.json();

    if (!companyId || !apiKey || apiKey.trim().length === 0) {
      return NextResponse.json({ error: "Empresa e chave de API são obrigatórias." }, { status: 400 });
    }

    const trimmedKey = apiKey.trim();

    // Perform live connection test first
    const testRes = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { "Authorization": `Bearer ${trimmedKey}` }
    });

    if (!testRes.ok) {
      const errText = await testRes.text();
      return NextResponse.json({ 
        error: `Falha no teste de conexão com a OpenRouter: ${testRes.status} ${testRes.statusText}`
      }, { status: 400 });
    }

    const testData = await testRes.json();
    const modelsCount = testData.data?.length || 0;

    const db = getLocalDb();
    if (!Array.isArray(db.companies)) db.companies = [];

    const compIndex = db.companies.findIndex((c: any) => c.id === companyId);
    const now = new Date().toISOString();

    if (compIndex >= 0) {
      db.companies[compIndex].openrouter_api_key = trimmedKey;
      db.companies[compIndex].openrouter_key_status = 'connected';
      db.companies[compIndex].openrouter_key_tested_at = now;
      db.companies[compIndex].updated_at = now;
    } else {
      return NextResponse.json({ error: "Empresa não encontrada." }, { status: 444 });
    }

    // Record Audit Log
    if (!Array.isArray(db.audit_logs)) db.audit_logs = [];
    db.audit_logs.unshift({
      id: `log_audit_${Date.now()}`,
      company_id: companyId,
      user_name: "Super Admin",
      action: "SAVE_COMPANY_OPENROUTER_KEY",
      resource: `Empresa ${companyId}`,
      details: `Chave OpenRouter cadastrada (Masked: ${maskApiKey(trimmedKey)})`,
      created_at: now
    });

    saveLocalDb(db);

    return NextResponse.json({
      success: true,
      maskedKey: maskApiKey(trimmedKey),
      status: 'connected',
      testedAt: now,
      modelsCount
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
