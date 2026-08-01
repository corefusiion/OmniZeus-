"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Building2, Users, TrendingUp, Coins, Cpu, DollarSign, AlertTriangle,
  Crown, RefreshCw, Activity, Wallet, BarChart2, Layers, ShieldAlert,
  FileWarning, LinkIcon, CreditCard, Zap, CheckCircle2, Sparkles
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, PieChart, Pie, Cell
} from "recharts";
import { getActiveRole, getCurrentUser, UserRole } from "@/lib/auth/roles";
import { useTenant } from "@/lib/tenant/TenantContext";
import {
  fetchServerTable, fetchServerSettings,
  fetchContaAzulConfig, SystemSettings
} from "@/lib/db/serverDb";
import { COIN_CONVERSION } from "@/lib/coins/store";

function formatBRL(v: number) {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
}

function formatInt(v: number) {
  return v.toLocaleString('pt-BR');
}

function sameDay(a: string, b: string) {
  const d1 = new Date(a), d2 = new Date(b);
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}

function sameMonth(a: string, b: string) {
  const d1 = new Date(a), d2 = new Date(b);
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth();
}

const PIE_COLORS = ["#1E6FD9", "#10B981", "#8B5CF6", "#F59E0B", "#EF4444", "#06B6D4", "#EC4899", "#84CC16"];
const STATUS_STYLES: Record<string, string> = {
  Ativo: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Suspenso: "bg-rose-50 text-rose-700 border-rose-200",
};

interface CompanyRow {
  id: string;
  corporateName: string;
  tradeName: string;
  plan: string;
  status: string;
  subscription_status: string;
  coinsFranchise: number;
  monthlyRevenueBrl: number;
  createdAt: string;
  openrouterKeyStatus: string;
}

interface LogRow {
  id: string;
  company_id: string;
  user_name: string;
  hub_type: string;
  agent_name: string;
  model: string;
  tokens_used: number;
  coins_deducted: number;
  created_at: string;
}

export default function DashboardMasterPage() {
  const [role, setRole] = useState<UserRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [caConfig, setCaConfig] = useState<any>(null);

  const { isTenantMode, canSwitchCompany, isSaaSMode } = useTenant();

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [rawCompanies, rawEmployees, rawLogs, rawSettings, rawCaConfig] = await Promise.all([
        fetchServerTable('companies', 'global'),
        fetchServerTable('employees', 'global'),
        fetchServerTable('ai_usage_logs', 'global'),
        fetchServerSettings(),
        fetchContaAzulConfig()
      ]);

      setCompanies(Array.isArray(rawCompanies) ? rawCompanies.map((c: any) => ({
        id: c.id,
        corporateName: c.corporateName || c.corporate_name || '',
        tradeName: c.tradeName || c.trade_name || '',
        plan: c.plan || 'Premium',
        status: c.status || 'Ativo',
        subscription_status: c.subscription_status || c.subscriptionStatus || 'active',
        coinsFranchise: Number(c.coinsFranchise || c.coins_franchise || 0),
        monthlyRevenueBrl: Number(c.monthlyRevenueBrl || c.monthly_revenue_brl || 0),
        createdAt: c.createdAt || c.created_at || '',
        openrouterKeyStatus: c.openrouterKeyStatus || c.openrouter_key_status || ''
      })) : []);

      setEmployees(Array.isArray(rawEmployees) ? rawEmployees : []);
      setLogs(Array.isArray(rawLogs) ? rawLogs.map((l: any) => ({
        id: l.id,
        company_id: l.company_id || l.companyId || '',
        user_name: l.user_name || l.userName || 'Usuário',
        hub_type: l.hub_type || 'outros',
        agent_name: l.agent_name || l.agent || 'Desconhecido',
        model: l.model || l.modelo || 'LLM',
        tokens_used: Number(l.tokens_used || l.total_tokens || 0),
        coins_deducted: Number(l.coins_deducted || l.omnicoins_consumed || 0),
        created_at: l.created_at || ''
      })) : []);
      setSettings(rawSettings || null);
      setCaConfig(rawCaConfig || null);
    } catch (err) {
      console.error("Erro ao carregar Dashboard Master:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const applyRole = () => setRole(getActiveRole());
    const handleRoleChange = () => {
      setRole(getActiveRole());
      loadData();
    };
    const handleContextChange = () => loadData();
    const handleDbChange = () => loadData();

    // Sessão já reidratada (ex.: navegação client-side): aplica o role imediatamente.
    // Em primeiro carregamento, aguarda o rehydrateSession disparar omnizeus_role_change —
    // assim nunca renderiza "Acesso Estritamente Negado" antes da reidratação terminar.
    if (getCurrentUser().id) applyRole();
    loadData();

    window.addEventListener("omnizeus_role_change", handleRoleChange);
    window.addEventListener("omnizeus_company_context_change", handleContextChange);
    window.addEventListener("omnizeus_sql_db_change", handleDbChange);

    return () => {
      window.removeEventListener("omnizeus_role_change", handleRoleChange);
      window.removeEventListener("omnizeus_company_context_change", handleContextChange);
      window.removeEventListener("omnizeus_sql_db_change", handleDbChange);
    };
  }, [loadData]);

  // ── Engine de cálculos reais (zero mock) ────────────────────────────────
  const m = useMemo(() => {
    const now = new Date();
    // MRR considera apenas empresas ativas com assinatura confirmada
    // (exclui provisionadas sem pagamento → subscription_status "incomplete").
    const active = companies.filter(c => c.status === 'Ativo' && c.subscription_status !== 'incomplete');
    const mrr = active.reduce((a, c) => a + c.monthlyRevenueBrl, 0);
    const mrrProjected = mrr * 12;

    const byStatus: Record<string, number> = {};
    companies.forEach(c => { byStatus[c.status] = (byStatus[c.status] || 0) + 1; });

    const byPlan: Record<string, number> = {};
    companies.forEach(c => { byPlan[c.plan] = (byPlan[c.plan] || 0) + 1; });

    const bySub: Record<string, number> = {};
    companies.forEach(c => { bySub[c.subscription_status] = (bySub[c.subscription_status] || 0) + 1; });

    const gestores = employees.filter(e => e.role === 'gestor').length;
    const funcionarios = employees.filter(e => e.role === 'funcionario').length;

    // IA / OpenRouter
    const todayLogs = logs.filter(l => sameDay(l.created_at, now.toISOString()));
    const monthLogs = logs.filter(l => sameMonth(l.created_at, now.toISOString()));

    const sumCoins = (arr: LogRow[]) => arr.reduce((a, l) => a + l.coins_deducted, 0);
    const sumTokens = (arr: LogRow[]) => arr.reduce((a, l) => a + l.tokens_used, 0);

    const coinsToday = sumCoins(todayLogs);
    const coinsMonth = sumCoins(monthLogs);
    const tokensToday = sumTokens(todayLogs);
    const tokensMonth = sumTokens(monthLogs);
    const requestsToday = todayLogs.length;
    const requestsMonth = monthLogs.length;

    // Custo estimado pela conversão interna (1 coin = R$ 0,10)
    const costToday = coinsToday * COIN_CONVERSION.BRL_PER_COIN;
    const costMonth = coinsMonth * COIN_CONVERSION.BRL_PER_COIN;

    // Consumo por modelo
    const modelMap = new Map<string, { tokens: number; coins: number; requests: number }>();
    logs.forEach(l => {
      const cur = modelMap.get(l.model) || { tokens: 0, coins: 0, requests: 0 };
      cur.tokens += l.tokens_used;
      cur.coins += l.coins_deducted;
      cur.requests += 1;
      modelMap.set(l.model, cur);
    });
    const topModels = Array.from(modelMap.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.coins - a.coins)
      .slice(0, 8);

    // Consumo por hub
    const hubMap = new Map<string, number>();
    logs.forEach(l => {
      const h = l.hub_type === 'omni-ia' ? 'Hub Omni IA' : l.hub_type === 'omni-contaazul-ia' ? 'Conta Azul IA' : l.hub_type;
      hubMap.set(h, (hubMap.get(h) || 0) + l.coins_deducted);
    });
    const hubData = Array.from(hubMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // Consumo por agente
    const agentMap = new Map<string, { coins: number; tokens: number; requests: number }>();
    logs.forEach(l => {
      const cur = agentMap.get(l.agent_name) || { coins: 0, tokens: 0, requests: 0 };
      cur.coins += l.coins_deducted;
      cur.tokens += l.tokens_used;
      cur.requests += 1;
      agentMap.set(l.agent_name, cur);
    });
    const topAgents = Array.from(agentMap.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.coins - a.coins)
      .slice(0, 8);

    // Consumo por empresa
    const companyUsage = companies.map(c => {
      const compLogs = logs.filter(l => l.company_id === c.id);
      const coins = sumCoins(compLogs);
      const tokens = sumTokens(compLogs);
      const infraPerCompany = settings?.platform_operational_costs?.fixed_monthly_cost_per_company || 0;
      const aiCostEst = coinsMonth > 0 && compLogs.length > 0
        ? (coins * COIN_CONVERSION.BRL_PER_COIN)
        : 0;
      const profit = c.monthlyRevenueBrl - aiCostEst - infraPerCompany;
      const margin = c.monthlyRevenueBrl > 0 ? (profit / c.monthlyRevenueBrl) * 100 : 0;
      return {
        ...c,
        coinsConsumed: coins,
        tokens,
        requests: compLogs.length,
        aiCostEst,
        infraPerCompany,
        profit,
        margin,
        isOverFranchise: c.coinsFranchise > 0 ? coins >= c.coinsFranchise : false
      };
    });

    // OmniCoins distribuídas
    const coinsDistributed = companies.reduce((a, c) => a + c.coinsFranchise, 0);
    const coinsConsumed = sumCoins(logs);
    const coinsRemaining = Math.max(0, coinsDistributed - coinsConsumed);
    const consumptionPct = coinsDistributed > 0
      ? Math.min(100, Math.round((coinsConsumed / coinsDistributed) * 100))
      : 0;

    // Lucro líquido mensal (Stripe − OpenRouter estimado − infraestrutura)
    const totalInfra = settings?.platform_operational_costs?.fixed_monthly_cost_per_company
      ? settings.platform_operational_costs.fixed_monthly_cost_per_company * active.length
      : 0;
    const netProfit = mrr - costMonth - totalInfra;
    const netMargin = mrr > 0 ? (netProfit / mrr) * 100 : 0;

    // Crescimento
    const newThisMonth = companies.filter(c => {
      if (!c.createdAt) return false;
      return sameMonth(c.createdAt, now.toISOString());
    }).length;
    const churned = companies.filter(c => c.status === 'Suspenso' || ['unpaid', 'canceled'].includes(c.subscription_status)).length;
    const retention = companies.length > 0 ? Math.round(((companies.length - churned) / companies.length) * 100) : 0;

    // Novas empresas por mês (últimos 8 meses)
    const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const nowYear = now.getFullYear();
    const growthData = Array.from({ length: 8 }, (_, i) => {
      const d = new Date(nowYear, now.getMonth() - 7 + i, 1);
      const count = companies.filter(c => {
        if (!c.createdAt) return false;
        const cd = new Date(c.createdAt);
        return cd.getFullYear() === d.getFullYear() && cd.getMonth() === d.getMonth();
      }).length;
      return { month: monthNames[d.getMonth()], novas: count };
    });

    // Rankings
    const topConsumption = [...companyUsage].sort((a, b) => b.coinsConsumed - a.coinsConsumed).slice(0, 8);
    const topProfitable = [...companyUsage].sort((a, b) => b.profit - a.profit).slice(0, 8);
    const overdue = companyUsage.filter(c => ['past_due', 'unpaid', 'incomplete'].includes(c.subscription_status));

    // Alertas reais
    const alerts: { severity: 'critical' | 'warning' | 'info'; icon: string; company: string; message: string }[] = [];
    companyUsage.forEach(c => {
      if (c.status === 'Suspenso') {
        alerts.push({ severity: 'critical', icon: 'suspensa', company: c.tradeName || c.corporateName, message: 'Empresa suspensa. Verifique o status da assinatura.' });
      }
      if (['past_due', 'unpaid'].includes(c.subscription_status)) {
        alerts.push({ severity: 'critical', icon: 'stripe', company: c.tradeName || c.corporateName, message: 'Stripe com pagamento pendente/inadimplente.' });
      }
      if (c.isOverFranchise) {
        alerts.push({ severity: 'warning', icon: 'coins', company: c.tradeName || c.corporateName, message: 'Franquia de OmniCoins esgotada ou no limite.' });
      }
      if (c.openrouterKeyStatus === 'error') {
        alerts.push({ severity: 'warning', icon: 'api', company: c.tradeName || c.corporateName, message: 'Chave OpenRouter inválida ou com erro.' });
      }
    });

    // Webhook parado: sem logs de IA nos últimos 7 dias
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const hasRecentLogs = logs.some(l => l.created_at && l.created_at >= sevenDaysAgo);
    if (companies.length > 0 && !hasRecentLogs) {
      alerts.push({ severity: 'info', icon: 'webhook', company: 'Plataforma', message: 'Nenhuma atividade de IA nos últimos 7 dias. Verifique webhooks e agentes.' });
    }
    if (caConfig && caConfig.isConnected === false) {
      alerts.push({ severity: 'warning', icon: 'contaazul', company: 'Integração global', message: 'Conta Azul desconectada. Reautorize a integração.' });
    }

    return {
      mrr, mrrProjected, byStatus, byPlan, bySub,
      gestores, funcionarios, totalEmployees: employees.length,
      coinsToday, coinsMonth, tokensToday, tokensMonth, requestsToday, requestsMonth,
      costToday, costMonth, topModels, hubData, topAgents,
      coinsDistributed, coinsConsumed, coinsRemaining, consumptionPct,
      totalInfra, netProfit, netMargin,
      newThisMonth, churned, retention, growthData,
      topConsumption, topProfitable, overdue,
      alerts, totalCompanies: companies.length, activeCount: active.length,
      totalRequests: logs.length, totalTokens: sumTokens(logs)
    };
  }, [companies, employees, logs, settings, caConfig]);

  const canView = role === "super_adm" && !isTenantMode;

  if (role === null) {
    return (
      <div className="p-12 bg-white border border-slate-200 rounded-xl text-center shadow-xs">
        <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
          <RefreshCw className="w-6 h-6 animate-spin" />
        </div>
        <h2 className="text-base font-bold text-slate-900">Carregando sessão...</h2>
        <p className="text-xs text-slate-500 mt-2 max-w-sm mx-auto leading-relaxed">
          Confirmando suas permissões de acesso à plataforma.
        </p>
      </div>
    );
  }

  if (!canView && role === "super_adm" && isTenantMode) {
    return (
      <div className="p-12 bg-white border border-slate-200 rounded-xl text-center shadow-xs">
        <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
          <Building2 className="w-6 h-6" />
        </div>
        <h2 className="text-base font-bold text-slate-900">Visão Global indisponível no modo empresa</h2>
        <p className="text-xs text-slate-500 mt-2 max-w-sm mx-auto leading-relaxed">
          O Dashboard Master SaaS está disponível apenas no centro de controle da plataforma.
          Saia da empresa usando o botão no topo da tela para acessá-lo.
        </p>
      </div>
    );
  }

  if (role !== "super_adm") {
    return (
      <div className="p-12 bg-white border border-red-200/60 rounded-xl text-center shadow-xs">
        <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h2 className="text-base font-bold text-slate-900">Acesso Estritamente Negado</h2>
        <p className="text-xs text-slate-500 mt-2 max-w-sm mx-auto leading-relaxed">
          Este painel é reservado exclusivamente ao Super ADM Master da plataforma.
        </p>
      </div>
    );
  }

  const kpis = [
    { icon: TrendingUp, label: "MRR Ativo", value: `R$ ${formatBRL(m.mrr)}`, sub: `projeção anual R$ ${formatBRL(m.mrrProjected)}`, color: "text-emerald-600", bg: "bg-emerald-50" },
    { icon: Building2, label: "Empresas", value: formatInt(m.totalCompanies), sub: `${m.activeCount} ativas · ${m.byStatus["Suspenso"] || 0} suspensas`, color: "text-primary", bg: "bg-blue-50" },
    { icon: Users, label: "Usuários", value: formatInt(m.totalEmployees), sub: `${m.gestores} gestores · ${m.funcionarios} funcionários`, color: "text-violet-600", bg: "bg-violet-50" },
    { icon: Coins, label: "Coins Consumidas", value: formatInt(m.coinsConsumed), sub: `${m.consumptionPct}% da franquia total`, color: "text-amber-600", bg: "bg-amber-50" },
    { icon: Cpu, label: "Custo IA (mês)", value: `R$ ${formatBRL(m.costMonth)}`, sub: `R$ ${formatBRL(m.costToday)} hoje`, color: "text-blue-600", bg: "bg-blue-50" },
    { icon: DollarSign, label: "Lucro Líquido (mês)", value: `R$ ${formatBRL(m.netProfit)}`, sub: `margem ${formatBRL(m.netMargin)}%`, color: m.netProfit >= 0 ? "text-emerald-600" : "text-rose-600", bg: m.netProfit >= 0 ? "bg-emerald-50" : "bg-rose-50" },
    { icon: Zap, label: "Requisições IA", value: formatInt(m.totalRequests), sub: `${formatInt(m.requestsMonth)} neste mês`, color: "text-cyan-600", bg: "bg-cyan-50" },
    { icon: Activity, label: "Tokens Processados", value: formatInt(m.totalTokens), sub: `${formatInt(m.tokensMonth)} neste mês`, color: "text-fuchsia-600", bg: "bg-fuchsia-50" },
  ];

  return (
    <div className="space-y-6 text-slate-900 font-sans">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 lg:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <Crown className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl lg:text-2xl font-bold tracking-tight text-slate-900">
              Dashboard Master SaaS
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Visão global da plataforma · dados reais de todas as empresas
            </p>
          </div>
        </div>
        <button
          onClick={loadData}
          className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg border border-slate-200 flex items-center gap-1.5 transition-all self-start md:self-auto"
        >
          <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
          Atualizar
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 lg:gap-4">
        {kpis.map((k, i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
            <div className={`w-8 h-8 rounded-lg ${k.bg} ${k.color} flex items-center justify-center mb-3`}>
              <k.icon className="w-4 h-4" strokeWidth={1.5} />
            </div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{k.label}</p>
            <p className={`text-lg lg:text-xl font-extrabold mt-1 ${k.color}`}>{k.value}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{k.sub}</p>
          </div>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 lg:gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs animate-pulse h-28" />
          ))}
        </div>
      ) : (
        <>
          {/* Alertas */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-4 h-4 text-amber-500" strokeWidth={1.5} />
              <h2 className="text-sm font-bold text-slate-900">Alertas da Plataforma</h2>
              {m.alerts.length > 0 && (
                <span className="ml-auto px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-200">
                  {m.alerts.length}
                </span>
              )}
            </div>
            {m.alerts.length === 0 ? (
              <div className="flex items-center gap-2 py-6 justify-center text-slate-400">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" strokeWidth={1.5} />
                <p className="text-xs font-semibold">Sem alertas ativos no momento.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                {m.alerts.map((a, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-3 p-3 rounded-lg border ${
                      a.severity === 'critical'
                        ? 'bg-rose-50 border-rose-200 text-rose-900'
                        : a.severity === 'warning'
                        ? 'bg-amber-50 border-amber-200 text-amber-900'
                        : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    {a.icon === 'suspensa' ? <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" /> :
                     a.icon === 'stripe' ? <CreditCard className="w-4 h-4 mt-0.5 shrink-0" /> :
                     a.icon === 'coins' ? <Coins className="w-4 h-4 mt-0.5 shrink-0" /> :
                     a.icon === 'api' ? <FileWarning className="w-4 h-4 mt-0.5 shrink-0" /> :
                     a.icon === 'webhook' ? <LinkIcon className="w-4 h-4 mt-0.5 shrink-0" /> :
                     <LinkIcon className="w-4 h-4 mt-0.5 shrink-0" />}
                    <div className="min-w-0">
                      <p className="text-xs font-bold">{a.company}</p>
                      <p className="text-[11px] opacity-80 mt-0.5 leading-relaxed">{a.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* OpenRouter & IA */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
              <div className="flex items-center gap-2 mb-4">
                <Cpu className="w-4 h-4 text-primary" strokeWidth={1.5} />
                <h2 className="text-sm font-bold text-slate-900">OpenRouter & Consumo de IA</h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Custo hoje</p>
                  <p className="text-sm font-extrabold text-slate-900 mt-0.5">R$ {formatBRL(m.costToday)}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Custo mês</p>
                  <p className="text-sm font-extrabold text-slate-900 mt-0.5">R$ {formatBRL(m.costMonth)}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Tokens mês</p>
                  <p className="text-sm font-extrabold text-slate-900 mt-0.5">{formatInt(m.tokensMonth)}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Requests mês</p>
                  <p className="text-sm font-extrabold text-slate-900 mt-0.5">{formatInt(m.requestsMonth)}</p>
                </div>
              </div>
              <p className="text-[10px] text-slate-400 mb-3">
                Custo estimado pela conversão interna de OmniCoins (1 coin = R$ {COIN_CONVERSION.BRL_PER_COIN.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}).
              </p>

              <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Consumo por Modelo (Coins)</h3>
              {m.topModels.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">Sem dados disponíveis.</p>
              ) : (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={m.topModels} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 10 }} stroke="#94A3B8" />
                      <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 10 }} stroke="#94A3B8" />
                      <Tooltip formatter={(v: any) => [formatInt(Number(v)) + " coins", "Consumo"]} />
                      <Bar dataKey="coins" fill="#1E6FD9" radius={[0, 4, 4, 0]} barSize={12} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Consumo por Hub */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
              <div className="flex items-center gap-2 mb-4">
                <Layers className="w-4 h-4 text-violet-500" strokeWidth={1.5} />
                <h2 className="text-sm font-bold text-slate-900">Consumo por Hub de IA</h2>
              </div>
              {m.hubData.length === 0 ? (
                <p className="text-xs text-slate-400 py-10 text-center">Sem dados disponíveis.</p>
              ) : (
                <div className="h-56 flex items-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={m.hubData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {m.hubData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: any) => [formatInt(Number(v)) + " coins", "Consumo"]} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}

              <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 mt-4">Top Agentes por Consumo</h3>
              {m.topAgents.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">Sem dados disponíveis.</p>
              ) : (
                <div className="space-y-2">
                  {m.topAgents.map((a, i) => (
                    <div key={a.name} className="flex items-center gap-2">
                      <span className="w-5 text-[10px] font-bold text-slate-400 text-right">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-baseline mb-0.5">
                          <span className="text-[11px] font-semibold text-slate-700 truncate">{a.name}</span>
                          <span className="text-[10px] text-slate-400">{formatInt(a.coins)} coins</span>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full"
                            style={{ width: `${m.topAgents[0].coins > 0 ? (a.coins / m.topAgents[0].coins) * 100 : 0}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* OmniCoins & Lucro */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
              <div className="flex items-center gap-2 mb-4">
                <Coins className="w-4 h-4 text-amber-500" strokeWidth={1.5} />
                <h2 className="text-sm font-bold text-slate-900">OmniCoins (Plataforma)</h2>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-baseline pb-2 border-b border-slate-100">
                  <span className="text-xs text-slate-500">Distribuídas</span>
                  <span className="text-sm font-extrabold text-slate-900">{formatInt(m.coinsDistributed)}</span>
                </div>
                <div className="flex justify-between items-baseline pb-2 border-b border-slate-100">
                  <span className="text-xs text-slate-500">Consumidas</span>
                  <span className="text-sm font-extrabold text-amber-600">{formatInt(m.coinsConsumed)}</span>
                </div>
                <div className="flex justify-between items-baseline pb-2 border-b border-slate-100">
                  <span className="text-xs text-slate-500">Restantes</span>
                  <span className="text-sm font-extrabold text-emerald-600">{formatInt(m.coinsRemaining)}</span>
                </div>
                <div className="pt-1">
                  <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                    <span>Consumo da franquia</span>
                    <span>{m.consumptionPct}%</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${m.consumptionPct > 80 ? "bg-rose-500" : m.consumptionPct > 50 ? "bg-amber-500" : "bg-emerald-500"}`}
                      style={{ width: `${m.consumptionPct}%` }}
                    />
                  </div>
                </div>
              </div>

              <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 mt-5">Empresas que mais consomem</h3>
              {m.topConsumption.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">Sem dados disponíveis.</p>
              ) : (
                <div className="space-y-2">
                  {m.topConsumption.map((c, i) => (
                    <div key={c.id} className="flex items-center gap-2">
                      <span className="w-5 text-[10px] font-bold text-slate-400 text-right">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-baseline mb-0.5">
                          <span className="text-[11px] font-semibold text-slate-700 truncate">{c.tradeName || c.corporateName}</span>
                          <span className="text-[10px] text-slate-400">{formatInt(c.coinsConsumed)} coins</span>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-amber-500 rounded-full"
                            style={{ width: `${m.topConsumption[0].coinsConsumed > 0 ? (c.coinsConsumed / m.topConsumption[0].coinsConsumed) * 100 : 0}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Lucro líquido */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
              <div className="flex items-center gap-2 mb-4">
                <DollarSign className="w-4 h-4 text-emerald-500" strokeWidth={1.5} />
                <h2 className="text-sm font-bold text-slate-900">Lucro Líquido (Stripe − OpenRouter − Infraestrutura)</h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Receita (MRR)</p>
                  <p className="text-sm font-extrabold text-emerald-600 mt-0.5">R$ {formatBRL(m.mrr)}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Custo IA (mês)</p>
                  <p className="text-sm font-extrabold text-slate-900 mt-0.5">− R$ {formatBRL(m.costMonth)}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Infraestrutura</p>
                  <p className="text-sm font-extrabold text-slate-900 mt-0.5">− R$ {formatBRL(m.totalInfra)}</p>
                </div>
                <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-500">Lucro Líquido</p>
                  <p className={`text-sm font-extrabold mt-0.5 ${m.netProfit >= 0 ? "text-emerald-700" : "text-rose-600"}`}>R$ {formatBRL(m.netProfit)}</p>
                </div>
              </div>
              <p className="text-[10px] text-slate-400">
                Infraestrutura considerada: R$ {formatBRL(m.totalInfra)}/mês
                {settings?.platform_operational_costs?.fixed_monthly_cost_per_company
                  ? ` (${formatInt(settings.platform_operational_costs.fixed_monthly_cost_per_company)} por empresa × ${formatInt(m.activeCount)} ativas)`
                  : " — sem custos operacionais configurados no painel Infraestrutura & APIs."}
              </p>

              {/* Crescimento */}
              <div className="mt-6">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="w-4 h-4 text-emerald-500" strokeWidth={1.5} />
                  <h3 className="text-sm font-bold text-slate-900">Crescimento da Plataforma</h3>
                </div>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-center">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Novas empresas</p>
                    <p className="text-lg font-extrabold text-primary mt-0.5">{formatInt(m.newThisMonth)}</p>
                    <p className="text-[10px] text-slate-400">neste mês</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-center">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Churn</p>
                    <p className="text-lg font-extrabold text-rose-600 mt-0.5">{formatInt(m.churned)}</p>
                    <p className="text-[10px] text-slate-400">suspensas/canceladas</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-center">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Retenção</p>
                    <p className="text-lg font-extrabold text-emerald-600 mt-0.5">{m.retention}%</p>
                    <p className="text-[10px] text-slate-400">empresas ativas</p>
                  </div>
                </div>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={m.growthData} margin={{ left: -16, right: 8, top: 4, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="#94A3B8" />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10 }} stroke="#94A3B8" />
                      <Tooltip formatter={(v: any) => [formatInt(Number(v)), "novas empresas"]} />
                      <Bar dataKey="novas" fill="#10B981" radius={[4, 4, 0, 0]} barSize={22} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>

          {/* Rankings */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-4 h-4 text-primary" strokeWidth={1.5} />
                <h2 className="text-sm font-bold text-slate-900">Ranking: Maior Consumo de IA</h2>
              </div>
              {m.topConsumption.length === 0 ? (
                <p className="text-xs text-slate-400 py-8 text-center">Sem dados disponíveis.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-[9px] uppercase tracking-wider text-slate-400 border-b border-slate-100">
                        <th className="py-2 pr-2 font-bold">#</th>
                        <th className="py-2 pr-2 font-bold">Empresa</th>
                        <th className="py-2 pr-2 font-bold text-right">Coins</th>
                        <th className="py-2 font-bold text-right">Tokens</th>
                      </tr>
                    </thead>
                    <tbody>
                      {m.topConsumption.map((c, i) => (
                        <tr key={c.id} className="border-b border-slate-50 last:border-0">
                          <td className="py-2 pr-2 text-[10px] font-bold text-slate-400">{i + 1}</td>
                          <td className="py-2 pr-2 text-xs font-semibold text-slate-800">{c.tradeName || c.corporateName}</td>
                          <td className="py-2 pr-2 text-xs font-bold text-amber-600 text-right">{formatInt(c.coinsConsumed)}</td>
                          <td className="py-2 text-xs text-slate-600 text-right">{formatInt(c.tokens)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
              <div className="flex items-center gap-2 mb-4">
                <BarChart2 className="w-4 h-4 text-emerald-500" strokeWidth={1.5} />
                <h2 className="text-sm font-bold text-slate-900">Ranking: Empresas Mais Lucrativas</h2>
              </div>
              {m.topProfitable.length === 0 ? (
                <p className="text-xs text-slate-400 py-8 text-center">Sem dados disponíveis.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-[9px] uppercase tracking-wider text-slate-400 border-b border-slate-100">
                        <th className="py-2 pr-2 font-bold">#</th>
                        <th className="py-2 pr-2 font-bold">Empresa</th>
                        <th className="py-2 pr-2 font-bold text-right">Receita</th>
                        <th className="py-2 pr-2 font-bold text-right">Custo IA</th>
                        <th className="py-2 font-bold text-right">Lucro</th>
                      </tr>
                    </thead>
                    <tbody>
                      {m.topProfitable.map((c, i) => (
                        <tr key={c.id} className="border-b border-slate-50 last:border-0">
                          <td className="py-2 pr-2 text-[10px] font-bold text-slate-400">{i + 1}</td>
                          <td className="py-2 pr-2 text-xs font-semibold text-slate-800">{c.tradeName || c.corporateName}</td>
                          <td className="py-2 pr-2 text-xs text-slate-600 text-right">R$ {formatBRL(c.monthlyRevenueBrl)}</td>
                          <td className="py-2 pr-2 text-xs text-slate-600 text-right">R$ {formatBRL(c.aiCostEst)}</td>
                          <td className={`py-2 text-xs font-bold text-right ${c.profit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>R$ {formatBRL(c.profit)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Inadimplentes & Status */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
              <div className="flex items-center gap-2 mb-4">
                <CreditCard className="w-4 h-4 text-rose-500" strokeWidth={1.5} />
                <h2 className="text-sm font-bold text-slate-900">Inadimplentes / Pagamento Pendente</h2>
              </div>
              {m.overdue.length === 0 ? (
                <p className="text-xs text-slate-400 py-8 text-center flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Nenhuma empresa com pagamento pendente.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-[9px] uppercase tracking-wider text-slate-400 border-b border-slate-100">
                        <th className="py-2 pr-2 font-bold">Empresa</th>
                        <th className="py-2 pr-2 font-bold">Status Stripe</th>
                        <th className="py-2 font-bold text-right">MRR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {m.overdue.map(c => (
                        <tr key={c.id} className="border-b border-slate-50 last:border-0">
                          <td className="py-2 pr-2 text-xs font-semibold text-slate-800">{c.tradeName || c.corporateName}</td>
                          <td className="py-2 pr-2">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-200">
                              {c.subscription_status}
                            </span>
                          </td>
                          <td className="py-2 text-xs text-slate-600 text-right">R$ {formatBRL(c.monthlyRevenueBrl)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
              <div className="flex items-center gap-2 mb-4">
                <Building2 className="w-4 h-4 text-primary" strokeWidth={1.5} />
                <h2 className="text-sm font-bold text-slate-900">Empresas por Status & Plano</h2>
              </div>
              {companies.length === 0 ? (
                <p className="text-xs text-slate-400 py-8 text-center">Sem dados disponíveis.</p>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-2">Status</p>
                    {Object.entries(m.byStatus).map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between py-1">
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_STYLES[k] || "bg-slate-100 text-slate-700 border-slate-200"}`}>{k}</span>
                        <span className="text-xs font-extrabold text-slate-900">{v}</span>
                      </div>
                    ))}
                  </div>
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-2">Planos</p>
                    {Object.entries(m.byPlan).map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between py-1">
                        <span className="text-[11px] font-semibold text-slate-600">{k}</span>
                        <span className="text-xs font-extrabold text-slate-900">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
