export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { executeAIRequest } from "@/lib/ai/openRouterClient";
import { recordAIMetrics, estimateCostByFixedRates } from "@/lib/ai/metrics";
import { readDb } from "@/lib/db/localDb";
import { getSession } from "@/lib/auth/session";

export const runtime = "edge";

const PROJECT_MODEL = "anthropic/claude-3.7-sonnet";

function num(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function inDays(dateStr: string | undefined, now: Date, maxDays: number): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  const diff = d.getTime() - now.getTime();
  return diff >= 0 && diff <= maxDays * 86400000;
}

export async function GET(req: NextRequest) {
  const startTime = Date.now();
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

    const db = await readDb();
    const now = new Date();

    // â”€â”€ Base factual â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const contracts = Array.isArray(db.contracts)
      ? db.contracts.filter((c: any) => (c.company_id || c.companyId) === companyId && (c.status || "").toLowerCase() === "ativo")
      : [];
    const mrr = contracts.reduce((s: number, c: any) => s + (num(c.monthly_value) || num(c.valor_mensal) || num(c.monthly_fee_brl)), 0);

    const payablesAll = db.payables || [];
    const payables = Array.isArray(payablesAll)
      ? payablesAll.filter((p: any) => (p.company_id || p.companyId) === companyId && (p.status || "Pendente").toLowerCase() !== "pago")
      : [];

    const entriesAll = db.contaazul_entries || [];
    const entries = Array.isArray(entriesAll)
      ? entriesAll.filter((e: any) => (e.company_id || e.companyId) === companyId)
      : [];

    const isReceita = (e: any) => /RECEITA|RECEBER|ENTRADA/i.test(e.tipo || e.type || "");
    const isDespesa = (e: any) => /DESPESA|PAGAR|SAIDA|PAGAMENTO/i.test(e.tipo || e.type || "");
    const entryDate = (e: any) => e.data_pagamento || e.data_vencimento || e.created_at;

    // Saldo realizado (entradas pagas âˆ’ saídas pagas do Conta Azul)
    const realized = entries.filter((e: any) => {
      const s = (e.status || e.situacao || "").toLowerCase();
      return s.includes("pago") || s.includes("quitad") || s.includes("recebid");
    });
    const saldoInicial = realized.reduce(
      (s: number, e: any) => s + (isReceita(e) ? num(e.valor) : isDespesa(e) ? -num(e.valor) : 0),
      0
    );

    const buildWindow = (maxDays: number) => {
      let receitas = 0;
      let despesas = 0;

      // Receitas: MRR dos contratos ativos + recebíveis Conta Azul a vencer
      receitas += mrr * Math.min(maxDays / 30, 2);
      entries.forEach((e: any) => {
        if (isReceita(e) && inDays(entryDate(e), now, maxDays)) receitas += num(e.valor);
      });

      // Despesas: contas a pagar a vencer + saídas Conta Azul a vencer
      payables.forEach((p: any) => {
        const due = p.due_date || p.vencimento || "";
        if (inDays(due, now, maxDays)) despesas += (num(p.value_brl) || num(p.valor) || num(p.value));
      });
      entries.forEach((e: any) => {
        if (isDespesa(e) && inDays(entryDate(e), now, maxDays)) despesas += num(e.valor);
      });

      return { receitas, despesas, saldo: saldoInicial + receitas - despesas };
    };

    const p30 = buildWindow(30);
    const p60 = buildWindow(60);
    const deficit30 = p30.saldo < 0;
    const deficit60 = p60.saldo < 0;

    const facts = [
      `Saldo realizado (caixa já movimentado): R$ ${saldoInicial.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      `Projeção 30 dias: receitas R$ ${p30.receitas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}, despesas R$ ${p30.despesas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}, saldo projetado R$ ${p30.saldo.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} (${deficit30 ? "DEFICIT" : "POSITIVO"})`,
      `Projeção 60 dias: receitas R$ ${p60.receitas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}, despesas R$ ${p60.despesas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}, saldo projetado R$ ${p60.saldo.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} (${deficit60 ? "DEFICIT" : "POSITIVO"})`,
      `MRR contratos ativos: R$ ${mrr.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}/mês`,
      `${payables.length} contas a pagar em aberto, ${entries.length} lançamentos Conta Azul`
    ].join("\n");

    // â”€â”€ Análise IA (5 coins) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const systemPrompt = [
      "Você é o consultor financeiro interno da plataforma OmniZeus.",
      "Analise a projeção de fluxo de caixa abaixo e entregue: (1) leitura objetiva do cenário em 30 e 60 dias;",
      "(2) principais riscos de liquidez; (3) 2 a 4 recomendações práticas e acionáveis.",
      "Responda em português, direto, sem saudações, máximo 220 palavras.",
      "",
      "=== DADOS DA PROJEÃ‡ÃƒO ===",
      facts
    ].join("\n");

    let analysis = "";
    let aiUsed = false;
    const aiRes = await executeAIRequest({
      companyId,
      userRole: session.role,
      userEmail: session.email,
      requestedModel: PROJECT_MODEL,
      temperature: 0.3,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: "Gere a análise do fluxo de caixa projetado." }
      ],
      persona: "cash-flow",
      featureContext: "Fluxo de Caixa Projetado",
      skipAccounting: true
    });

    if (!aiRes.isError) {
      analysis = aiRes.content;
      aiUsed = true;
      const durationMs = Date.now() - startTime;
      const inT = aiRes.usage?.inputTokens ?? 0;
      const outT = aiRes.usage?.outputTokens ?? Math.round(analysis.length / 4);
      const { costUsd, costBrl } = estimateCostByFixedRates(inT, outT);
      await recordAIMetrics({
        companyId,
        userId: session.userId,
        model: aiRes.usage?.model || PROJECT_MODEL,
        functionality: "Fluxo de Caixa Projetado",
        operationType: "ADVANCED",
        agentId: "cash-flow",
        agentName: "Consultor de Fluxo de Caixa",
        coins: 5,
        inputTokens: inT,
        outputTokens: outT,
        reasoningTokens: aiRes.usage?.reasoningTokens,
        totalTokens: aiRes.usage?.totalTokens,
        costUsd,
        costBrl,
        latencyMs: durationMs
      });
    } else {
      analysis = [
        deficit30 || deficit60
          ? "A projeção indica risco de saldo negativo no período. Recomenda-se priorizar recebimentos, renegociar vencimentos de contas a pagar e revisar despesas variáveis."
          : "A projeção indica caixa positivo no período. Recomenda-se manter a disciplina de recebimentos e monitorar vencimentos das próximas semanas.",
        "Observação: análise automática gerada com base nos dados financeiros da empresa."
      ].join("\n");
    }

    return NextResponse.json({
      saldoInicial,
      projection30: p30,
      projection60: p60,
      mrr,
      analysis,
      aiUsed,
      model: aiUsed ? aiRes.usage?.model || PROJECT_MODEL : null
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

