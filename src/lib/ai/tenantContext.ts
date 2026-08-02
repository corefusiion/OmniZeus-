// Contexto real do tenant para prompts de IA — "RAG leve" sobre o banco local.
// Monta um snapshot factual (números, nomes, status) das tabelas da empresa
// para que o modelo responda com dados VERDADEIROS, não alucinados.
// `allowedModules` (funcionário) restringe quais módulos entram no contexto —
// um funcionário sem acesso a financeiro nunca recebe dados financeiros.

import { readDb } from "@/lib/db/localDb";

export interface TenantContextOptions {
  companyId: string;
  allowedModules?: string[];
}

function hasModule(allowed: string[] | undefined, module: string): boolean {
  if (!allowed || allowed.length === 0) return true; // gestor/super_adm: tudo
  return allowed.includes(module);
}

function money(v: any): string {
  const n = Number(v);
  if (!Number.isFinite(n) || n === 0) return "";
  return ` R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Monta o contexto em texto puro (seco, factual) das tabelas do tenant.
 * Sempre inclui data/hora atual para cálculos de "hoje/vencido".
 */
export async function buildTenantContext(options: TenantContextOptions): Promise<string> {
  const db = await readDb();
  const companyId = options.companyId || "comp_zenitus";
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const parts: string[] = [];

  parts.push(`Data e hora atual: ${now.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} (horário de Brasília).`);
  parts.push(`Contexto da empresa (company_id: ${companyId}). Responda APENAS com base nos dados abaixo. Se o dado não existir, diga que não há registro.`);

  const company = Array.isArray(db.companies) ? db.companies.find((c: any) => c.id === companyId) : null;
  if (company) {
    parts.push(`Empresa: ${company.tradeName || company.corporateName || company.id}. Plano: ${company.plan || "—"}. Saldo de OmniCoins: ${(company.coins_franchise ?? company.coinsFranchise ?? 0)}.`);
  }

  // ── Financeiro (módulo: financeiro) ────────────────────────────────────────
  if (hasModule(options.allowedModules, "financeiro")) {
    if (Array.isArray(db.contracts)) {
      const contracts = db.contracts.filter((c: any) => (c.company_id || c.companyId) === companyId);
      const active = contracts.filter((c: any) => (c.status || "").toLowerCase() === "ativo");
      const totalMrr = active.reduce((s: number, c: any) => s + (Number(c.monthly_value) || Number(c.valor_mensal) || 0), 0);
      const expiringSoon = contracts.filter((c: any) => {
        const end = c.end_date || c.fim_vigencia || c.expires_at;
        if (!end) return false;
        const days = Math.ceil((new Date(end).getTime() - now.getTime()) / 86400000);
        return days >= 0 && days <= 30;
      });
      parts.push(`Contratos: ${contracts.length} no total, ${active.length} ativos (MRR ${money(totalMrr)}/mês). ${expiringSoon.length} com vencimento em até 30 dias.`);
    }

    if (Array.isArray(db.payables)) {
      const payables = db.payables.filter((p: any) => (p.company_id || p.companyId) === companyId);
      const open = payables.filter((p: any) => (p.status || "Pendente").toLowerCase() !== "pago");
      const dueToday = open.filter((p: any) => (p.due_date || p.vencimento || "").slice(0, 10) === today);
      const overdue = open.filter((p: any) => {
        const due = p.due_date || p.vencimento || "";
        return due.slice(0, 10) < today;
      });
      const overdueSum = overdue.reduce((s: number, p: any) => s + (Number(p.value) || Number(p.valor) || 0), 0);
      const dueTodaySum = dueToday.reduce((s: number, p: any) => s + (Number(p.value) || Number(p.valor) || 0), 0);
      const openSum = open.reduce((s: number, p: any) => s + (Number(p.value) || Number(p.valor) || 0), 0);
      parts.push(`Contas a pagar: ${open.length} em aberto (total ${money(openSum)}). Vencem hoje: ${dueToday.length} (${money(dueTodaySum)}). Vencidas: ${overdue.length} (${money(overdueSum)}).`);
    }

    if (Array.isArray(db.purchase_requests)) {
      const requests = db.purchase_requests.filter((r: any) => (r.company_id || r.companyId) === companyId);
      const pending = requests.filter((r: any) => (r.status || "Pendente").toLowerCase().includes("pend"));
      const pendingSum = pending.reduce((s: number, r: any) => s + (Number(r.amount) || Number(r.valor) || 0), 0);
      parts.push(`Solicitações: ${requests.length} no total, ${pending.length} pendentes (${money(pendingSum)}).`);
    }
  }

  // ── Tarefas (módulo: tarefas) ──────────────────────────────────────────────
  if (hasModule(options.allowedModules, "tarefas")) {
    if (Array.isArray(db.tasks)) {
      const tasks = db.tasks.filter((t: any) => (t.company_id || t.companyId) === companyId);
      const open = tasks.filter((t: any) => (t.status || "Pendente").toLowerCase() !== "concluída" && (t.status || "").toLowerCase() !== "concluida");
      const dueToday = open.filter((t: any) => (t.due_date || t.vencimento || "").slice(0, 10) === today);
      const overdue = open.filter((t: any) => (t.due_date || t.vencimento || "") && (t.due_date || t.vencimento || "").slice(0, 10) < today);
      parts.push(`Tarefas: ${tasks.length} no total, ${open.length} em aberto. Vencem hoje: ${dueToday.length}. Atrasadas: ${overdue.length}.`);
    }
  }

  // ── Conta Azul (módulo: contaazul) ─────────────────────────────────────────
  if (hasModule(options.allowedModules, "contaazul")) {
    if (Array.isArray(db.contaazul_clients)) {
      const clients = db.contaazul_clients.filter((c: any) => (c.company_id || c.companyId) === companyId);
      parts.push(`Clientes Conta Azul: ${clients.length} cadastrados.`);
    }
    if (Array.isArray(db.contaazul_entries)) {
      const entries = db.contaazul_entries.filter((e: any) => (e.company_id || e.companyId) === companyId);
      const receivable = entries.filter((e: any) => /RECEITA|RECEBER|ENTRADA/i.test(e.tipo || e.type || ""));
      const payable = entries.filter((e: any) => /DESPESA|PAGAR|SAIDA|PAGAMENTO/i.test(e.tipo || e.type || ""));
      const recSum = receivable.reduce((s: number, e: any) => s + (Number(e.valor) || Number(e.value) || 0), 0);
      const paySum = payable.reduce((s: number, e: any) => s + (Number(e.valor) || Number(e.value) || 0), 0);
      parts.push(`Lançamentos Conta Azul: ${entries.length} no total — ${receivable.length} a receber/entradas (${money(recSum)}), ${payable.length} a pagar/saídas (${money(paySum)}).`);
    }
  }

  // ── Equipe (sempre visível: não sensível) ──────────────────────────────────
  if (Array.isArray(db.employees)) {
    const emps = db.employees.filter((e: any) => (e.company_id || e.companyId) === companyId);
    const gestores = emps.filter((e: any) => e.role === "gestor").length;
    parts.push(`Equipe: ${emps.length} colaboradores (${gestores} gestor(es), ${emps.length - gestores} funcionário(s)).`);
  }

  return parts.join("\n");
}
