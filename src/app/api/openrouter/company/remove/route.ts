import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

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
    const { companyId } = await req.json();

    if (!companyId) {
      return NextResponse.json({ error: "Identificador da empresa é obrigatório." }, { status: 400 });
    }

    const db = getLocalDb();
    if (!Array.isArray(db.companies)) db.companies = [];

    const compIndex = db.companies.findIndex((c: any) => c.id === companyId);
    const now = new Date().toISOString();

    if (compIndex >= 0) {
      db.companies[compIndex].openrouter_api_key = null;
      db.companies[compIndex].openrouter_key_status = 'master_fallback';
      db.companies[compIndex].updated_at = now;
    } else {
      return NextResponse.json({ error: "Empresa não encontrada." }, { status: 404 });
    }

    // Record Audit Log
    if (!Array.isArray(db.audit_logs)) db.audit_logs = [];
    db.audit_logs.unshift({
      id: `log_audit_${Date.now()}`,
      company_id: companyId,
      user_name: "Super Admin",
      action: "REMOVE_COMPANY_OPENROUTER_KEY",
      resource: `Empresa ${companyId}`,
      details: "Chave OpenRouter removida. Empresa revertida para a API Master (Fallback).",
      created_at: now
    });

    saveLocalDb(db);

    return NextResponse.json({
      success: true,
      message: "Chave removida. Empresa revertida para a API Master (Fallback).",
      status: 'master_fallback'
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
