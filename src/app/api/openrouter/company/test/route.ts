import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getSession } from "@/lib/auth/session";

export const runtime = "nodejs";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE_PATH = path.join(DATA_DIR, "omnizeus_local_sql_database.json");

export async function POST(req: NextRequest) {
  try {
    const session = getSession(req);
    if (!session) {
      return NextResponse.json({ success: false, message: "Não autenticado." }, { status: 401 });
    }
    if (session.role !== "super_adm") {
      return NextResponse.json({ success: false, message: "Acesso negado." }, { status: 403 });
    }

    const { companyId, apiKey } = await req.json();

    let targetKey = apiKey;

    if (!targetKey && companyId) {
      if (fs.existsSync(DB_FILE_PATH)) {
        const db = JSON.parse(fs.readFileSync(DB_FILE_PATH, "utf-8"));
        const comp = (db.companies || []).find((c: any) => c.id === companyId);
        if (comp) targetKey = comp.openrouter_api_key;
      }
    }

    if (!targetKey || targetKey.trim().length === 0) {
      return NextResponse.json({ 
        success: false, 
        message: "Nenhuma chave OpenRouter informada para teste." 
      }, { status: 400 });
    }

    const startTime = Date.now();
    const res = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { "Authorization": `Bearer ${targetKey.trim()}` }
    });

    const latencyMs = Date.now() - startTime;

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({
        success: false,
        message: `🔴 Falha na conexão: HTTP ${res.status} - ${errText.substring(0, 100)}`,
        latencyMs
      }, { status: 400 });
    }

    const data = await res.json();
    const modelsCount = data.data?.length || 0;

    return NextResponse.json({
      success: true,
      message: `🟢 Conexão estabelecida com sucesso! ${modelsCount} modelos OpenRouter disponíveis.`,
      modelsCount,
      latencyMs,
      testedAt: new Date().toISOString()
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      message: `🔴 Erro técnico ao conectar com a OpenRouter: ${error.message}`
    }, { status: 500 });
  }
}
