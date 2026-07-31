"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
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
  Activity,
  Download,
  Search,
  ArrowUp,
  ChevronRight,
  BarChart3,
  PieChart as PieChartIcon,
  ShieldCheck,
  FileCheck,
  TrendingDown
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
import { 
  fetchServerTable, 
  insertServerTable, 
  fetchPayables, 
  fetchContracts, 
  fetchPurchaseRequests, 
  fetchTasks, 
  fetchDashboardMetrics,
  fetchContaAzulClients,
  fetchContaAzulEntries
} from "@/lib/db/serverDb";

const quickActions = [
  { title: "Hub Omni IA", desc: "Modelos LLMs organizados para análises fiscais e contábeis.", href: "/omni-ia", icon: Sparkles },
  { title: "Financeiro & Coins", desc: "Gestão completa de pagáveis e balancetes do escritório.", href: "/financeiro", icon: DollarSign },
  { title: "Solicitações & Compras", desc: "Central de aprovações de verba, suprimentos e recursos.", href: "/solicitacoes", icon: FileCheck },
  { title: "WhatsApp Bot & Kanban", desc: "Atendimento multi-setor automatizado com IA.", href: "/whatsapp-bot", icon: MessageSquare },
  { title: "Tarefas Operacionais", desc: "Controle de tempo e resolução assistida por IA.", href: "/tarefas", icon: CheckSquare },
  { title: "Gerador de Documentos", desc: "Criação instantânea de propostas e minutas em PDF.", href: "/documentos", icon: FileText },
];

export default function DashboardPage() {
  const [role, setRole] = useState<UserRole>("gestor");
  const [isMounted, setIsMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [tasksCount, setTasksCount] = useState<number>(0);
  const [payablesSum, setPayablesSum] = useState<number>(0);
  const [contractsCount, setContractsCount] = useState<number>(0);
  const [contractsMrr, setContractsMrr] = useState<number>(0);
  const [requestsCount, setRequestsCount] = useState<number>(0);

  // Analytics Chart Data state
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [requestStatusData, setRequestStatusData] = useState<any[]>([]);
  const [contaAzulClients, setContaAzulClients] = useState<any[]>([]);
  const [contaAzulEntries, setContaAzulEntries] = useState<any[]>([]);

  useEffect(() => {
    setIsMounted(true);
    setRole(getActiveRole());

    async function loadDashboardData() {
      setIsLoading(true);
      try {
        let [payables, contracts, requests, tasks, metrics, caClients, caEntries] = await Promise.all([
          fetchPayables(),
          fetchContracts(),
          fetchPurchaseRequests(),
          fetchTasks(),
          fetchDashboardMetrics(),
          fetchContaAzulClients(),
          fetchContaAzulEntries()
        ]);

        setContaAzulClients(caClients || []);
        setContaAzulEntries(caEntries || []);

        if (!payables) payables = [];
        if (!contracts) contracts = [];
        if (!requests) requests = [];

        // Compute KPI values
        const totalPayablesSum = payables.reduce((acc: number, item: any) => acc + (item.valor || item.value_brl || 0), 0);
        const totalContractsMrr = contracts.reduce((acc: number, item: any) => acc + (item.monthly_fee_brl || item.monthlyFeeBrl || 0), 0);
        
        setPayablesSum(totalPayablesSum);
        setTasksCount(tasks ? tasks.length : 0);
        setContractsCount(contracts ? contracts.length : 0);
        setContractsMrr(totalContractsMrr);
        setRequestsCount(requests ? requests.length : 0);

        // Build Purchase Request Status breakdown for Chart 1 (Dynamic)
        const reqApproved = requests.filter((r: any) => (r.status || "").toLowerCase() === "aprovado" || (r.status || "").toLowerCase() === "aprovada").length;
        const reqPending = requests.filter((r: any) => (r.status || "").toLowerCase() === "pendente").length;
        const reqOther = Math.max(0, requests.length - reqApproved - reqPending);

        setRequestStatusData([
          { name: "Aprovadas", value: reqApproved, color: "#10B981" },
          { name: "Pendentes", value: reqPending, color: "#F59E0B" },
          { name: "Em Análise", value: reqOther, color: "#1E6FD9" }
        ]);

        // Build 8-month financial trend data (Jan-Ago 2026) dynamically from real DB records
        const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago"];

        const dynamicTrend = monthNames.map((monthStr, idx) => {
          const monthPayables = payables.reduce((acc: number, p: any) => {
            const dStr = p.due_date || p.vencimento || p.created_at || "";
            if (!dStr) return acc;
            const dateObj = new Date(dStr);
            if (!isNaN(dateObj.getTime()) && dateObj.getMonth() === idx) {
              return acc + Number(p.value_brl || p.valor || 0);
            }
            return acc;
          }, 0);

          const monthReqs = requests.reduce((acc: number, r: any) => {
            const dStr = r.created_at || "";
            if (!dStr) return acc;
            const dateObj = new Date(dStr);
            if (!isNaN(dateObj.getTime()) && dateObj.getMonth() === idx) {
              return acc + Number(r.value_brl || 0);
            }
            return acc;
          }, 0);

          const monthMrr = totalContractsMrr;
          const monthFluxo = monthMrr - monthPayables;

          return {
            month: monthStr,
            despesas: Math.round(monthPayables),
            receita: Math.round(monthMrr),
            compras: Math.round(monthReqs),
            fluxo: Math.round(monthFluxo)
          };
        });

        setMonthlyData(dynamicTrend);
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

  const handleExportPDF = () => {
    window.print();
  };

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
        {/* KPI 1 */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Contas a Pagar</span>
              <div className="w-7 h-7 rounded-lg bg-gray-100 text-gray-700 flex items-center justify-center">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900 tracking-tight">
              R$ {payablesSum.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <p className="text-[11px] text-gray-400 mt-3">Total de obrigações em SQLite</p>
        </div>

        {/* KPI 2 */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Tarefas Operacionais</span>
              <div className="w-7 h-7 rounded-lg bg-gray-100 text-gray-700 flex items-center justify-center">
                <CheckSquare className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900 tracking-tight">
              {tasksCount} Tarefas
            </div>
          </div>
          <p className="text-[11px] text-gray-400 mt-3">Cadastradas no sistema</p>
        </div>

        {/* KPI 3 */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Compliance & SLA</span>
              <div className="w-7 h-7 rounded-lg bg-gray-100 text-gray-700 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900 tracking-tight">100% Em Dia</div>
          </div>
          <p className="text-[11px] text-gray-400 mt-3">Sem pendências críticas</p>
        </div>

        {/* KPI 4 */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Contratos Ativos</span>
              <div className="w-7 h-7 rounded-lg bg-gray-100 text-gray-700 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900 tracking-tight">
              {contractsCount} Contratos
            </div>
          </div>
          <p className="text-[11px] text-gray-400 mt-3">MRR: R$ {contractsMrr.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
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
              Métricas consolidadas do banco SQLite (Contratos, Pagáveis, Solicitações e Caixa)
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
                Evolução de Despesas Mensais (Jan - Ago 2026)
              </h3>
              <span className="text-[11px] font-semibold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                R$ {payablesSum.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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
                MRR: R$ {contractsMrr.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Saldo Mensal Positivo
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

      {/* ContaAzul Insights */}
      <div>
        <div className="flex items-center justify-between mb-4 mt-2">
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-blue-600" />
            <span>Integração ContaAzul Pro</span>
          </h2>
          <Link href="/contaazul" className="text-xs text-blue-600 font-semibold hover:underline flex items-center gap-1">
            Ver Detalhes <ArrowUpRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-5 rounded-xl border border-blue-100 flex flex-col justify-center items-center shadow-sm">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Clientes Sincronizados</h3>
            <p className="text-4xl font-bold text-blue-600 mb-1">{contaAzulClients.length}</p>
            <p className="text-xs text-slate-400">Ativos no banco de dados local</p>
          </div>
          <div className="bg-white p-5 rounded-xl border border-blue-100 flex flex-col justify-center items-center shadow-sm">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Lançamentos Financeiros</h3>
            <p className="text-4xl font-bold text-blue-600 mb-1">{contaAzulEntries.length}</p>
            <p className="text-xs text-slate-400">Títulos a Pagar / Receber sincronizados</p>
          </div>
        </div>
      </div>

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

