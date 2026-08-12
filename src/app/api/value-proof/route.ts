export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { readDb } from "@/lib/db/localDb";
import { getSession } from "@/lib/auth/session";

export const runtime = "edge";

// Estimativas conservadoras de tempo economizado por interação de IA,
// baseadas na natureza da ação (metodologia "lente do tempo").
// São premissas parametrizáveis — o valor final é ajustado pela confiança.
function estimateMinutesPerAction(funcionalidade: string, tipoOperacao: string): number {
  const f = String(funcionalidade || "").toLowerCase();
  const t = String(tipoOperacao || "").toLowerCase();

  // Dados sintéticos não representam trabalho real economizado
  if (f.includes("simulação") || f.includes("simulacao") || f.includes("sintético") || f.includes("sintetico")) return 0;

  if (f.includes("extração") || f.includes("extracao") || f.includes("document")) return 20;
  if (f.includes("auto-resposta") || f.includes("solicitação") || f.includes("solicitacao") || f.includes("aprov") || f.includes("reprov")) return 20;
  if (f.includes("fluxo de caixa") || f.includes("cash-flow") || f.includes("projeção") || f.includes("projecao")) return 25;
  if (f.includes("resumo")) return 8;
  if (f.includes("pergunte") || f.includes("rag") || f.includes("sobre esta empresa")) return 12;
  if (f.includes("conta azul") || f.includes("ia-workspace") || f.includes("análise") || f.includes("analise")) return 18;
  if (f.includes("apresenta") || f.includes("relatório") || f.includes("relatorio") || f.includes("docx") || f.includes("imagem") || f.includes("imagem")) return 25;
  if (f.includes("agente") || f.includes("conversa") || f.includes("chat") || f.includes("omni")) return 15;

  if (t.includes("advanced") || t.includes("recomenda")) return 15;
  if (t.includes("document_analysis") || t.includes("sped") || t.includes("contaazul")) return 18;

  return 15;
}

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

    const isGestor = session.role === "gestor" || session.role === "super_adm";
    const ownUserId = session.userId;

    const url = new URL(req.url);
    const periodParam = url.searchParams.get("period") || "30";
    const days = periodParam === "year" ? 365 : Math.max(1, Math.min(365, Number(periodParam) || 30));
    const hourlyCost = Math.max(0, Number(url.searchParams.get("hourlyCost")) || 60);
    const confidence = Math.min(100, Math.max(30, Number(url.searchParams.get("confidence")) || 80));

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const db = await readDb();
    const allLogs = Array.isArray(db.ai_usage_logs)
      ? db.ai_usage_logs.filter((l: any) => (l.company_id || l.companyId) === companyId)
      : [];

    const logs = allLogs.filter((l: any) => {
      const ts = new Date(l.created_at || l.createdAt || 0).getTime();
      if (!ts || ts < cutoff.getTime()) return false;
      const uid = l.usuario_id || l.userId || "desconhecido";
      if (!isGestor && uid !== ownUserId) return false;
      return true;
    });

    const byFunc = new Map<string, any>();
    for (const l of logs) {
      const func = String(l.funcionalidade || l.functionality || "Uso de IA");
      const minsPer = estimateMinutesPerAction(func, l.tipo_operacao || "STANDARD");
      if (minsPer <= 0) continue;
      const cur = byFunc.get(func) || {
        funcionalidade: func,
        tipo_operacao: String(l.tipo_operacao || "OUTROS"),
        interacoes: 0,
        minutos: 0,
        coins: 0,
        custo_brl: 0
      };
      cur.interacoes += 1;
      cur.minutos += minsPer;
      cur.coins += Number(l.omnicoins_consumed || l.coins_deducted || 0);
      cur.custo_brl += Number(l.custo_openrouter_brl || l.cost_brl || 0);
      byFunc.set(func, cur);
    }

    const byFunctionality = Array.from(byFunc.values()).sort((a, b) => b.minutos - a.minutos);
    const totalInteracoes = byFunctionality.reduce((s, r) => s + r.interacoes, 0);
    const totalMinutos = byFunctionality.reduce((s, r) => s + r.minutos, 0);
    const totalHoras = totalMinutos / 60;
    const totalCoins = byFunctionality.reduce((s, r) => s + r.coins, 0);
    const totalCusto = byFunctionality.reduce((s, r) => s + r.custo_brl, 0);
    const valorBase = totalHoras * hourlyCost;
    const valorAjustado = valorBase * (confidence / 100);

    const rows = byFunctionality.map((r) => ({
      ...r,
      horas: parseFloat((r.minutos / 60).toFixed(2)),
      valor_base: r.minutos / 60 * hourlyCost,
      valor_ajustado: (r.minutos / 60 * hourlyCost) * (confidence / 100)
    }));

    return NextResponse.json({
      period: days,
      hourlyCost,
      confidence,
      scope: isGestor ? "all" : "self",
      totals: {
        interacoes: totalInteracoes,
        minutos: totalMinutos,
        horas: parseFloat(totalHoras.toFixed(2)),
        valor_base: parseFloat(valorBase.toFixed(2)),
        valor_ajustado: parseFloat(valorAjustado.toFixed(2)),
        coins: totalCoins,
        custo_brl: parseFloat(totalCusto.toFixed(2))
      },
      byFunctionality: rows
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}