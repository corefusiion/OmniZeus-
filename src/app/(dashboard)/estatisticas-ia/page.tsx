"use client";

import { useState, useEffect, useMemo } from "react";
import { 
  Coins, Activity, BarChart2, Cpu, Bot, Sparkles, Filter, Search, 
  TrendingUp, Clock, AlertTriangle, CheckCircle2, ArrowUpRight, 
  ChevronLeft, ChevronRight, Layers, FileText, Zap, HelpCircle, RefreshCw, Inbox
} from "lucide-react";
import { 
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, 
  CartesianGrid, Tooltip, PieChart, Pie, Cell 
} from "recharts";
import { getActiveRole, UserRole } from "@/lib/auth/roles";
import { getCoinBalance } from "@/lib/coins/store";
import { fetchServerTable, fetchServerSettings } from "@/lib/db/serverDb";
import { getCompanies, CompanyProfile } from "@/lib/company/store";

export interface AIUsageLogEntry {
  id: string;
  company_id: string;
  usuario_id: string;
  agente_id: string;
  agente_nome: string;
  modelo: string;
  funcionalidade: string;
  tipo_operacao: 'STANDARD' | 'ADVANCED' | 'EXPERT' | 'CHAT' | 'DOCUMENT_A4' | 'EXECUTIVE_PRESENTATION' | 'DOCUMENT_ANALYSIS' | 'INFOGRAPHIC' | 'OTHER_AI_OPERATION' | string;
  input_tokens: number;
  output_tokens: number;
  reasoning_tokens: number;
  total_tokens: number;
  custo_openrouter_usd: number;
  custo_openrouter_brl: number;
  omnicoins_consumed: number;
  duracao_ms: number;
  status: 'SUCCESS' | 'INSUFFICIENT_FUNDS' | 'ERROR' | string;
  created_at: string;
}

export default function EstatisticasIAPage() {
  const [role, setRole] = useState<UserRole>("gestor");
  const [coinBalance, setCoinBalance] = useState<number>(14250);
  const [logs, setLogs] = useState<AIUsageLogEntry[]>([]);
  const [activeCompany, setActiveCompany] = useState<CompanyProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [chartPeriod, setChartPeriod] = useState<'7d' | '30d' | '90d' | '12m'>('30d');
  const [chartMetric, setChartMetric] = useState<'coins' | 'messages' | 'tokens'>('coins');
  const [distributionType, setDistributionType] = useState<'agentes' | 'modelos' | 'recursos' | 'modulos'>('modulos');
  
  // Table Filter & Search & Pagination
  const [searchQuery, setSearchQuery] = useState("");
  const [agentFilter, setAgentFilter] = useState("TODOS");
  const [modelFilter, setModelFilter] = useState("TODOS");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const loadData = async () => {
    setLoading(true);
    try {
      const companies = getCompanies();
      const currentComp = companies[0] || null;
      setActiveCompany(currentComp);

      const settings = await fetchServerSettings();
      if (settings && typeof settings.coins_balance === 'number') {
        setCoinBalance(settings.coins_balance);
      } else {
        setCoinBalance(getCoinBalance());
      }

      const rawLogs = await fetchServerTable('ai_usage_logs');
      if (Array.isArray(rawLogs)) {
        setLogs(rawLogs);
      } else {
        setLogs([]);
      }
    } catch (e) {
      console.error("Erro ao carregar métricas reais de IA:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setRole(getActiveRole());
    loadData();

    const handleRoleChange = () => setRole(getActiveRole());
    const handleCoinsChange = () => loadData();
    const handleCompChange = () => loadData();

    window.addEventListener("omnizeus_role_change", handleRoleChange);
    window.addEventListener("omnizeus_coins_change", handleCoinsChange);
    window.addEventListener("omnizeus_companies_change", handleCompChange);

    return () => {
      window.removeEventListener("omnizeus_role_change", handleRoleChange);
      window.removeEventListener("omnizeus_coins_change", handleCoinsChange);
      window.removeEventListener("omnizeus_companies_change", handleCompChange);
    };
  }, []);

  if (role === "funcionario") {
    return (
      <div className="p-6 text-center text-slate-500 font-medium">
        Acesso restrito a Gestores.
      </div>
    );
  }

  // Filter logs by active company
  const activeCompanyId = activeCompany?.id || "comp_zenitus";
  const companyLogs = useMemo(() => {
    return logs.filter(log => !log.company_id || log.company_id === activeCompanyId);
  }, [logs, activeCompanyId]);

  // Dynamic KPI Calculations from Real Database Logs
  const { todayCoins, monthlyCoins, totalMessages, activeAgentsCount } = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let tCoins = 0;
    let mCoins = 0;
    const uniqueAgents = new Set<string>();

    companyLogs.forEach(log => {
      const logDate = new Date(log.created_at || Date.now());
      const dateStr = logDate.toISOString().split("T")[0];
      const coins = log.omnicoins_consumed || 5;

      if (dateStr === todayStr) {
        tCoins += coins;
      }

      if (logDate.getMonth() === currentMonth && logDate.getFullYear() === currentYear) {
        mCoins += coins;
      }

      if (log.agente_nome || log.agente_id) {
        uniqueAgents.add(log.agente_nome || log.agente_id);
      }
    });

    return {
      todayCoins: tCoins,
      monthlyCoins: mCoins,
      totalMessages: companyLogs.length,
      activeAgentsCount: uniqueAgents.size
    };
  }, [companyLogs]);

  // Plan Franchise details
  const planFranchiseCoins = activeCompany?.coinsFranchise || (activeCompany?.plan === 'Business' ? 50000 : activeCompany?.plan === 'Premium' ? 15000 : 5000);
  const planPercentage = planFranchiseCoins > 0 ? Number(((monthlyCoins / planFranchiseCoins) * 100).toFixed(1)) : 0;
  const avgCostPerProcess = totalMessages > 0 ? parseFloat((monthlyCoins / totalMessages).toFixed(2)) : 0;

  // Dynamic Time Chart Aggregation (7d, 30d, 90d, 12m)
  const timeChartData = useMemo(() => {
    const daysCount = chartPeriod === '7d' ? 7 : chartPeriod === '30d' ? 30 : chartPeriod === '90d' ? 90 : 365;
    const result: { label: string; coins: number; messages: number; tokens: number }[] = [];
    const now = new Date();

    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateKey = d.toISOString().split("T")[0];
      const displayLabel = chartPeriod === '7d' 
        ? d.toLocaleDateString("pt-BR", { weekday: 'short' })
        : chartPeriod === '12m'
        ? d.toLocaleDateString("pt-BR", { month: 'short' })
        : `${d.getDate()}/${d.getMonth() + 1}`;

      let dayCoins = 0;
      let dayMsgs = 0;
      let dayTokens = 0;

      companyLogs.forEach(log => {
        const logDateStr = new Date(log.created_at || Date.now()).toISOString().split("T")[0];
        if (logDateStr === dateKey) {
          dayCoins += log.omnicoins_consumed || 5;
          dayMsgs += 1;
          dayTokens += log.total_tokens || 1000;
        }
      });

      result.push({
        label: displayLabel,
        coins: dayCoins,
        messages: dayMsgs,
        tokens: dayTokens
      });
    }

    // Collapse to 7-12 points for 30d/90d/12m readability
    if (chartPeriod === '30d') {
      return result.filter((_, idx) => idx % 4 === 0 || idx === result.length - 1);
    }
    if (chartPeriod === '90d' || chartPeriod === '12m') {
      return result.filter((_, idx) => idx % 10 === 0 || idx === result.length - 1);
    }

    return result;
  }, [companyLogs, chartPeriod]);

  // Dynamic Distributions (Agentes, Modelos, Recursos, Módulos)
  const { distributionAgents, distributionModels, distributionResources, distributionModules } = useMemo(() => {
    const agentMap: Record<string, { coins: number; calls: number }> = {};
    const modelMap: Record<string, { coins: number; calls: number; tokens: number }> = {};
    const resourceMap: Record<string, { coins: number; calls: number }> = {};

    let totalCoinsAll = 0;

    companyLogs.forEach(log => {
      const coins = log.omnicoins_consumed || 5;
      const agent = log.agente_nome || log.agente_id || "Especialista Fiscal BPO";
      const model = log.modelo || "google/gemini-2.5-pro";
      const resource = log.funcionalidade || "Consulta Chat IA";

      totalCoinsAll += coins;

      // Agent map
      if (!agentMap[agent]) agentMap[agent] = { coins: 0, calls: 0 };
      agentMap[agent].coins += coins;
      agentMap[agent].calls += 1;

      // Model map
      if (!modelMap[model]) modelMap[model] = { coins: 0, calls: 0, tokens: 0 };
      modelMap[model].coins += coins;
      modelMap[model].calls += 1;
      modelMap[model].tokens += log.total_tokens || 1000;

      // Resource map
      if (!resourceMap[resource]) resourceMap[resource] = { coins: 0, calls: 0 };
      resourceMap[resource].coins += coins;
      resourceMap[resource].calls += 1;
    });

    const formatPct = (val: number) => totalCoinsAll > 0 ? Math.round((val / totalCoinsAll) * 100) : 0;

    const agentsList = Object.entries(agentMap)
      .map(([name, data]) => ({ name, coins: data.coins, calls: data.calls, percentage: formatPct(data.coins) }))
      .sort((a, b) => b.coins - a.coins);

    const modelsList = Object.entries(modelMap)
      .map(([name, data]) => ({ name, coins: data.coins, calls: data.calls, tokens: data.tokens, percentage: formatPct(data.coins) }))
      .sort((a, b) => b.coins - a.coins);

    const resourcesList = Object.entries(resourceMap)
      .map(([name, data]) => ({ name, coins: data.coins, calls: data.calls, percentage: formatPct(data.coins) }))
      .sort((a, b) => b.coins - a.coins);

    const moduleMap: Record<string, { coins: number; calls: number }> = {
      "Chat IA": { coins: 0, calls: 0 },
      "Documentos A4": { coins: 0, calls: 0 },
      "Apresentações Executivas": { coins: 0, calls: 0 },
      "Análises Fiscais": { coins: 0, calls: 0 },
      "Outros": { coins: 0, calls: 0 }
    };

    companyLogs.forEach(log => {
      const coins = log.omnicoins_consumed || 5;
      const type = log.tipo_operacao || "CHAT";
      const func = (log.funcionalidade || "").toLowerCase();

      if (type === "DOCUMENT_A4" || func.includes("documento") || func.includes("minuta") || func.includes("pdf")) {
        moduleMap["Documentos A4"].coins += coins;
        moduleMap["Documentos A4"].calls += 1;
      } else if (type === "EXECUTIVE_PRESENTATION" || func.includes("deck") || func.includes("apresentação") || func.includes("slide")) {
        moduleMap["Apresentações Executivas"].coins += coins;
        moduleMap["Apresentações Executivas"].calls += 1;
      } else if (type === "ADVANCED" || func.includes("análise") || func.includes("sped") || func.includes("dre")) {
        moduleMap["Análises Fiscais"].coins += coins;
        moduleMap["Análises Fiscais"].calls += 1;
      } else if (type === "STANDARD" || func.includes("chat") || func.includes("consulta")) {
        moduleMap["Chat IA"].coins += coins;
        moduleMap["Chat IA"].calls += 1;
      } else {
        moduleMap["Outros"].coins += coins;
        moduleMap["Outros"].calls += 1;
      }
    });

    const moduleList = Object.entries(moduleMap)
      .map(([name, data]) => ({ name, coins: data.coins, calls: data.calls, percentage: formatPct(data.coins) }))
      .sort((a, b) => b.coins - a.coins);

    return {
      distributionAgents: agentsList,
      distributionModels: modelsList,
      distributionResources: resourcesList,
      distributionModules: moduleList
    };
  }, [companyLogs]);

  const currentDistributionData = 
    distributionType === 'modulos' ? distributionModules :
    distributionType === 'agentes' ? distributionAgents :
    distributionType === 'modelos' ? distributionModels : distributionResources;

  // Filtered History Table
  const filteredHistory = useMemo(() => {
    return companyLogs.filter(log => {
      const q = searchQuery.toLowerCase();
      const matchSearch = (log.funcionalidade || '').toLowerCase().includes(q) ||
                          (log.agente_nome || '').toLowerCase().includes(q) ||
                          (log.modelo || '').toLowerCase().includes(q);
      const matchAgent = agentFilter === 'TODOS' || (log.agente_nome || log.agente_id) === agentFilter;
      const matchModel = modelFilter === 'TODOS' || log.modelo === modelFilter;
      return matchSearch && matchAgent && matchModel;
    });
  }, [companyLogs, searchQuery, agentFilter, modelFilter]);

  // Reset page when filters or search change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, agentFilter, modelFilter]);

  const totalPages = Math.ceil(filteredHistory.length / itemsPerPage) || 1;
  const paginatedHistory = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredHistory.slice(start, start + itemsPerPage);
  }, [filteredHistory, currentPage, itemsPerPage]);

  return (
    <div className="space-y-6 text-slate-900 font-sans pb-12">
      {/* HEADER BANNER */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 lg:p-6 flex flex-col xl:flex-row xl:items-center justify-between gap-4 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
              🪙
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Consumo & Métricas IA — OMNICoins
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Painel de produção com medição real de consumo de Inteligência Artificial e transparência de OMNICoins (Empresa: <strong className="text-slate-800">{activeCompany?.tradeName || activeCompany?.corporateName || "Zenitus Inteligência Contábil"}</strong>)
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all disabled:opacity-50"
            title="Atualizar dados do servidor"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/80 px-4 py-2 rounded-xl flex items-center gap-3 shadow-2xs">
            <span className="text-2xl">🪙</span>
            <div>
              <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">Saldo Atual</span>
              <span className="text-lg font-extrabold text-amber-900 tracking-tight block">
                {coinBalance.toLocaleString('pt-BR')} <span className="text-xs font-semibold text-amber-700">Coins</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 1. PRIMEIRA LINHA — STRIP DE 5 KPIS DE CONSUMO REAIS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {/* KPI 1: Saldo de Coins */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:border-amber-400 transition-all">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">1. Saldo OMNICoins</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center text-xs font-bold">
              🪙
            </div>
          </div>
          <span className="text-xl font-bold text-amber-700 tracking-tight block">
            {coinBalance.toLocaleString('pt-BR')} Coins
          </span>
          <span className="text-[11px] text-emerald-600 font-semibold block mt-1 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Saldo real em conta
          </span>
        </div>

        {/* KPI 2: Consumo no Período */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:border-blue-400 transition-all">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">2. Consumo no Mês</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <TrendingUp className="w-3.5 h-3.5" strokeWidth={1.5} />
            </div>
          </div>
          <span className="text-xl font-bold text-slate-900 tracking-tight block">
            🪙 {monthlyCoins.toLocaleString('pt-BR')} <span className="text-xs text-slate-500 font-normal">Coins</span>
          </span>
          <span className="text-[11px] text-slate-500 font-medium block mt-1">
            Consumidos este mês
          </span>
        </div>

        {/* KPI 3: Consumo Hoje */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:border-purple-400 transition-all">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">3. Consumo Hoje</span>
            <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <Clock className="w-3.5 h-3.5" strokeWidth={1.5} />
            </div>
          </div>
          <span className="text-xl font-bold text-purple-700 tracking-tight block">
            🪙 {todayCoins.toLocaleString('pt-BR')} <span className="text-xs text-slate-500 font-normal">Coins</span>
          </span>
          <span className="text-[11px] text-slate-500 font-medium block mt-1">
            Consumidos hoje
          </span>
        </div>

        {/* KPI 4: Mensagens Processadas */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:border-emerald-400 transition-all">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">4. Processamentos</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Zap className="w-3.5 h-3.5" strokeWidth={1.5} />
            </div>
          </div>
          <span className="text-xl font-bold text-slate-900 tracking-tight block">
            {totalMessages.toLocaleString('pt-BR')} <span className="text-xs text-slate-500 font-normal">msgs</span>
          </span>
          <span className="text-[11px] text-slate-500 font-medium block mt-1">
            Operações processadas
          </span>
        </div>

        {/* KPI 5: Agentes Ativos */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:border-indigo-400 transition-all">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">5. Agentes Utilizados</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Bot className="w-3.5 h-3.5" strokeWidth={1.5} />
            </div>
          </div>
          <span className="text-xl font-bold text-slate-900 tracking-tight block">
            {activeAgentsCount} <span className="text-xs text-slate-500 font-normal">Agentes</span>
          </span>
          <span className="text-[11px] text-slate-500 font-medium block mt-1">
            Agentes acionados
          </span>
        </div>
      </div>

      {/* SEÇÃO 2: SEGUNDA LINHA — GRÁFICOS (GRID 50% / 50%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* GRÁFICO 1: EVOLUÇÃO DO CONSUMO DE COINS (50%) */}
        <div className="lg:col-span-6 bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                1. Consumo de OMNICoins no Tempo
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Agregação em tempo real dos registros de uso</p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Filter Period */}
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-[11px] font-semibold">
                {(['7d', '30d', '90d', '12m'] as const).map(p => (
                  <button
                    key={p}
                    onClick={() => setChartPeriod(p)}
                    className={`px-2 py-0.5 rounded-md transition-all ${chartPeriod === p ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    {p}
                  </button>
                ))}
              </div>

              {/* Toggle Metric */}
              <div className="flex items-center gap-1 bg-amber-50 border border-amber-200 p-0.5 rounded-lg text-[11px] font-semibold text-amber-900">
                <button
                  onClick={() => setChartMetric('coins')}
                  className={`px-2 py-0.5 rounded-md transition-all ${chartMetric === 'coins' ? 'bg-amber-600 text-white font-bold' : 'text-amber-700 hover:text-amber-900'}`}
                >
                  🪙 Coins
                </button>
                <button
                  onClick={() => setChartMetric('messages')}
                  className={`px-2 py-0.5 rounded-md transition-all ${chartMetric === 'messages' ? 'bg-amber-600 text-white font-bold' : 'text-amber-700 hover:text-amber-900'}`}
                >
                  Msgs
                </button>
                <button
                  onClick={() => setChartMetric('tokens')}
                  className={`px-2 py-0.5 rounded-md transition-all ${chartMetric === 'tokens' ? 'bg-amber-600 text-white font-bold' : 'text-amber-700 hover:text-amber-900'}`}
                >
                  Tokens
                </button>
              </div>
            </div>
          </div>

          <div className="h-64 w-full pt-2">
            {timeChartData.some(d => d.coins > 0 || d.messages > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timeChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorCoinsChart" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.35}/>
                      <stop offset="95%" stopColor="#F59E0B" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '8px', color: '#fff', fontSize: '11px' }}
                    formatter={(value: any) => [
                      chartMetric === 'coins' ? `🪙 ${value} Coins` :
                      chartMetric === 'messages' ? `${value} mensagens` : `${(Number(value)).toLocaleString('pt-BR')} tokens`,
                      'Consumo Real'
                    ]}
                  />
                  <Area 
                    type="monotone" 
                    dataKey={chartMetric} 
                    stroke="#F59E0B" 
                    strokeWidth={2.5} 
                    fillOpacity={1} 
                    fill="url(#colorCoinsChart)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                <Inbox className="w-8 h-8 text-slate-300 mb-2" />
                <p className="text-xs font-bold text-slate-700">Nenhum consumo registrado neste período.</p>
                <p className="text-[11px] text-slate-400 mt-1 max-w-xs">
                  Faça uma consulta no Omni IA Hub ou ContaAzul IA para gerar métricas em tempo real.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* GRÁFICO 2: ONDE ESTOU GASTANDO MEUS COINS? (50%) */}
        <div className="lg:col-span-6 bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                2. Onde Estou Gastando Meus Coins?
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Distribuição real por Agente, Modelo ou Recurso</p>
            </div>

            {/* Alternador: Módulos | Agentes | Modelos | Recursos */}
            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[11px] font-semibold">
              <button
                onClick={() => setDistributionType('modulos')}
                className={`px-2.5 py-0.5 rounded-md transition-all ${distributionType === 'modulos' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-500 hover:text-slate-800'}`}
              >
                Módulos
              </button>
              <button
                onClick={() => setDistributionType('agentes')}
                className={`px-2.5 py-0.5 rounded-md transition-all ${distributionType === 'agentes' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-500 hover:text-slate-800'}`}
              >
                Agentes
              </button>
              <button
                onClick={() => setDistributionType('modelos')}
                className={`px-2.5 py-0.5 rounded-md transition-all ${distributionType === 'modelos' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-500 hover:text-slate-800'}`}
              >
                Modelos
              </button>
              <button
                onClick={() => setDistributionType('recursos')}
                className={`px-2.5 py-0.5 rounded-md transition-all ${distributionType === 'recursos' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-500 hover:text-slate-800'}`}
              >
                Recursos
              </button>
            </div>
          </div>

          <div className="h-64 w-full pt-2">
            {currentDistributionData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart layout="vertical" data={currentDistributionData} margin={{ top: 5, right: 20, left: 30, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#64748B' }} axisLine={false} tickLine={false} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: '#334155', fontWeight: 600 }} axisLine={false} tickLine={false} width={120} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '8px', color: '#fff', fontSize: '11px' }}
                    formatter={(value: any) => [`🪙 ${value} Coins`, 'Consumo Real']}
                  />
                  <Bar dataKey="coins" radius={[0, 4, 4, 0]} barSize={16}>
                    {currentDistributionData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={['#1E6FD9', '#10B981', '#8B5CF6', '#F59E0B', '#64748B'][index % 5]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                <Inbox className="w-8 h-8 text-slate-300 mb-2" />
                <p className="text-xs font-bold text-slate-700">Sem dados de distribuição disponíveis.</p>
                <p className="text-[11px] text-slate-400 mt-1 max-w-xs">
                  Os gráficos de distribuição serão alimentados à medida que novas requisições forem realizadas.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SEÇÃO 3: RANKING DE AGENTES E MODELOS MAIS UTILIZADOS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* RANKING DE AGENTES (6 COLUNAS) */}
        <div className="lg:col-span-6 bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Bot className="w-4 h-4 text-blue-600" />
              <span>3. Agentes Mais Utilizados</span>
            </h3>
            <span className="text-[11px] font-semibold text-slate-400">Ranking Real por Consumo</span>
          </div>

          <div className="space-y-2.5 pt-1">
            {distributionAgents.length > 0 ? (
              distributionAgents.map((ag, idx) => (
                <div key={ag.name} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-[10px]">
                      {idx + 1}
                    </span>
                    <div>
                      <span className="font-bold text-slate-900 block">{ag.name}</span>
                      <span className="text-[10px] text-slate-400">{ag.percentage}% do consumo total de IA</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-extrabold text-amber-700 block">🪙 {ag.coins} Coins</span>
                    <span className="text-[10px] text-slate-500 font-medium">{ag.calls} requisição(ões)</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200">
                Nenhum agente acionado até o momento.
              </div>
            )}
          </div>
        </div>

        {/* RANKING DE MODELOS (6 COLUNAS) */}
        <div className="lg:col-span-6 bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Cpu className="w-4 h-4 text-purple-600" />
              <span>4. Modelos Mais Utilizados</span>
            </h3>
            <span className="text-[11px] font-semibold text-slate-400">Distribuição LLM Real</span>
          </div>

          <div className="space-y-3 pt-1">
            {distributionModels.length > 0 ? (
              distributionModels.map((m) => (
                <div key={m.name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-900 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-purple-600"></span>
                      {m.name}
                    </span>
                    <div className="flex items-center gap-3 text-right">
                      <span className="text-[10px] text-slate-500">{m.calls} chamadas</span>
                      <span className="font-extrabold text-amber-700">🪙 {m.coins} Coins</span>
                    </div>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden flex">
                    <div 
                      className="h-full bg-purple-600 rounded-full transition-all"
                      style={{ width: `${m.percentage || 10}%` }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200">
                Nenhum modelo acionado até o momento.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SEÇÃO 4: MÉTRICA DE EFICIÊNCIA & ACOMPANHAMENTO DO PLANO */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* CUSTO MÉDIO POR PROCESSAMENTO */}
        <div className="lg:col-span-4 bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Métrica de Eficiência</span>
              <Sparkles className="w-4 h-4 text-emerald-600" />
            </div>
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Custo Médio por Processamento</h4>
            <div className="mt-3">
              <span className="text-3xl font-extrabold text-slate-900 tracking-tight block">
                🪙 {avgCostPerProcess} <span className="text-sm font-semibold text-amber-700">Coins</span>
              </span>
              <span className="text-xs text-slate-500 font-medium mt-0.5 block">
                Média real baseada em {totalMessages} operações
              </span>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Status de Eficiência:</span>
            <span className="font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
              {totalMessages > 0 ? "Eficiência Auditada" : "Aguardando Chamadas"}
            </span>
          </div>
        </div>

        {/* CONSUMO DO PLANO / BARRA DE FRANQUIA */}
        <div className="lg:col-span-8 bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Acompanhamento da Franquia do Plano ({activeCompany?.plan || "Premium"})</span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Gestão de consumo mensal contratado</p>
            </div>
            <span className={`text-[11px] font-bold px-2.5 py-1 rounded-md border ${
              planPercentage >= 90 ? 'bg-red-50 text-red-700 border-red-200' :
              planPercentage >= 80 ? 'bg-amber-50 text-amber-700 border-amber-200' :
              'bg-emerald-50 text-emerald-700 border-emerald-200'
            }`}>
              {planPercentage}% Utilizado
            </span>
          </div>

          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-slate-700">Consumo Acumulado no Mês:</span>
              <span className="text-slate-900 font-bold">
                🪙 {monthlyCoins.toLocaleString('pt-BR')} / {planFranchiseCoins.toLocaleString('pt-BR')} Coins
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200">
              <div 
                className={`h-full rounded-full transition-all ${
                  planPercentage >= 90 ? 'bg-red-500' :
                  planPercentage >= 80 ? 'bg-amber-500' :
                  'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(100, Math.max(1, planPercentage))}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium pt-1">
              <span>Restam: <strong>🪙 {Math.max(0, planFranchiseCoins - monthlyCoins).toLocaleString('pt-BR')} Coins</strong></span>
              <span>Renovação da franquia mensal ativa</span>
            </div>
          </div>
        </div>
      </div>

      {/* SEÇÃO 5: HISTÓRICO DE CONSUMO AUDITÁVEL (TABELA + BUSCA + FILTROS) */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-600" />
              <span>Histórico de Consumo Auditável (Banco de Dados SQL)</span>
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Registro detalhado de cada débito de Coins realizado no sistema</p>
          </div>

          {/* Search & Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Pesquisar agente, modelo..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-48 sm:w-56 h-8 pl-8 pr-3 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-blue-500"
              />
            </div>

            <select
              value={agentFilter}
              onChange={(e) => setAgentFilter(e.target.value)}
              className="h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700"
            >
              <option value="TODOS">Todos os Agentes</option>
              {Array.from(new Set(companyLogs.map(l => l.agente_nome || l.agente_id).filter(Boolean))).map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Table Container */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="py-2.5 px-3">Data / Hora</th>
                <th className="py-2.5 px-3">Agente / Recurso</th>
                <th className="py-2.5 px-3">Modelo LLM</th>
                <th className="py-2.5 px-3">Operação</th>
                <th className="py-2.5 px-3 text-right">Tokens</th>
                <th className="py-2.5 px-3 text-right">Coins Consumidos</th>
                <th className="py-2.5 px-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedHistory.length > 0 ? (
                paginatedHistory.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-3 text-slate-500 font-mono text-[11px]">
                      {new Date(tx.created_at || Date.now()).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="py-3 px-3 font-bold text-slate-900">
                      {tx.agente_nome || tx.agente_id || 'Omni IA Hub'}
                    </td>
                    <td className="py-3 px-3 text-slate-600 font-mono text-[11px]">
                      {tx.modelo || 'OpenRouter LLM'}
                    </td>
                    <td className="py-3 px-3 text-slate-700">
                      {tx.funcionalidade || 'Consulta IA Chat'}
                    </td>
                    <td className="py-3 px-3 text-right text-slate-500 font-mono">
                      {(tx.total_tokens || 0).toLocaleString('pt-BR')}
                    </td>
                    <td className="py-3 px-3 text-right font-extrabold text-amber-700">
                      🪙 -{tx.omnicoins_consumed || 5} Coins
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-slate-900">
                      <span className="px-2 py-0.5 text-[10px] rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {tx.status || "SUCCESS"}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 text-xs">
                    Nenhum registro de consumo localizado para esta empresa.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* CONTROLES DE PAGINAÇÃO (20 ITENS POR PÁGINA) */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-100 text-xs text-slate-500">
          <div>
            Mostrando <strong>{filteredHistory.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}</strong> a <strong>{Math.min(currentPage * itemsPerPage, filteredHistory.length)}</strong> de <strong>{filteredHistory.length}</strong> registros auditados
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-md hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition-all"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Anterior</span>
              </button>

              <div className="flex items-center gap-1 px-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                  .map((p, idx, arr) => {
                    const prev = arr[idx - 1];
                    const showEllipsis = prev && p - prev > 1;
                    return (
                      <span key={p} className="flex items-center gap-1">
                        {showEllipsis && <span className="text-slate-400 px-1">...</span>}
                        <button
                          onClick={() => setCurrentPage(p)}
                          className={`w-7 h-7 rounded-md font-semibold text-xs flex items-center justify-center transition-all ${
                            currentPage === p 
                              ? 'bg-blue-600 text-white shadow-2xs' 
                              : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
                          }`}
                        >
                          {p}
                        </button>
                      </span>
                    );
                  })}
              </div>

              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-md hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition-all"
              >
                <span>Próximo</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
