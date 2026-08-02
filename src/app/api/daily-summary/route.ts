export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { readDb } from "@/lib/db/localDb";
import { getSession } from "@/lib/auth/session";

export const runtime = "nodejs";

function hasModule(allowed: string[] | undefined, module: string): boolean {
  if (!allowed || allowed.length === 0) return true;
  return allowed.includes(module);
}

function money(v: number): string {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export async function GET(req: NextRequest) {
  try {
    const session = getSession(req);
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
    const today = now.toISOString().slice(0, 10);
    const allowed = session.allowedModules;

    const items: {
      module: string;
      title: string;
      tone: "ok" | "warn" | "danger";
      text: string;
    }[] = [];

    // ── Financeiro (solicitações também são módulo financeiro no menu) ─────
    if (hasModule(allowed, "financeiro")) {
      if (Array.isArray(db.payables)) {
        const payables = db.payables.filter((p: any) => (p.company_id || p.companyId) === companyId);
        const open = payables.filter((p: any) => (p.status || "Pendente").toLowerCase() !== "pago");
        const dueToday = open.filter((p: any) => (p.due_date || p.vencimento || "").slice(0, 10) === today);
        const dueTodaySum = dueToday.reduce((s: number, p: any) => s + (Number(p.value_brl) || Number(p.valor) || Number(p.value) || 0), 0);
        const overdue = open.filter((p: any) => {
          const due = p.due_date || p.vencimento || "";
          return due.slice(0, 10) < today;
        });
        const overdueSum = overdue.reduce((s: number, p: any) => s + (Number(p.value_brl) || Number(p.valor) || Number(p.value) || 0), 0);

        if (overdue.length > 0) {
          items.push({
            module: "financeiro",
            title: "Contas vencidas",
            tone: "danger",
            text: `${overdue.length} título(s) vencido(s) somando R$ ${money(overdueSum)}.`
          });
        }
        if (dueToday.length > 0) {
          items.push({
            module: "financeiro",
            title: "Vencem hoje",
            tone: "warn",
            text: `${dueToday.length} conta(s) vencem hoje — total de R$ ${money(dueTodaySum)}.`
          });
        }
      }

      if (Array.isArray(db.contracts)) {
        const contracts = db.contracts.filter((c: any) => (c.company_id || c.companyId) === companyId);
        const expiringSoon = contracts.filter((c: any) => {
          const end = c.end_date || c.fim_vigencia || c.expires_at;
          if (!end) return false;
          const days = Math.ceil((new Date(end).getTime() - now.getTime()) / 86400000);
          return days >= 0 && days <= 30;
        });
        if (expiringSoon.length > 0) {
          items.push({
            module: "financeiro",
            title: "Contratos expirando",
            tone: "warn",
            text: `${expiringSoon.length} contrato(s) com vigência terminando em até 30 dias.`
          });
        }
      }

      if (Array.isArray(db.purchase_requests)) {
        const requests = db.purchase_requests.filter((r: any) => (r.company_id || r.companyId) === companyId);
        const pending = requests.filter((r: any) => (r.status || "Pendente").toLowerCase().includes("pend"));
        const urgent = pending.filter((r: any) => (r.priority || "").toLowerCase() === "urgente");
        if (pending.length > 0) {
          items.push({
            module: "financeiro",
            title: "Solicitações pendentes",
            tone: urgent.length > 0 ? "warn" : "ok",
            text: `${pending.length} solicitação(ões) em aprovação${urgent.length > 0 ? `, ${urgent.length} urgente(s)` : ""}.`
          });
        }
      }
    }

    // ── Tarefas ─────────────────────────────────────────────────────────────
    if (hasModule(allowed, "tarefas")) {
      if (Array.isArray(db.tasks)) {
        const tasks = db.tasks.filter((t: any) => (t.company_id || t.companyId) === companyId);
        const open = tasks.filter((t: any) => {
          const s = (t.status || "Pendente").toLowerCase();
          return s !== "concluída" && s !== "concluida" && s !== "concluido";
        });
        const dueToday = open.filter((t: any) => (t.due_date || t.vencimento || "").slice(0, 10) === today);
        const overdue = open.filter((t: any) => {
          const due = t.due_date || t.vencimento || "";
          return due.slice(0, 10) < today;
        });
        if (overdue.length > 0) {
          items.push({
            module: "tarefas",
            title: "Tarefas atrasadas",
            tone: "danger",
            text: `${overdue.length} tarefa(s) atrasada(s) precisam de atenção.`
          });
        }
        if (dueToday.length > 0) {
          items.push({
            module: "tarefas",
            title: "Tarefas para hoje",
            tone: "warn",
            text: `${dueToday.length} tarefa(s) vencem hoje.`
          });
        }
        if (overdue.length === 0 && dueToday.length === 0 && open.length === 0) {
          items.push({
            module: "tarefas",
            title: "Tarefas",
            tone: "ok",
            text: "Nenhuma tarefa em aberto. Bom trabalho!"
          });
        }
      }
    }

    // ── Conta Azul ──────────────────────────────────────────────────────────
    if (hasModule(allowed, "contaazul")) {
      if (Array.isArray(db.contaazul_entries)) {
        const entries = db.contaazul_entries.filter((e: any) => (e.company_id || e.companyId) === companyId);
        const dueToday = entries.filter((e: any) => (e.data_pagamento || e.data_vencimento || "").slice(0, 10) === today);
        const recToday = dueToday.filter((e: any) => /RECEITA|RECEBER|ENTRADA/i.test(e.tipo || e.type || ""));
        const payToday = dueToday.filter((e: any) => /DESPESA|PAGAR|SAIDA|PAGAMENTO/i.test(e.tipo || e.type || ""));
        const recSum = recToday.reduce((s: number, e: any) => s + (Number(e.valor) || Number(e.value) || 0), 0);
        const paySum = payToday.reduce((s: number, e: any) => s + (Number(e.valor) || Number(e.value) || 0), 0);
        if (recToday.length > 0 || payToday.length > 0) {
          items.push({
            module: "contaazul",
            title: "Lançamentos Conta Azul hoje",
            tone: "warn",
            text: `${recToday.length} recebimento(s) (R$ ${money(recSum)}) e ${payToday.length} pagamento(s) (R$ ${money(paySum)}) para hoje.`
          });
        }
      }
    }

    // Sem pendências
    if (items.length === 0) {
      items.push({
        module: "geral",
        title: "Dia tranquilo",
        tone: "ok",
        text: "Nenhuma pendência para hoje. Tudo em dia!"
      });
    }

    return NextResponse.json({
      date: now.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", day: "numeric", month: "long" }),
      companyId,
      items
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

