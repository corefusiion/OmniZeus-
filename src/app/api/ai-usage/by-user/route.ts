export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { readDb } from "@/lib/db/localDb";
import { getSession } from "@/lib/auth/session";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    const isSuperAdmin = session.role === "super_adm";
    const requestedCompanyId = req.headers.get("x-company-id");
    const companyId = isSuperAdmin && requestedCompanyId && requestedCompanyId !== "global"
      ? requestedCompanyId
      : (session.companyId || "comp_zenitus");

    // Gestor/super_adm enxergam todos; funcionário vê apenas o próprio consumo.
    const isGestor = session.role === "gestor" || session.role === "super_adm";
    const ownUserId = session.userId;

    const db = await readDb();
    const logs = Array.isArray(db.ai_usage_logs)
      ? db.ai_usage_logs.filter((l: any) => (l.company_id || l.companyId) === companyId)
      : [];

    // Nome dos colaboradores para exibição
    const emps = Array.isArray(db.employees) ? db.employees : [];
    const userNames = new Map<string, string>();
    emps.forEach((e: any) => {
      if (e.id) userNames.set(e.id, e.name || e.nome || e.email || "â€”");
      if (e.user_id) userNames.set(e.user_id, e.name || e.nome || e.email || "â€”");
    });

    const byKey = new Map<string, any>();
    logs.forEach((l: any) => {
      const uid = l.usuario_id || "desconhecido";
      if (!isGestor && uid !== ownUserId) return;
      const day = (l.created_at || "").slice(0, 10) || "â€”";
      const key = `${uid}::${day}`;
      const cur = byKey.get(key) || {
        usuario_id: uid,
        usuario_nome: userNames.get(uid) || (uid === ownUserId && !isGestor ? "Você" : uid),
        dia: day,
        interacoes: 0,
        coins: 0,
        tokens: 0,
        custo_brl: 0,
        funcionalidades: {} as Record<string, number>
      };
      cur.interacoes += 1;
      cur.coins += Number(l.omnicoins_consumed || l.coins_deducted || 0);
      cur.tokens += Number(l.total_tokens || l.tokens_used || l.input_tokens || 0) + Number(l.output_tokens || 0);
      cur.custo_brl += Number(l.custo_openrouter_brl || l.cost_brl || 0);
      const func = String(l.funcionalidade || "Outros");
      cur.funcionalidades[func] = (cur.funcionalidades[func] || 0) + 1;
      byKey.set(key, cur);
    });

    const rows = Array.from(byKey.values()).sort((a, b) => b.dia.localeCompare(a.dia) || b.interacoes - a.interacoes);

    // Totais globais (respeitando a visibilidade)
    const totals = rows.reduce(
      (acc, r) => ({
        interacoes: acc.interacoes + r.interacoes,
        coins: acc.coins + r.coins,
        tokens: acc.tokens + r.tokens,
        custo_brl: acc.custo_brl + r.custo_brl
      }),
      { interacoes: 0, coins: 0, tokens: 0, custo_brl: 0 }
    );

    return NextResponse.json({
      scope: isGestor ? "all" : "self",
      rows,
      totals
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

