import { NextResponse, NextRequest } from "next/server";
import fs from "fs";
import path from "path";
import { getSession } from "@/lib/auth/session";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE_PATH = path.join(DATA_DIR, "omnizeus_local_sql_database.json");

function getDbData() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(DB_FILE_PATH)) {
      const defaultDb = { conversations: [], messages: [] };
      fs.writeFileSync(DB_FILE_PATH, JSON.stringify(defaultDb, null, 2), "utf-8");
      return defaultDb;
    }
    let raw = fs.readFileSync(DB_FILE_PATH, "utf-8");
    if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
    const parsed = JSON.parse(raw);
    if (!parsed.conversations) parsed.conversations = [];
    if (!parsed.messages) parsed.messages = [];
    return parsed;
  } catch (e) {
    return { conversations: [], messages: [] };
  }
}

function saveDbData(data: any) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(data, null, 2), "utf-8");
  } catch (e) {
    console.error("Error saving DB data:", e);
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = getSession(req);
    const { searchParams } = new URL(req.url);
    const superAdminOverride = searchParams.get("companyId") || req.headers.get("x-company-id");

    const userId = session?.userId || searchParams.get("userId") || "super_adm";
    const companyId = (session?.role === "super_adm" && superAdminOverride)
      ? superAdminOverride
      : (session?.companyId || superAdminOverride || "comp_zenitus");

    const db = getDbData();

    const filtered = (db.conversations || []).filter((c: any) => 
      (c.user_id === userId || session?.role === "super_adm") && 
      (c.company_id === companyId || !c.company_id) && 
      !c.deleted
    ).sort((a: any, b: any) => {
      if ((b.pinned ? 1 : 0) !== (a.pinned ? 1 : 0)) {
        return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
      }
      return new Date(b.last_message_at || b.updated_at).getTime() - new Date(a.last_message_at || a.updated_at).getTime();
    });

    return NextResponse.json({ success: true, conversations: filtered });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = getSession(req);
    const body = await req.json();
    const { title, model, provider } = body;
    
    const userId = session?.userId || body.userId || "super_adm";
    const companyId = session?.companyId || body.companyId || "comp_zenitus";
    const tenantId = body.tenantId || companyId;

    const db = getDbData();

    const convId = `conv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const newConv = {
      id: convId,
      tenant_id: tenantId,
      company_id: companyId,
      user_id: userId,
      title: title || "Nova Conversa BPO",
      model: model || "google/gemini-2.5-pro",
      provider: provider || "openrouter",
      created_at: now,
      updated_at: now,
      last_message_at: now,
      pinned: 0,
      archived: 0,
      deleted: 0
    };

    db.conversations.unshift(newConv);
    saveDbData(db);

    return NextResponse.json({ success: true, conversation: newConv });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, pinned } = await req.json();
    const db = getDbData();

    db.conversations = (db.conversations || []).map((c: any) => 
      c.id === id ? { ...c, pinned: pinned ? 1 : 0 } : c
    );
    saveDbData(db);

    return NextResponse.json({ success: true, message: "Status fixado atualizado." });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = getSession(req);
    const { searchParams } = new URL(req.url);
    const convId = searchParams.get("id");

    if (!convId) {
      return NextResponse.json({ success: false, error: "ID da conversa ausente." }, { status: 400 });
    }

    const db = getDbData();
    db.conversations = (db.conversations || []).map((c: any) => {
      if (c.id === convId) {
        // Only allow delete if owner or super_adm
        if (session && session.role !== "super_adm" && c.company_id && c.company_id !== session.companyId) {
          return c;
        }
        return { ...c, deleted: 1 };
      }
      return c;
    });
    db.messages = (db.messages || []).filter((m: any) => m.conversation_id !== convId);
    saveDbData(db);

    return NextResponse.json({ success: true, message: "Conversa excluída com sucesso." });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

