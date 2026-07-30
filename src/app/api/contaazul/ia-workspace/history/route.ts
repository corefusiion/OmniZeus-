import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE_PATH = path.join(DATA_DIR, "omnizeus_local_sql_database.json");

function getLocalDbFile(): any {
  try {
    if (fs.existsSync(DB_FILE_PATH)) {
      return JSON.parse(fs.readFileSync(DB_FILE_PATH, "utf-8"));
    }
  } catch (e) {}
  return {};
}

function saveLocalDbFile(db: any): void {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(db, null, 2), "utf-8");
  } catch (err) {}
}

/**
 * GET /api/contaazul/ia-workspace/history
 * Lista conversas do workspace IA
 */
export async function GET(req: NextRequest) {
  try {
    const db = getLocalDbFile();
    const conversations = db.contaazul_ia_conversations || [];
    return NextResponse.json({ success: true, data: conversations });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/contaazul/ia-workspace/history
 * Cria ou atualiza uma conversa
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, conversation } = body;
    const db = getLocalDbFile();

    if (!Array.isArray(db.contaazul_ia_conversations)) {
      db.contaazul_ia_conversations = [];
    }

    if (action === "create") {
      const newConv = {
        id: conversation?.id || `conv_${Date.now()}`,
        title: conversation?.title || "Nova Consulta",
        isPinned: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messageCount: 0
      };
      db.contaazul_ia_conversations.unshift(newConv);
      saveLocalDbFile(db);
      return NextResponse.json({ success: true, conversation: newConv });
    }

    if (action === "update" && conversation?.id) {
      db.contaazul_ia_conversations = db.contaazul_ia_conversations.map((c: any) =>
        c.id === conversation.id ? { ...c, ...conversation, updatedAt: new Date().toISOString() } : c
      );
      saveLocalDbFile(db);
      return NextResponse.json({ success: true });
    }

    if (action === "delete" && conversation?.id) {
      db.contaazul_ia_conversations = db.contaazul_ia_conversations.filter(
        (c: any) => c.id !== conversation.id
      );
      // Também remover mensagens da conversa
      if (Array.isArray(db.contaazul_ia_messages)) {
        db.contaazul_ia_messages = db.contaazul_ia_messages.filter(
          (m: any) => m.conversation_id !== conversation.id
        );
      }
      saveLocalDbFile(db);
      return NextResponse.json({ success: true });
    }

    if (action === "pin" && conversation?.id) {
      db.contaazul_ia_conversations = db.contaazul_ia_conversations.map((c: any) =>
        c.id === conversation.id ? { ...c, isPinned: !c.isPinned } : c
      );
      saveLocalDbFile(db);
      return NextResponse.json({ success: true });
    }

    if (action === "get_messages" && conversation?.id) {
      const messages = (db.contaazul_ia_messages || []).filter(
        (m: any) => m.conversation_id === conversation.id
      );
      return NextResponse.json({ success: true, data: messages });
    }

    return NextResponse.json({ success: false, error: "Ação inválida." }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
