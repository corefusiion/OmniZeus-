"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { 
  Sparkles, 
  DollarSign, 
  MessageSquare, 
  CheckSquare, 
  FileText, 
  Presentation, 
  TrendingUp, 
  Clock, 
  ArrowUpRight,
  Zap,
  CheckCircle2,
  Users,
  Building2,
  Download,
  Search,
  ArrowUp,
  ChevronRight,
  BarChart3,
  PieChart as PieChartIcon,
  ShieldCheck,
  FileCheck,
  TrendingDown,
  Coins,
  AlertTriangle,
  UserCheck,
  BrainCircuit,
  Wallet
} from "lucide-react";
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  Legend, 
  LineChart, 
  Line, 
  PieChart, 
  Pie, 
  Cell 
} from "recharts";
import { getActiveRole, UserRole } from "@/lib/auth/roles";
import AiUsageByUser from "@/components/dashboard/AiUsageByUser";
import ValueProof from "@/components/dashboard/ValueProof";
import { 
  fetchPayables, 
  fetchContracts, 
  fetchPurchaseRequests, 
  fetchTasks, 
  fetchContaAzulClients,
  fetchContaAzulEntries,
  fetchAIUsageLogs,
  fetchEmployees,
  fetchCompanies
} from "@/lib/db/serverDb";

const quickActions = [
  { title: "Hub Omni IA", desc: "Modelos LLMs organizados para análises fiscais e contábeis.", href: "/omni-ia", icon: Sparkles },
  { title: "Financeiro & Coins", desc: "Gestão completa de pagáveis e balancetes do escritório.", href: "/financeiro", icon: DollarSign },
  { title: "Solicitações & Compras", desc: "Central de aprovações de verba, suprimentos e recursos.", href: "/solicitacoes", icon: FileCheck },
  { title: "WhatsApp Bot & Kanban", desc: "Atendimento multi-setor automatizado com IA.", href: "/whatsapp-bot", icon: MessageSquare },
  { title: "Tarefas Operacionais", desc: "Controle de tempo e resolução assistida por IA.", href: "/tarefas", icon: CheckSquare },
  { title: "Gerador de Documentos", desc: "Criação instantânea de propostas e minutas em PDF.", href: "/documentos", icon: FileText },
];

function formatBRL(v: number) {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
}

function formatInt(v: number) {
  return v.toLocaleString('pt-BR');
}

type PeriodKey = "7" | "15" | "30" | "60" | "90" | "ano" | "todos";

const PERIOD_OPTIONS: { key: PeriodKey; label: string }[] = [
  { key: "7", label: "7 dias" },
  { key: "15", label: "15 dias" },
  { key: "30", label: "30 dias" },
  { key: "60", label: "60 dias" },
  { key: "90", label: "90 dias" },
  { key: "ano", label: "Este ano" },
  { key: "todos", label: "Todo período" }
];

function withinPeriod(dateStr: string | undefined | null, period: PeriodKey): boolean {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return false;
  if (period === "todos") return true;

  const now = new Date();
  if (period === "ano") {
    return date.getFullYear() === now.getFullYear();
  }
  const days = Number(period);
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return date >= cutoff;
}

export default function DashboardPage() {
  const [role, setRole] = useState<UserRole>("gestor");
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodKey>("30");
  const rawDataRef = useRef<any>(null);
  const [tasksCount, setTasksCount] = useState<number>(0);
  const [tasksTotal, setTasksTotal] = useState<number>(0);
  const [payablesCount, setPayablesCount] = useState<number>(0);
  const [payablesSum, setPayablesSum] = useState<number>(0);
  const [overdueCount, setOverdueCount] = useState<number>(0);
  const [overdueValue, setOverdueValue] = useState<number>(0);
  const [compliancePct, setCompliancePct] = useState<number>(100);
  const [contractsCount, setContractsCount] = useState<number>(0);
  const [contractsMrr, setContractsMrr] = useState<number>(0);
  const [requestsCount, setRequestsCount] = useState<number>(0);
  const [pendingReqCount, setPendingReqCount] = useState<number>(0);
  const [pendingReqValue, setPendingReqValue] = useState<number>(0);
  const [approvedReqCount, setApprovedReqCount] = useState<number>(0);
  const [approvedReqValue, setApprovedReqValue] = useState<number>(0);
  const [urgentReqCount, setUrgentReqCount] = useState<number>(0);
  const [employeesCount, setEmployeesCount] = useState<number>(0);
  const [coinsBalance, setCoinsBalance] = useState<number>(0);
  const [coinsConsumed, setCoinsConsumed] = useState<number>(0);
  const [tokensUsed, setTokensUsed] = useState<number>(0);
  const [aiInteractions, setAiInteractions] = useState<number>(0);
  const [topAgents, setTopAgents] = useState<any[]>([]);
  const [hubData, setHubData] = useState<any[]>([]);

  // Analytics Chart Data state
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [requestStatusData, setRequestStatusData] = useState<any[]>([]);
  const [contaAzulClients, setContaAzulClients] = useState<any[]>([]);
  const [contaAzulEntries, setContaAzulEntries] = useState<any[]>([]);
  const [caPayableTotal, setCaPayableTotal] = useState<number>(0);
  const [caReceivableTotal, setCaReceivableTotal] = useState<number>(0);
  const [caPaidTotal, setCaPaidTotal] = useState<number>(0);
  const [caPendingCount, setCaPendingCount] = useState<number>(0);

  const applyPeriodToData = (
    payables: any[], contracts: any[], requests: any[], tasks: any[],
    aiLogs: any[], employees: any[], companies: any[], caEntries: any[]
  ) => {
    // KPI Contas a Pagar (obrigações dentro do período)
    const periodPayables = payables.filter((p: any) =>
      withinPeriod(p.due_date || p.vencimento || p.created_at, period)
    );
    const totalPayablesSum = periodPayables.reduce((acc: number, item: any) => acc + (item.valor || item.value_brl || 0), 0);
    setPayablesCount(periodPayables.length);
    setPayablesSum(totalPayablesSum);

    // Contas vencidas (sempre totais, independente do período)
    const overduePayables = payables.filter((p: any) => {
      const s = (p.status || "").toLowerCase();
      return s === "vencido" || s === "vencida" || s === "atrasado" || s === "atrasada";
    });
    const overdueVal = overduePayables.reduce((acc: number, p: any) => acc + (p.value_brl || p.valor || 0), 0);
    setOverdueCount(overduePayables.length);
    setOverdueValue(overdueVal);

    // Compliance & SLA dinâmico (% de obrigações em dia)
    const compliancePct = totalPayablesSum > 0
      ? Math.round(Math.max(0, (totalPayablesSum - overdueVal) / totalPayablesSum) * 100)
      : 100;
    setCompliancePct(compliancePct);

    // Tarefas em aberto (Pendente + Em Andamento)
    const openTasks = tasks.filter((t: any) => {
      const s = (t.status || "").toLowerCase();
      return s === "pendente" || s.includes("andamento");
    });
    setTasksCount(openTasks.length);
    setTasksTotal(tasks.length);

    // Contratos ativos + MRR somente de contratos Ativos
    const activeContracts = contracts.filter((c: any) => (c.status || "").toLowerCase() === "ativo");
    const activeMrr = activeContracts.reduce((acc: number, c: any) => acc + (c.monthly_fee_brl || c.monthlyFeeBrl || 0), 0);
    setContractsCount(activeContracts.length);
    setContractsMrr(activeMrr);

    // Solicitações
    setRequestsCount(requests.length);
    const pendingReqs = requests.filter((r: any) => (r.status || "").toLowerCase() === "pendente");
    setPendingReqCount(pendingReqs.length);
    setPendingReqValue(pendingReqs.reduce((acc: number, r: any) => acc + (r.amount_brl || r.amountBrl || r.value_brl || 0), 0));
    setUrgentReqCount(pendingReqs.filter((r: any) => (r.priority || "").toLowerCase() === "urgente").length);

    // Aprovadas
    const approvedReqs = requests.filter((r: any) => {
      const s = (r.status || "").toLowerCase();
      return s === "aprovado" || s === "aprovada";
    });
    setApprovedReqCount(approvedReqs.length);
    setApprovedReqValue(approvedReqs.reduce((acc: number, r: any) => acc + (r.amount_brl || r.amountBrl || r.value_brl || 0), 0));

    // Colaboradores
    setEmployeesCount(employees.length);

    // OmniCoins & IA
    const coinsConsumedSum = aiLogs.reduce((acc: number, l: any) => acc + (l.coins_deducted || 0), 0);
    const tokensUsedSum = aiLogs.reduce((acc: number, l: any) => acc + (l.tokens_used || 0), 0);
    setCoinsConsumed(coinsConsumedSum);
    setTokensUsed(tokensUsedSum);
    setAiInteractions(aiLogs.length);

    const coinsBalanceSum = companies.reduce((acc: number, c: any) => acc + (c.coinsFranchise || c.coins_franchise || 0), 0);
    setCoinsBalance(coinsBalanceSum);

    // Top agentes por consumo de coins
    const agentMap = new Map<string, { coins: number; tokens: number; count: number }>();
    aiLogs.forEach((l: any) => {
      const name = (l.agent_name || l.agent || "Desconhecido").toString();
      const cur = agentMap.get(name) || { coins: 0, tokens: 0, count: 0 };
      cur.coins += l.coins_deducted || 0;
      cur.tokens += l.tokens_used || 0;
      cur.count += 1;
      agentMap.set(name, cur);
    });
    setTopAgents(
      Array.from(agentMap.entries())
        .map(([name, v]) => ({ name, ...v }))
        .sort((a, b) => b.coins - a.coins)
        .slice(0, 6)
    );

    // Consumo por hub
    const hubMap = new Map<string, number>();
    aiLogs.forEach((l: any) => {
      const h = (l.hub_type || "outros").toString();
      hubMap.set(h, (hubMap.get(h) || 0) + (l.coins_deducted || 0));
    });
    setHubData(
      Array.from(hubMap.entries()).map(([name, value]) => ({
        name: name === "omni-ia" ? "Hub Omni IA" : name === "omni-contaazul-ia" ? "Conta Azul IA" : name,
        value
      }))
    );

    // Build Purchase Request Status breakdown (respeitando o período)
    const periodRequests = period === "todos" ? requests : requests.filter((r: any) =>
      withinPeriod(r.created_at, period)
    );
    const reqApproved = periodRequests.filter((r: any) => {
      const s = (r.status || "").toLowerCase();
      return s === "aprovado" || s === "aprovada";
    }).length;
    const reqPending = periodRequests.filter((r: any) => (r.status || "").toLowerCase() === "pendente").length;
    const reqOther = Math.max(0, periodRequests.length - reqApproved - reqPending);

    setRequestStatusData([
      { name: "Aprovadas", value: reqApproved, color: "#10B981" },
      { name: "Pendentes", value: reqPending, color: "#F59E0B" },
      { name: "Em Análise", value: reqOther, color: "#1E6FD9" }
    ]);

    // Build financial trend data based on selected period
    const trendPayables = period === "todos" ? payables : payables.filter((p: any) =>
      withinPeriod(p.due_date || p.vencimento || p.created_at, period)
    );
    const trendRequests = period === "todos" ? requests : requests.filter((r: any) =>
      withinPeriod(r.created_at, period)
    );
    const trendCaEntries = Array.isArray(caEntries) && period === "todos"
      ? caEntries
      : (Array.isArray(caEntries) ? caEntries.filter((e: any) =>
          withinPeriod(e.data_pagamento || e.data_vencimento || e.created_at, period)
        ) : []);

    const periodDays = period === "ano" ? 365 : period === "todos" ? 365 : Number(period);
    const buckets = period === "todos" || period === "ano" ? 6 : Math.min(6, Math.max(3, Math.round(periodDays / 5)));
    const sliceMs = (periodDays * 24 * 60 * 60 * 1000) / buckets;
    const endTime = Date.now();
    const startTime = endTime - (period === "todos" ? 365 : periodDays) * 24 * 60 * 60 * 1000;

    const isRevenueEntry = (e: any) => {
      const t = String(e.tipo || e.type || "").toUpperCase();
      return t.includes("RECEITA") || t.includes("RECEBER") || t.includes("ENTRADA");
    };

    const dynamicTrend = Array.from({ length: buckets }, (_, idx) => {
      const bucketStart = startTime + idx * sliceMs;
      const bucketEnd = idx === buckets - 1 ? endTime : startTime + (idx + 1) * sliceMs;

      const bucketPayables = trendPayables.reduce((acc: number, p: any) => {
        const dStr = p.due_date || p.vencimento || p.created_at || "";
        if (!dStr) return acc;
        const t = new Date(dStr).getTime();
        if (!isNaN(t) && t >= bucketStart && t <= bucketEnd) {
          return acc + Number(p.value_brl || p.valor || 0);
        }
        return acc;
      }, 0);

      const bucketReqs = trendRequests.reduce((acc: number, r: any) => {
        const dStr = r.created_at || "";
        if (!dStr) return acc;
        const t = new Date(dStr).getTime();
        if (!isNaN(t) && t >= bucketStart && t <= bucketEnd) {
          return acc + Number(r.amount_brl || r.amountBrl || r.value_brl || 0);
        }
        return acc;
      }, 0);

      // Caixa real do Conta Azul: receitas (recebidas) e despesas (pagas) no bucket
      let caReceita = 0;
      let caDespesa = 0;
      trendCaEntries.forEach((e: any) => {
        const dStr = e.data_pagamento || e.data_vencimento || e.created_at || "";
        if (!dStr) return;
        const t = new Date(dStr).getTime();
        if (isNaN(t) || t < bucketStart || t > bucketEnd) return;
        const v = Number(e.valor || e.value || 0);
        if (isRevenueEntry(e)) caReceita += v;
        else caDespesa += v;
      });

      // Receita: MRR contratado + receitas reais recebidas do Conta Azul
      const monthReceita = activeMrr + caReceita;
      // Despesas: pagáveis no período + despesas pagas reais do Conta Azul
      const monthDespesas = bucketPayables + caDespesa;
      const monthFluxo = monthReceita - monthDespesas;

      const d = new Date(bucketStart);
      const label = `${d.getDate()}/${d.getMonth() + 1}`;

      return {
        month: label,
        despesas: Math.round(monthDespesas),
        receita: Math.round(monthReceita),
        caReceita: Math.round(caReceita),
        caDespesa: Math.round(caDespesa),
        compras: Math.round(bucketReqs),
        fluxo: Math.round(monthFluxo)
      };
    });

    setMonthlyData(dynamicTrend);

    // Conta Azul financeiro
    if (Array.isArray(caEntries)) {
      const payableEntries = caEntries.filter((e: any) => {
        const s = (e.situacao || e.status || "").toLowerCase();
        return s !== "pago" && s !== "quitado" && s !== "paga";
      });
      const receivableEntries = caEntries.filter((e: any) => {
        const s = (e.situacao || e.status || "").toLowerCase();
        return s === "pago" || s === "quitado" || s === "paga";
      });
      const sumVal = (arr: any[]) => arr.reduce((acc: number, e: any) => acc + Number(e.valor || e.value || 0), 0);
      setCaPayableTotal(sumVal(payableEntries));
      setCaReceivableTotal(sumVal(receivableEntries));
      setCaPaidTotal(sumVal(caEntries.filter((e: any) => (e.situacao || e.status || "").toLowerCase() === "pago")));
      setCaPendingCount(payableEntries.length);
    }
  };

  useEffect(() => {
    setRole(getActiveRole());

    async function loadDashboardData() {
      setIsLoading(true);
      try {
        let [payables, contracts, requests, tasks, caClients, caEntries, aiLogs, employees, companies] = await Promise.all([
          fetchPayables(),
          fetchContracts(),
          fetchPurchaseRequests(),
          fetchTasks(),
          fetchContaAzulClients(),
          fetchContaAzulEntries(),
          fetchAIUsageLogs(),
          fetchEmployees(),
          fetchCompanies()
        ]);

        setContaAzulClients(caClients || []);
        setContaAzulEntries(caEntries || []);

        if (!payables) payables = [];
        if (!contracts) contracts = [];
        if (!requests) requests = [];
        if (!tasks) tasks = [];
        if (!aiLogs) aiLogs = [];
        if (!employees) employees = [];
        if (!companies) companies = [];

        rawDataRef.current = { payables, contracts, requests, tasks, aiLogs, employees, companies, caEntries };
        applyPeriodToData(payables, contracts, requests, tasks, aiLogs, employees, companies, caEntries);
      } catch (err) {
        console.error("Erro ao carregar dados analíticos do SQLite:", err);
      } finally {
        setIsLoading(false);
      }
    }

    loadDashboardData();

    const handleRoleChange = () => {
      setRole(getActiveRole());
      loadDashboardData();
    };
    const handleContextChange = () => {
      loadDashboardData();
    };

    window.addEventListener("omnizeus_role_change", handleRoleChange);
    window.addEventListener("omnizeus_company_context_change", handleContextChange);
    window.addEventListener("omnizeus_sql_db_change", handleContextChange);

    return () => {
      window.removeEventListener("omnizeus_role_change", handleRoleChange);
      window.removeEventListener("omnizeus_company_context_change", handleContextChange);
      window.removeEventListener("omnizeus_sql_db_change", handleContextChange);
    };
  }, []);

  // Recomputar KPIs/gráficos quando o período muda (sem refetch)
  useEffect(() => {
    const raw = rawDataRef.current;
    if (!raw) return;
    applyPeriodToData(raw.payables, raw.contracts, raw.requests, raw.tasks, raw.aiLogs, raw.employees, raw.companies, raw.caEntries);
  }, [period]);

  const handleExportPDF = () => {
    window.print();
  };

  const lastFluxo = monthlyData.length > 0 ? monthlyData[monthlyData.length - 1].fluxo : 0;
  const fluxoPositive = lastFluxo >= 0;
  const totalCoins = coinsBalance + coinsConsumed;
  const consumptionPct = totalCoins > 0 ? Math.min(100, Math.round((coinsConsumed / totalCoins) * 100)) : 0;

  const coinStats = [
    { icon: Wallet, label: "Saldo de Coins", value: formatInt(coinsBalance), sub: "franquia disponível", color: "text-emerald-600", bg: "bg-emerald-50" },
    { icon: Coins, label: "Coins Consumidas", value: formatInt(coinsConsumed), sub: `${consumptionPct}% da franquia`, color: "text-primary", bg: "bg-blue-50" },
    { icon: BrainCircuit, label: "Tokens de IA", value: formatInt(tokensUsed), sub: "processados pelos agentes", color: "text-violet-600", bg: "bg-violet-50" },
    { icon: Sparkles, label: "Interações de IA", value: formatInt(aiInteractions), sub: "consultas realizadas", color: "text-blue-600", bg: "bg-blue-50" },
  ];

  return (
    <div className="space-y-6 text-gray-900 font-sans">
      {/* Header Banner */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 lg:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl lg:text-2xl font-bold text-gray-900 tracking-tight">
              Dashboard Executivo
            </h1>
            <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 border border-gray-200 text-[10px] font-semibold uppercase tracking-wider">
              {role.replace('_', ' ')}
            </span>
          </div>
          <p className="text-xs lg:text-sm text-gray-500 mt-1">
            Visão geral de operações contábeis, obrigações tributárias e inteligência preditiva
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setPeriod(opt.key)}
                className={`px-2.5 py-1.5 text-[11px] font-semibold rounded-md transition-all whitespace-nowrap ${
                  period === opt.key
                    ? "bg-slate-900 text-white shadow-xs"
                    : "text-slate-500 hover:bg-slate-100"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button
            onClick={handleExportPDF}
            className="px-4 py-2 bg-white border border-gray-200 hover:border-gray-300 text-gray-800 text-xs font-medium rounded-lg flex items-center gap-2 transition-all"
          >
            <Download className="w-4 h-4 text-gray-500" />
            <span>Exportar Relatório (PDF)</span>
          </button>
        </div>
      </div>

      {/* Executive KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 - Contas a Pagar */}
        <div className="bg-slate-50/50 p-5 rounded-xl border border-slate-200/70 flex flex-col justify-between hover:border-slate-300 transition-all">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Contas a Pagar</span>
              <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900 tracking-tight">
              R$ {formatBRL(payablesSum)}
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-3">{payablesCount} obrigações a vencer no período</p>
        </div>

        {/* KPI 2 - Tarefas em Aberto */}
        <div className="bg-slate-50/50 p-5 rounded-xl border border-slate-200/70 flex flex-col justify-between hover:border-slate-300 transition-all">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Tarefas em Aberto</span>
              <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <CheckSquare className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900 tracking-tight">
              {tasksCount} Abertas
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-3">de {tasksTotal} tarefas no total</p>
        </div>

        {/* KPI 3 - Compliance & SLA */}
        <div className="bg-slate-50/50 p-5 rounded-xl border border-slate-200/70 flex flex-col justify-between hover:border-slate-300 transition-all">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Compliance & SLA</span>
              <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900 tracking-tight">
              {compliancePct}% Em Dia
            </div>
          </div>
          <p className={`text-[11px] mt-3 ${overdueCount > 0 ? "text-red-500 font-medium" : "text-slate-400"}`}>
            {overdueCount > 0 ? `${overdueCount} ${overdueCount === 1 ? "conta vencida" : "contas vencidas"} · R$ ${formatBRL(overdueValue)}` : "Sem pendências críticas"}
          </p>
        </div>

        {/* KPI 4 - Contratos Ativos */}
        <div className="bg-slate-50/50 p-5 rounded-xl border border-slate-200/70 flex flex-col justify-between hover:border-slate-300 transition-all">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Contratos Ativos</span>
              <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900 tracking-tight">
              {contractsCount} Contratos
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-3">MRR ativo: R$ {formatBRL(contractsMrr)}</p>
        </div>
      </div>

      {/* Alerts & Insights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Contas Vencidas */}
        <div className="bg-slate-50/50 p-5 rounded-xl border border-red-200 flex items-start justify-between hover:border-red-300 transition-all">
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-red-500">Contas Vencidas</span>
            <div className="text-2xl font-bold text-red-600 mt-1">
              {overdueCount} {overdueCount === 1 ? "Conta" : "Contas"}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">R$ {formatBRL(overdueValue)} em atraso</p>
          </div>
          <div className="w-8 h-8 rounded-lg bg-red-50 text-red-500 flex items-center justify-center">
            <AlertTriangle className="w-4 h-4" />
          </div>
        </div>

        {/* Solicitações em Aprovação */}
        <div className="bg-slate-50/50 p-5 rounded-xl border border-amber-200 flex items-start justify-between hover:border-amber-300 transition-all">
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-600">Solicitações em Aprovação</span>
            <div className="text-2xl font-bold text-amber-600 mt-1">
              {pendingReqCount} {pendingReqCount === 1 ? "Pendente" : "Pendentes"}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              R$ {formatBRL(pendingReqValue)} aguardando{urgentReqCount > 0 ? ` · ${urgentReqCount} ${urgentReqCount === 1 ? "urgente" : "urgentes"}` : ""}
            </p>
            <p className="text-[11px] text-slate-500 mt-1.5 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
              {approvedReqCount} aprovadas · R$ {formatBRL(approvedReqValue)} no período
            </p>
          </div>
          <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
            <FileCheck className="w-4 h-4" />
          </div>
        </div>

        {/* Colaboradores */}
        <div className="bg-slate-50/50 p-5 rounded-xl border border-blue-200 flex items-start justify-between hover:border-blue-300 transition-all">
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-600">Colaboradores</span>
            <div className="text-2xl font-bold text-blue-600 mt-1">
              {employeesCount} {employeesCount === 1 ? "Pessoa" : "Pessoas"}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">membros na empresa</p>
          </div>
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <UserCheck className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Modern Analytical Panel (Recharts) */}
      <div id="analytics-panel" className="print-only-panel bg-white rounded-xl border border-slate-200 p-5 lg:p-6 space-y-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              <span>Painel Analítico Executivo & Performance</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Métricas consolidadas (Contratos, Pagáveis, Solicitações e Caixa ContaAzul)
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1.5 font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-primary" /> Receita MRR
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Despesas Mensais
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Fluxo Líquido
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Chart 1: Evolução de Despesas Mensais (AreaChart) */}
          <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-200/70 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <TrendingDown className="w-4 h-4 text-amber-600" />
                Evolução de Despesas ({period === "todos" ? "Todo período" : `${period} dias`})
              </h3>
              <span className="text-[11px] font-semibold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                R$ {formatBRL(payablesSum)}
              </span>
            </div>
            <div className="h-[210px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorDespesas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#F59E0B" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#64748b" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                  <Tooltip
                    formatter={(value: any) => [`R$ ${Number(value).toLocaleString('pt-BR')}`, "Despesas"]}
                    contentStyle={{ backgroundColor: "#ffffff", borderColor: "#e2e8f0", borderRadius: "8px", fontSize: "12px" }}
                  />
                  <Area type="monotone" dataKey="despesas" stroke="#F59E0B" strokeWidth={2} fillOpacity={1} fill="url(#colorDespesas)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: Evolução de Solicitações de Compra & Status */}
          <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-200/70 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <FileCheck className="w-4 h-4 text-emerald-600" />
                Distribuição de Solicitações de Compra
              </h3>
              <span className="text-[11px] font-semibold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                Total: {requestsCount} Requisições
              </span>
            </div>
            <div className="h-[210px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={requestStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {requestStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: "#ffffff", borderColor: "#e2e8f0", borderRadius: "8px", fontSize: "12px" }}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: "11px" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 3: Receita (MRR) vs Despesas (BarChart) */}
          <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-200/70 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-primary" />
                Comparativo: Receita (MRR) vs Despesas
              </h3>
              <span className="text-[11px] font-semibold text-primary bg-white px-2 py-0.5 rounded border border-slate-200">
                MRR: R$ {formatBRL(contractsMrr)}
              </span>
            </div>
            <div className="h-[210px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#64748b" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                  <Tooltip
                    formatter={(value: any, name?: any) => [
                      `R$ ${Number(value).toLocaleString('pt-BR')}`,
                      name === "receita" ? "Receita MRR" : "Despesas"
                    ]}
                    contentStyle={{ backgroundColor: "#ffffff", borderColor: "#e2e8f0", borderRadius: "8px", fontSize: "12px" }}
                  />
                  <Bar dataKey="receita" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="despesas" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 4: Fluxo de Caixa & Resultado Líquido (LineChart) */}
          <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-200/70 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                Fluxo de Caixa Líquido (Resultado Operacional)
              </h3>
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${fluxoPositive ? "text-emerald-700 bg-emerald-50 border-emerald-200" : "text-red-700 bg-red-50 border-red-200"}`}>
                {fluxoPositive ? "Fluxo do Período Positivo" : "Fluxo do Período Negativo"}
              </span>
            </div>
            <div className="h-[210px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#64748b" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                  <Tooltip
                    formatter={(value: any) => [`R$ ${Number(value).toLocaleString('pt-BR')}`, "Resultado Líquido"]}
                    contentStyle={{ backgroundColor: "#ffffff", borderColor: "#e2e8f0", borderRadius: "8px", fontSize: "12px" }}
                  />
                  <Line type="monotone" dataKey="fluxo" stroke="#10B981" strokeWidth={3} dot={{ r: 4, fill: "#10B981" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* OmniCoins & IA Panel */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 lg:p-6 space-y-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Coins className="w-5 h-5 text-primary" />
              <span>OmniCoins & Inteligência Artificial</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Consumo da moeda interna e atividade dos agentes de IA
            </p>
          </div>
          <span className="text-xs text-slate-500 flex items-center gap-1.5 font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-primary" /> 1 Coin = R$ 0,10
          </span>
        </div>

        {/* Coins Mini KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {coinStats.map((stat, idx) => {
            const Icon = stat.icon;
            return (
              <div key={idx} className="bg-slate-50/50 p-4 rounded-xl border border-slate-200/70">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{stat.label}</span>
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${stat.bg} ${stat.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                </div>
                <div className={`text-2xl font-bold tracking-tight ${stat.color}`}>{stat.value}</div>
                <p className="text-[11px] text-slate-400 mt-1">{stat.sub}</p>
              </div>
            );
          })}
        </div>

        {/* Consumo da franquia */}
        <div>
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
            <span className="font-medium">Consumo da franquia de Coins</span>
            <span className="font-bold text-slate-700">{consumptionPct}%</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${consumptionPct}%` }} />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Agentes */}
          <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-200/70 space-y-3">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-primary" />
              Top Agentes por Consumo (Coins)
            </h3>
            {topAgents.length > 0 ? (
              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topAgents} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: "#64748b" }} />
                    <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11, fill: "#64748b" }} />
                    <Tooltip
                      formatter={(value: any) => [`${formatInt(Number(value))} coins`, "Coins"]}
                      contentStyle={{ backgroundColor: "#ffffff", borderColor: "#e2e8f0", borderRadius: "8px", fontSize: "12px" }}
                    />
                    <Bar dataKey="coins" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} barSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-xs text-slate-400">
                Sem dados de IA ainda
              </div>
            )}
          </div>

          {/* Consumo por Hub */}
          <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-200/70 space-y-3">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              Consumo por Hub de IA
            </h3>
            {hubData.length > 0 ? (
              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={hubData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="value"
                      nameKey="name"
                    >
                      {hubData.map((entry, index) => (
                        <Cell key={`hub-${index}`} fill={index === 0 ? "#1E6FD9" : "#10B981"} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: any) => [`${formatInt(Number(value))} coins`, "Coins"]}
                      contentStyle={{ backgroundColor: "#ffffff", borderColor: "#e2e8f0", borderRadius: "8px", fontSize: "12px" }}
                    />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: "11px" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-xs text-slate-400">
                Sem dados de IA ainda
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ContaAzul Insights */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 lg:p-6 space-y-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-600" />
              <span>Integração ContaAzul Pro</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Clientes e posição financeira sincronizados do ERP ContaAzul
            </p>
          </div>
          <Link href="/contaazul" className="text-xs text-blue-600 font-semibold hover:underline flex items-center gap-1">
            Ver Detalhes <ArrowUpRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-200/70">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Clientes Sincronizados</span>
              <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900 tracking-tight">{contaAzulClients.length}</div>
            <p className="text-[11px] text-slate-400 mt-1">no ERP sincronizado</p>
          </div>
          <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-200/70">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">A Receber (Abertos)</span>
              <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-emerald-600 tracking-tight">
              R$ {formatBRL(caReceivableTotal)}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">títulos quitados no período</p>
          </div>
          <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-200/70">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">A Pagar (Pendentes)</span>
              <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-amber-600 tracking-tight">
              R$ {formatBRL(caPayableTotal)}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">{caPendingCount} lançamentos em aberto</p>
          </div>
          <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-200/70">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Total Lançamentos</span>
              <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <Wallet className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900 tracking-tight">{contaAzulEntries.length}</div>
            <p className="text-[11px] text-slate-400 mt-1">títulos financeiros sincronizados</p>
          </div>
        </div>
      </div>

      {/* Prova de Valor (tempo e R$ economizados pela IA) */}
      <ValueProof />

      {/* Consumo de IA por colaborador (funcionário vê o próprio uso) */}
      <AiUsageByUser />

      {/* Grid of Productive Modules */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <Zap className="w-4 h-4 text-gray-700" />
            <span>Módulos de Produtividade</span>
          </h2>
          <span className="text-xs text-gray-400">6 Módulos Disponíveis</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {quickActions.map((action, idx) => {
            const Icon = action.icon;
            return (
              <Link
                key={idx}
                href={action.href}
                className="bg-white p-5 rounded-xl border border-gray-200 hover:border-gray-400 transition-all group flex flex-col justify-between"
              >
                <div>
                  <div className="w-8 h-8 rounded-lg bg-gray-50 text-gray-800 flex items-center justify-center border border-gray-200 mb-3">
                    <Icon className="w-4 h-4" strokeWidth={1.5} />
                  </div>
                  <h3 className="text-sm font-semibold text-gray-900 group-hover:text-black transition-colors">
                    {action.title}
                  </h3>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                    {action.desc}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs font-medium text-gray-600 group-hover:text-black">
                  <span>Acessar Módulo</span>
                  <ArrowUpRight className="w-4 h-4" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
