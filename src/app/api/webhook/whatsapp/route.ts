export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { sqlDb } from "@/lib/db/sqlite";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { event, instance, data } = body;

    // Log event into local SQL database
    sqlDb.insert('whatsapp_logs', {
      id: `wlog_${Date.now()}`,
      chat_id: data?.key?.remoteJid || 'c1',
      sender: data?.pushName || 'Cliente WhatsApp',
      message: data?.message?.conversation || data?.message?.extendedTextMessage?.text || 'Mensagem enviada via WhatsApp',
      direction: data?.key?.fromMe ? 'outbound' : 'inbound',
      created_at: new Date().toISOString()
    });

    return NextResponse.json({
      status: "success",
      message: "Webhook registrado com sucesso no banco de dados local",
      event: event || "MESSAGES_UPSERT",
      instance: instance || "zenitus-whatsapp-prod"
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Erro no Webhook" }, { status: 400 });
  }
}

