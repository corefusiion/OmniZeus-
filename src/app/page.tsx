"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import HowItWorks from "@/components/HowItWorks";
import {
  ArrowRight,
  BarChart2,
  FileText,
  FileCheck,
  MessageSquare,
  CheckSquare,
  Bot,
  Users,
  Shield,
  DollarSign,
  Bell,
  Check,
  Menu,
  X,
  Zap,
  Globe,
  BookOpen,
  Headphones,
  Building2,
  Lock,
  Cpu,
  Layers,
  Database,
  ChevronDown,
  ChevronUp,
  Link as LinkIcon,
  Coins,
  ShieldCheck,
  TrendingUp,
  Clock,
  LayoutDashboard,
  CheckCircle2,
  ArrowUpRight,
  HelpCircle,
  Sliders,
  Play
} from "lucide-react";

/* ─────────────────────────────────────────
   Interactive App Preview Component
───────────────────────────────────────── */
function AppPreview() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "omni-ia" | "contaazul" | "financeiro" | "tarefas" | "coins">("dashboard");

  const tabs = [
    { id: "dashboard", label: "Dashboard Executivo", icon: LayoutDashboard },
    { id: "omni-ia", label: "Omni IA Hub", icon: Bot },
    { id: "contaazul", label: "Conta Azul IA", icon: LinkIcon },
    { id: "financeiro", label: "Contas a Pagar", icon: DollarSign },
    { id: "tarefas", label: "Tarefas", icon: CheckSquare },
    { id: "coins", label: "OmniCoins", icon: Coins },
  ] as const;

  return (
    <div
      className="w-full rounded-2xl overflow-hidden bg-white border border-slate-200/90 shadow-2xl transition-all duration-300"
      style={{ boxShadow: "0 20px 50px -10px rgba(15, 23, 42, 0.12), 0 0 1px rgba(15, 23, 42, 0.15)" }}
    >
      {/* Window Top Bar */}
      <div className="h-10 bg-slate-100 border-b border-slate-200 flex items-center px-3 sm:px-4 justify-between select-none">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <div className="w-3 h-3 rounded-full bg-rose-400 shrink-0" />
          <div className="w-3 h-3 rounded-full bg-amber-400 shrink-0" />
          <div className="w-3 h-3 rounded-full bg-emerald-400 shrink-0" />
          <div className="ml-1.5 sm:ml-3 px-2 sm:px-3 py-1 rounded bg-white border border-slate-200 text-slate-700 font-mono text-[10px] sm:text-[11px] flex items-center gap-1.5 sm:gap-2 shadow-2xs min-w-[150px] max-w-[58vw]">
            <Lock className="w-3 h-3 text-emerald-600 shrink-0" />
            <span className="truncate">app.omnizeus.com.br/dashboard</span>
          </div>
        </div>
        <div className="hidden lg:flex items-center gap-2 text-slate-500 text-xs shrink-0">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-mono text-[10px] uppercase tracking-wider text-slate-600 font-semibold">Ambiente Seguro Multi-Tenant</span>
        </div>
      </div>

      {/* App Tab Switcher */}
      <div className="bg-slate-50 border-b border-slate-200 p-1.5 flex items-center gap-1 overflow-x-auto scrollbar-none">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all whitespace-nowrap ${
                isActive
                  ? "bg-white text-primary shadow-xs border border-slate-200/80 font-bold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? "text-primary" : "text-slate-400"}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Content Canvas */}
      <div className="bg-white p-4 lg:p-6 min-h-[380px] lg:min-h-[420px] flex flex-col justify-between">
        {activeTab === "dashboard" && (
          <div className="space-y-4 animate-in fade-in duration-300">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/80 shadow-xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Faturamento Mês</span>
                <span className="text-lg font-bold text-slate-900 block">R$ 54.800</span>
                <span className="text-[11px] font-bold text-emerald-600">↑ 14% vs anterior</span>
              </div>
              <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/80 shadow-xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Clientes Ativos</span>
                <span className="text-lg font-bold text-slate-900 block">162</span>
                <span className="text-[11px] font-bold text-emerald-600">+5 neste mês</span>
              </div>
              <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/80 shadow-xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Tarefas Equipe</span>
                <span className="text-lg font-bold text-slate-900 block">18 na fila</span>
                <span className="text-[11px] font-bold text-amber-600">3 urgentes</span>
              </div>
              <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/80 shadow-xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Saldo OmniCoins</span>
                <span className="text-lg font-bold text-primary block">15.000</span>
                <span className="text-[11px] font-bold text-slate-500">Plano Premium</span>
              </div>
            </div>

            {/* Smooth Recharts-like Line SVG */}
            <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">Evolução Mensal de Faturamento & Operação</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase">Jan – Jul 2026</span>
              </div>
              <div className="h-28 w-full flex items-end pt-2">
                <svg className="w-full h-full overflow-visible" viewBox="0 0 400 90" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="gradDash" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#1E6FD9" stopOpacity="0.2" />
                      <stop offset="100%" stopColor="#1E6FD9" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  <path d="M0,70 Q50,40 100,55 T200,30 T300,45 T400,10 L400,90 L0,90 Z" fill="url(#gradDash)" />
                  <path d="M0,70 Q50,40 100,55 T200,30 T300,45 T400,10" fill="none" stroke="#1E6FD9" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              </div>
            </div>

            {/* Activity Stream */}
            <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/80 shadow-xs flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary" />
                <span className="font-semibold text-slate-700">IA resolveu consulta fiscal sobre Simples Nacional (DAS)</span>
              </div>
              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 font-bold rounded text-[10px] shrink-0 border border-emerald-200">
                Concluído
              </span>
            </div>
          </div>
        )}

        {activeTab === "omni-ia" && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                <div className="flex items-center gap-2">
                  <Bot className="w-4 h-4 text-primary" />
                  <span className="text-xs font-bold text-slate-900">Hub de Inteligência Artificial — 15 Modelos Nativos</span>
                </div>
                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 font-bold text-[10px] rounded border border-emerald-200">
                  Engine Proprietária OmniAI
                </span>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                {["GPT-5.5", "Claude Code", "Claude 3.7", "Gemini 3.6 Pro"].map((m, idx) => (
                  <div key={m} className={`p-2 rounded-lg border text-center font-bold ${idx === 0 ? 'bg-primary text-white border-primary shadow-2xs' : 'bg-white text-slate-700 border-slate-200'}`}>
                    {m}
                  </div>
                ))}
              </div>

              <div className="p-3 bg-white rounded-lg border border-slate-200/80 text-xs text-slate-700 space-y-1 shadow-2xs">
                <span className="font-bold text-primary block">Parecer Especializado do Agente Fiscal:</span>
                <p className="text-[11px] leading-relaxed text-slate-600">
                  &quot;Com base no enquadramento do Simples Nacional da empresa contratante, a alíquota efetiva calculada para o Anexo III no faturamento acumulado é de 8.2%. A DCTFWeb vence no dia 15.&quot;
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === "contaazul" && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                <div className="flex items-center gap-2">
                  <LinkIcon className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-bold text-slate-900">Integração Bi-direcional Conta Azul</span>
                </div>
                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 font-bold text-[10px] rounded border border-emerald-200">
                  API Conectada
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2.5 bg-white border border-emerald-200/80 rounded-lg shadow-2xs">
                  <span className="text-[10px] text-slate-500 block">Clientes Sincronizados</span>
                  <span className="font-bold text-emerald-800 text-sm">142</span>
                </div>
                <div className="p-2.5 bg-white border border-emerald-200/80 rounded-lg shadow-2xs">
                  <span className="text-[10px] text-slate-500 block">Vendas do Mês</span>
                  <span className="font-bold text-emerald-800 text-sm">R$ 68.400</span>
                </div>
                <div className="p-2.5 bg-white border border-emerald-200/80 rounded-lg shadow-2xs">
                  <span className="text-[10px] text-slate-500 block">DRE em Tempo Real</span>
                  <span className="font-bold text-emerald-800 text-sm">Disponível</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "financeiro" && (
          <div className="space-y-3 animate-in fade-in duration-300">
            <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900">Contas a Pagar & Tributos Fiscais</span>
                <span className="text-[10px] text-slate-400 font-mono">Julho 2026</span>
              </div>
              <div className="divide-y divide-slate-200/60 text-xs">
                <div className="py-2 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-800 block">DAS Simples Nacional</span>
                    <span className="text-[10px] text-slate-400">Vencimento: 20/07/2026</span>
                  </div>
                  <span className="font-bold text-slate-900">R$ 4.250,00</span>
                </div>
                <div className="py-2 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-800 block">Honorários Softwares BPO</span>
                    <span className="text-[10px] text-slate-400">Vencimento: 25/07/2026</span>
                  </div>
                  <span className="font-bold text-slate-900">R$ 890,00</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "tarefas" && (
          <div className="space-y-3 animate-in fade-in duration-300">
            <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900">Gestão de SOPs & Cronômetro de Tempo</span>
                <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">Visão Gestor</span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="p-2.5 bg-white border border-slate-200 rounded-lg flex items-center justify-between shadow-2xs">
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                    <span className="font-semibold text-slate-800">Conferência de Folha de Pagamento</span>
                  </div>
                  <span className="font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">00:42:15</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "coins" && (
          <div className="space-y-3 animate-in fade-in duration-300">
            <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Coins className="w-4 h-4 text-amber-500" />
                  <span className="text-xs font-bold text-slate-900">Painel de Consumo de Franquia IA</span>
                </div>
                <span className="text-xs font-bold text-slate-700">15.000 Coins / mês</span>
              </div>
              <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                <div className="bg-amber-500 h-full rounded-full" style={{ width: "35%" }} />
              </div>
              <div className="flex justify-between text-[11px] text-slate-500 font-medium">
                <span>5.250 Utilizados (35%)</span>
                <span>9.750 Disponíveis</span>
              </div>
            </div>
          </div>
        )}

        {/* Footer Note inside Preview */}
        <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-2 text-[11px] text-slate-400 flex-wrap">
          <span className="flex items-center gap-1.5 text-slate-500 font-medium min-w-0">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>Engine de IA Nativamente Integrada ao Banco de Dados & ERP.</span>
          </span>
          <span className="font-semibold text-primary shrink-0">OmniZeus v2.5 Enterprise</span>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   Navbar
───────────────────────────────────────── */
const NAV_LINKS = [
  { label: "Plataforma", href: "#produto" },
  { label: "Módulos", href: "#modulos" },
  { label: "Inteligência Artificial", href: "#ia" },
  { label: "Conta Azul", href: "#contaazul" },
  { label: "OmniCoins", href: "#omnicoins" },
  { label: "Planos & Preços", href: "#planos" },
  { label: "FAQ", href: "#faq" },
];

function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-200 ${
        scrolled ? "bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs py-2.5" : "bg-white border-b border-slate-100 py-3.5"
      }`}
    >
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center group-hover:opacity-90 transition-opacity shadow-xs">
            <span className="text-white font-bold text-xs tracking-tight">Z</span>
          </div>
          <span className="text-base font-bold text-slate-900 tracking-tight">OmniZeus</span>
        </Link>

        <nav className="hidden lg:flex items-center gap-7">
          {NAV_LINKS.map((l) => (
            <a
              key={l.label}
              href={l.href}
              className="text-xs font-semibold text-slate-600 hover:text-primary transition-colors"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden lg:flex items-center gap-3">
          <Link
            href="/login"
            className="text-xs font-bold text-slate-700 hover:text-slate-900 px-3.5 py-2 rounded-lg transition-colors"
          >
            Entrar
          </Link>
          <Link
            href="#planos"
            className="text-xs font-bold bg-primary hover:opacity-90 text-white px-5 py-2.5 rounded-xl transition-all shadow-xs inline-flex items-center gap-1.5"
          >
            <span>Começar agora</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <button
          className="lg:hidden p-2 text-slate-600 hover:text-slate-900"
          onClick={() => setOpen(!open)}
        >
          {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {open && (
        <div className="lg:hidden border-t border-slate-200 bg-white px-4 sm:px-6 py-5 flex flex-col gap-3 shadow-xl">
          {NAV_LINKS.map((l) => (
            <a
              key={l.label}
              href={l.href}
              className="text-sm font-semibold text-slate-700 py-1"
              onClick={() => setOpen(false)}
            >
              {l.label}
            </a>
          ))}
          <div className="flex flex-col gap-2 pt-3 border-t border-slate-100 mt-2">
            <Link
              href="/login"
              className="text-xs text-center font-bold text-slate-700 py-2.5 border border-slate-200 rounded-xl"
            >
              Entrar no Sistema
            </Link>
            <Link
              href="#planos"
              onClick={() => setOpen(false)}
              className="text-xs text-center font-bold bg-primary text-white py-2.5 rounded-xl shadow-xs"
            >
              Ver Planos & Contratar
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

/* ─────────────────────────────────────────
   Hero Section — Primeira Dobra (Sem ícone na pill)
───────────────────────────────────────── */
function Hero() {
  return (
    <section className="pt-24 pb-16 sm:pt-28 lg:pt-36 lg:pb-28 bg-gradient-to-b from-slate-50/80 via-white to-white border-b border-slate-100">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:grid lg:grid-cols-12 gap-8 lg:gap-8 items-center">
          
          {/* Mockup do Site / AppPreview — PRIMEIRO NO MOBILE */}
          <div className="w-full lg:col-span-6 min-w-0 order-1 lg:order-2" id="produto">
            <AppPreview />
          </div>

          {/* Textos, Descrições e Botões — SEGUNDO NO MOBILE */}
          <div className="w-full lg:col-span-6 space-y-6 text-center lg:text-left min-w-0 order-2 lg:order-1">
            <div className="inline-flex items-center px-3.5 py-1 bg-primary/10 border border-primary/20 rounded-full text-primary text-[11px] font-bold tracking-wide uppercase mx-auto lg:mx-0">
              <span>Plataforma Integrada de Operação & IA</span>
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-[54px] font-bold text-slate-900 leading-[1.1] tracking-tight">
              Gestão, automação e IA em um único ambiente.
            </h1>

            <p className="text-sm sm:text-lg text-slate-600 leading-relaxed max-w-xl mx-auto lg:mx-0">
              Unifique a operação do seu escritório contábil ou prestação de BPO Financeiro. Conecte dados do Conta Azul, automatize tarefas e utilize agentes de IA contextualizados com a sua empresa.
            </p>

            <div className="flex items-center justify-center lg:justify-start gap-3.5 pt-2">
              <a
                href="#produto"
                className="inline-flex items-center justify-center gap-2 bg-primary hover:opacity-90 text-white text-sm font-bold px-7 py-3.5 rounded-xl transition-all shadow-md hover:shadow-lg"
              >
                <Play className="w-4 h-4 text-white fill-white/20" />
                <span>Conhecer a plataforma</span>
              </a>
            </div>

            {/* Trust Badges */}
            <div className="pt-6 border-t border-slate-200/70 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-500 font-semibold justify-items-center lg:justify-items-start">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                Sem implantação complexa
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                Ativação em menos de 5 min
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                Franquia de IA incluída
              </span>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────
   Público-Alvo & Confiança (Suave Bege / Cinza Fraco)
───────────────────────────────────────── */
function TrustBar() {
  return (
    <section className="py-10 bg-[#FAF9F6] border-y border-slate-200/90 text-slate-900">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500 text-center mb-6">
          Desenvolvido para Escritórios Contábeis & Prestadores de BPO Financeiro no Brasil
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <div className="p-3">
            <span className="text-2xl lg:text-3xl font-bold text-slate-900 block">100%</span>
            <span className="text-xs text-slate-600 font-semibold">Multi-tenant Isolado</span>
          </div>
          <div className="p-3">
            <span className="text-2xl lg:text-3xl font-bold text-slate-900 block">15</span>
            <span className="text-xs text-slate-600 font-semibold">Modelos LLM Nativos</span>
          </div>
          <div className="p-3">
            <span className="text-2xl lg:text-3xl font-bold text-slate-900 block">API</span>
            <span className="text-xs text-slate-600 font-semibold">Integração Conta Azul</span>
          </div>
          <div className="p-3">
            <span className="text-2xl lg:text-3xl font-bold text-slate-900 block">LGPD</span>
            <span className="text-xs text-slate-600 font-semibold">Conformidade & Auditoria</span>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────
   Tudo em um Só Lugar (6 Módulos Estruturais)
───────────────────────────────────────── */
function FeaturesModules() {
  const modules = [
    {
      icon: DollarSign,
      title: "Gestão Financeira",
      desc: "Visualize contas a pagar, acompanhe DAS, DARF e evolução mensal de gastos em curva Recharts com exportação em PDF."
    },
    {
      icon: LinkIcon,
      title: "Integração Conta Azul",
      desc: "Conecte a API do Conta Azul e consulte clientes, vendas, fornecedores e relatórios financeiros diretamente na plataforma."
    },
    {
      icon: Bot,
      title: "Omni IA Hub",
      desc: "15 modelos de inteligência artificial de ponta (GPT-5.5, Claude Code, Claude 3.7 Sonnet, Gemini 3.6 Pro, DeepSeek V4) nativamente calibrados com o contexto da sua empresa."
    },
    {
      icon: CheckSquare,
      title: "Tarefas Operacionais",
      desc: "Crie e distribua SOPs da equipe com cronômetro de tempo gasto automático e resolução de dúvidas assistida por IA."
    },
    {
      icon: FileCheck,
      title: "Solicitações & Compras",
      desc: "Organize o fluxo de requisições de clientes, controle aprovações pelo gestor e evite gargalos na operação BPO."
    },
    {
      icon: FileText,
      title: "Documentos & Apresentações",
      desc: "Gere minutas de contratos e notificações fiscais em formato folha A4 e decks de apresentações com 7 temas."
    }
  ];

  return (
    <section className="py-24 bg-white border-b border-slate-100" id="modulos">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
          <span className="text-xs font-bold text-primary uppercase tracking-widest bg-primary/10 px-3 py-1 rounded-full border border-primary/20">
            Tudo em um Só Lugar
          </span>
          <h2 className="text-3xl lg:text-4xl font-bold text-slate-900 tracking-tight">
            Seis Módulos Estruturais. Uma Única Operação.
          </h2>
          <p className="text-sm text-slate-500">
            Elimine a dispersão de ferramentas e centralize a rotina contábil e de BPO em um ambiente corporativo integrado.
          </p>
        </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {modules.map((m) => {
            const Icon = m.icon;
            return (
              <div
                key={m.title}
                className="p-7 rounded-2xl border border-slate-200/80 bg-white text-slate-900 transition-all duration-200 hover:shadow-md"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-5">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold mb-2 text-slate-900">{m.title}</h3>
                <p className="text-xs leading-relaxed text-slate-500">{m.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────
   Diferencial da IA Contextual
───────────────────────────────────────── */
function AIDifferential() {
  return (
    <section className="py-24 bg-slate-50/70 border-b border-slate-200/80" id="ia">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-5 space-y-6 min-w-0">
            <span className="text-xs font-bold text-primary uppercase tracking-widest bg-primary/10 px-3 py-1 rounded-full border border-primary/20">
              Diferencial da IA
            </span>
            <h2 className="text-3xl lg:text-4xl font-bold text-slate-900 tracking-tight leading-tight">
              IA que entende o contexto real da sua operação.
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Não oferecemos apenas um chatbot genérico. Nossa engine proprietária de contexto combina as regras do seu escritório, o segmento da empresa e as diretrizes internas antes de processar qualquer consulta.
            </p>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs flex items-start gap-3">
                <Bot className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-900 block font-bold mb-0.5">Omni IA Hub (15 LLMs Nativos)</strong>
                  <span className="text-slate-500">Modelos de última geração como GPT-5.5, Claude Code e Gemini 3.6 Pro prontos para pareceres fiscais, societários e de BPO.</span>
                </div>
              </div>

              <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs flex items-start gap-3">
                <LinkIcon className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-900 block font-bold mb-0.5">Omni Conta Azul IA</strong>
                  <span className="text-slate-500">Agentes treinados especificamente em consultas de vendas, recebíveis e conciliação financeira do Conta Azul.</span>
                </div>
              </div>

              <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs flex items-start gap-3">
                <FileText className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-900 block font-bold mb-0.5">Geradores Assistidos por IA</strong>
                  <span className="text-slate-500">Criação automatizada de minutas de contratos A4 e apresentações executivas personalizadas.</span>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 bg-white p-6 lg:p-8 rounded-2xl border border-slate-200 shadow-lg space-y-6 min-w-0">
            <div className="border-b border-slate-100 pb-4">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Arquitetura do Motor de IA Contextual</h3>
              <p className="text-xs text-slate-500">Como o motor proprietário garante respostas precisas</p>
            </div>

            <div className="space-y-3">
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
                <span className="font-bold text-slate-800 uppercase text-[10px] tracking-wider block">1. Injeção de Contexto da Empresa</span>
                <p className="text-slate-600">Regras tributárias da empresa contratante + segmento + notas internas ativas.</p>
              </div>

              <div className="flex justify-center">
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </div>

              <div className="p-3.5 bg-primary/10 border border-primary/30 rounded-xl text-xs space-y-1">
                <span className="font-bold text-primary uppercase text-[10px] tracking-wider block">2. Seleção Inteligente de Modelo</span>
                <p className="text-slate-700">Motor NATIVO OmniZeus seleciona o modelo de IA ideal com menor tempo de resposta e máxima precisão.</p>
              </div>

              <div className="flex justify-center">
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </div>

              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs space-y-1">
                <span className="font-bold text-emerald-800 uppercase text-[10px] tracking-wider block">3. Resposta Técnica sem Alucinações</span>
                <p className="text-emerald-900 font-medium">Saída formatada com precisão operacional e histórico gravado no banco SQL.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────
   Conta Azul como Diferencial (Bege Suave / Cinza Fraco)
───────────────────────────────────────── */
function ContaAzulSection() {
  return (
    <section className="py-24 bg-white border-b border-slate-100" id="contaazul">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
          <span className="text-xs font-bold text-emerald-700 uppercase tracking-widest bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
            Integração Conta Azul
          </span>
          <h2 className="text-3xl lg:text-4xl font-bold text-slate-900 tracking-tight">
            Sua Operação Financeira Conectada ao Conta Azul.
          </h2>
          <p className="text-sm text-slate-500">
            Centralize a consulta e a gestão de clientes, fornecedores e lançamentos financeiros sem precisar ficar alternando entre abas e sistemas.
          </p>
        </div>

        {/* Integration Diagram in Warm Soft Beige */}
        <div className="bg-[#FAF8F5] border border-slate-200/90 text-slate-900 rounded-2xl p-8 lg:p-12 shadow-sm space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 text-center items-center">
            <div className="p-4 bg-white rounded-xl border border-slate-200 font-bold text-sm text-slate-900 shadow-2xs">
              Plataforma OmniZeus
            </div>
            <div className="text-slate-500 font-mono text-xs hidden md:block">➔ API ➔</div>
            <div className="p-4 bg-emerald-600 rounded-xl font-bold text-sm text-white shadow-xs">
              ERP Conta Azul
            </div>
            <div className="text-slate-500 font-mono text-xs hidden md:block">➔ Dados ➔</div>
            <div className="p-4 bg-white rounded-xl border border-slate-200 font-bold text-xs space-y-1 text-slate-900 shadow-2xs">
              <span className="block text-emerald-700 font-bold">Clientes & Vendas</span>
              <span className="block text-slate-600">Cobranças & Notas</span>
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-4 pt-6 border-t border-slate-200 text-xs">
            <div className="space-y-1">
              <strong className="text-slate-900 block font-bold">Consultas Rápidas</strong>
              <p className="text-slate-600">Acesse status financeiro de clientes em segundos pelo chat assistido por IA.</p>
            </div>
            <div className="space-y-1">
              <strong className="text-slate-900 block font-bold">Visualização Consolidada</strong>
              <p className="text-slate-600">Painéis limpos e métricas consolidadas diretamente na sua conta OmniZeus.</p>
            </div>
            <div className="space-y-1">
              <strong className="text-slate-900 block font-bold">Segurança de Acesso</strong>
              <p className="text-slate-600">Credenciais criptografadas via OAuth2 com atualização de token automática.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────
   OmniCoins System (Com Explicação Aprimorada)
───────────────────────────────────────── */
function OmniCoinsSection() {
  return (
    <section className="py-24 bg-slate-50/70 border-b border-slate-200/80" id="omnicoins">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-6 space-y-6 min-w-0">
            <span className="text-xs font-bold text-amber-800 uppercase tracking-widest bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
              Sistema OmniCoins
            </span>
            <h2 className="text-3xl lg:text-4xl font-bold text-slate-900 tracking-tight leading-tight">
              Franquia Mensal de IA com Previsibilidade & Controle Total.
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed font-medium">
              Zero surpresas na fatura no final do mês. O sistema de OmniCoins funciona como a franquia de créditos mensal do seu escritório. Cada consulta fiscal, parecer tributário ou geração de documentos consome uma quantia exata e auditável, garantindo controle orçamentário completo.
            </p>

            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs space-y-2 text-xs">
              <div className="flex items-center justify-between font-bold text-slate-900">
                <span>Exemplo: Plano Premium (15.000 OmniCoins)</span>
                <span className="text-amber-600">Renovação Mensal</span>
              </div>
              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                <div className="bg-amber-500 h-full rounded-full" style={{ width: "65%" }} />
              </div>
              <p className="text-slate-500 text-[11px]">
                Acompanhe o extrato detalhado de consumo por colaborador e por modelo de IA diretamente no seu painel.
              </p>
            </div>
          </div>

          <div className="lg:col-span-6 bg-white p-6 lg:p-8 rounded-2xl border border-slate-200 shadow-lg space-y-4 min-w-0">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 uppercase tracking-wider">
              Consumo Típico por Recurso de IA
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="font-semibold text-slate-800">Consulta Rápida no Omni IA Hub</span>
                <span className="font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">~ 10 a 25 Coins</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="font-semibold text-slate-800">Análise Financeira no Conta Azul IA</span>
                <span className="font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">~ 20 a 40 Coins</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="font-semibold text-slate-800">Geração de Minuta de Contrato A4</span>
                <span className="font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">~ 50 Coins</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="font-semibold text-slate-800">Deck de Apresentação de Slides</span>
                <span className="font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">~ 80 Coins</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────
   Nova Seção — FaqCard & HorizontalScroller (Adaptado)
───────────────────────────────────────── */
const FaqCard = ({ question, answer }: { question: string; answer: string }) => {
  return (
    <div className="flex flex-col justify-between gap-3 p-6 bg-white rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition-all w-[280px] sm:w-[380px] flex-shrink-0 text-left">
      <div className="space-y-2">
        <span className="text-[10px] font-extrabold text-primary uppercase tracking-wider bg-primary/10 px-2.5 py-0.5 rounded-full border border-primary/20">
          Dúvida Frequente
        </span>
        <h3 className="text-sm font-bold text-slate-900 leading-snug">{question}</h3>
        <p className="text-xs text-slate-600 leading-relaxed font-medium">{answer}</p>
      </div>
    </div>
  );
};

const HorizontalScroller = ({
  children,
  speed = "40s",
  direction = "left"
}: {
  children: React.ReactNode;
  speed?: string;
  direction?: "left" | "right";
}) => {
  const animationClass =
    direction === "right" ? "animate-scroll-horizontal-reverse" : "animate-scroll-horizontal";

  const style = { "--scroll-duration": speed } as React.CSSProperties;

  return (
    <div className="w-full overflow-hidden group relative">
      <div className={`flex w-max ${animationClass}`} style={style}>
        <div className="flex items-stretch justify-center flex-shrink-0 gap-6 px-3">
          {children}
        </div>
        {/* Duplicate for seamless loop */}
        <div className="flex items-stretch justify-center flex-shrink-0 gap-6 px-3" aria-hidden="true">
          {children}
        </div>
      </div>
    </div>
  );
};

function HorizontalFaqSection() {
  const row1 = [
    {
      id: "1",
      question: "Como os OmniCoins garantem a previsibilidade de custos?",
      answer: "Cada plano inclui uma franquia fixa de OmniCoins renovada mensalmente, permitindo usar IA avançada sem surpresas ou cobranças variáveis."
    },
    {
      id: "2",
      question: "Os modelos de IA entendem a legislação contábil brasileira?",
      answer: "Sim! Nossa engine injeta as regras fiscais, anexo do Simples Nacional, tributos e o perfil da sua empresa em cada consulta."
    },
    {
      id: "3",
      question: "É possível integrar os dados do ERP Conta Azul em tempo real?",
      answer: "Com certeza. A integração é bi-direcional via API OAuth2, trazendo clientes, vendas, recebíveis e relatórios em tempo real."
    },
    {
      id: "4",
      question: "Como funciona o controle de acesso para colaboradores?",
      answer: "O Gestor define quais módulos cada colaborador pode acessar, mantendo sigilo financeiro e controle total de tarefas e IA."
    }
  ];

  const row2 = [
    {
      id: "5",
      question: "A plataforma necessita de instalação local de programas?",
      answer: "Não. O OmniZeus é 100% em nuvem (SaaS), acessível por qualquer navegador com suporte multi-tenant e segurança auditável."
    },
    {
      id: "6",
      question: "O que acontece se a equipe utilizar todos os OmniCoins do mês?",
      answer: "A operação de tarefas e finanças continua normal. Para manter consultas de IA ativas, é possível recarregar pacotes adicionais ou fazer upgrade."
    },
    {
      id: "7",
      question: "Posso gerar minutas de contratos e propostas prontas em PDF?",
      answer: "Sim! O módulo de Documentos gera folhas A4 prontas com layout corporativo e exportação direta em PDF."
    },
    {
      id: "8",
      question: "O suporte atende dúvidas de BPO Financeiro e tributário?",
      answer: "Sim, nossa equipe e base de dados são focadas na rotina de escritórios de contabilidade e prestadores de BPO no Brasil."
    }
  ];

  return (
    <section className="py-20 bg-[#FAF8F5] border-b border-slate-200/90 overflow-hidden">
      <style>{`
        @keyframes scrollHorizontal {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-50%); }
        }
        @keyframes scrollHorizontalReverse {
          0% { transform: translateX(-50%); }
          100% { transform: translateX(0%); }
        }
        .animate-scroll-horizontal {
          animation: scrollHorizontal var(--scroll-duration, 40s) linear infinite;
        }
        .animate-scroll-horizontal-reverse {
          animation: scrollHorizontalReverse var(--scroll-duration, 40s) linear infinite;
        }
        .animate-scroll-horizontal:hover, .animate-scroll-horizontal-reverse:hover {
          animation-play-state: paused;
        }
      `}</style>

      <div className="max-w-[1400px] mx-auto px-6 lg:px-8 mb-12 text-center space-y-3">
        <span className="text-xs font-bold text-primary uppercase tracking-widest bg-primary/10 px-3 py-1 rounded-full border border-primary/20">
          Respostas em Carrossel Contínuo
        </span>
        <h2 className="text-3xl lg:text-4xl font-bold text-slate-900 tracking-tight">
          Entenda como a Plataforma Impulsiona seu Escritório
        </h2>
        <p className="text-sm text-slate-600 max-w-2xl mx-auto font-medium">
          Passe o ponteiro sobre os cards para pausar o movimento e explorar as dúvidas mais frequentes.
        </p>
      </div>

      <div className="space-y-6">
        <HorizontalScroller speed="40s" direction="left">
          {row1.map((item) => (
            <FaqCard key={item.id} question={item.question} answer={item.answer} />
          ))}
        </HorizontalScroller>

        <HorizontalScroller speed="50s" direction="right">
          {row2.map((item) => (
            <FaqCard key={item.id} question={item.question} answer={item.answer} />
          ))}
        </HorizontalScroller>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────
   Planos & Preços (Conversão Principal)
───────────────────────────────────────── */
function PricingSection({
  onSelectPlan
}: {
  onSelectPlan?: (plan: "test_1_real" | "profissional" | "premium" | "business") => void;
}) {
  const [yearly, setYearly] = useState(false);

  const plans = [
    {
      name: "PROFESSIONAL",
      price: 490,
      yearlyPrice: 392,
      coins: "5.000",
      target: "Para escritórios que estão estruturando a operação digital.",
      highlight: false,
      ctaText: "Escolher Professional",
      features: [
        "Plataforma Multi-Tenant completa",
        "5.000 OmniCoins / mês de IA",
        "Gestão Financeira & Contas a Pagar",
        "Integração com Conta Azul",
        "Omni IA Hub (15 modelos LLM)",
        "Gestão de Tarefas & SOPs",
        "Gerador de Documentos A4",
        "Suporte por e-mail"
      ]
    },
    {
      name: "PREMIUM",
      badge: "MAIS ESCOLHIDO / MELHOR CUSTO-BENEFÍCIO",
      price: 890,
      yearlyPrice: 712,
      coins: "15.000",
      target: "Para escritórios em crescimento que buscam a experiência completa.",
      highlight: true,
      ctaText: "Escolher Premium",
      features: [
        "Tudo do plano Professional",
        "15.000 OmniCoins / mês de IA (3x mais)",
        "Agentes de IA Contextualizados",
        "Omni Conta Azul IA Avançado",
        "Gerador de Apresentações Executivas",
        "Central de Solicitações BPO",
        "Relatórios de Rentabilidade em PDF",
        "Suporte prioritário"
      ]
    },
    {
      name: "BUSINESS",
      price: 1990,
      yearlyPrice: 1592,
      coins: "50.000",
      target: "Para operações de grande porte com alto volume e equipe expansiva.",
      highlight: false,
      ctaText: "Escolher Business",
      features: [
        "Tudo do plano Premium",
        "50.000 OmniCoins / mês de IA",
        "Multi-Tenant Avançado",
        "Capacidade estendida de equipe",
        "API dedicada para integrações",
        "SLA de disponibilidade prioritário",
        "Suporte dedicado 24/7"
      ]
    }
  ];

  const fmt = (n: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(n);

  return (
    <section className="py-24 bg-white border-b border-slate-100" id="planos">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12 space-y-4">
          <span className="text-xs font-bold text-primary uppercase tracking-widest bg-primary/10 px-3 py-1 rounded-full border border-primary/20">
            Planos & Investimento
          </span>
          <h2 className="text-3xl lg:text-4xl font-bold text-slate-900 tracking-tight">
            Planos Transparentes e Previsíveis.
          </h2>
          <p className="text-sm text-slate-500">
            Escolha o plano ideal para a capacidade do seu escritório. Sem custos de implantação.
          </p>

          {/* Monthly / Yearly Selector & Test Plan Button */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <div className="bg-slate-100 p-1 rounded-xl border border-slate-200 inline-flex items-center gap-1">
              <button
                onClick={() => setYearly(false)}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                  !yearly ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Mensal
              </button>
              <button
                onClick={() => setYearly(true)}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  yearly ? "bg-emerald-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <span>Anual</span>
                <span className="px-1.5 py-0.5 bg-white/20 text-white text-[9px] rounded-full uppercase font-extrabold">
                  -20% OFF
                </span>
              </button>
            </div>

            <button
              onClick={() => onSelectPlan && onSelectPlan("test_1_real")}
              className="px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition-all cursor-pointer"
            >
              <span className="px-1.5 py-0.5 bg-amber-600 text-white rounded text-[9px] font-extrabold uppercase">
                Teste R$ 1,00
              </span>
              <span>🧪 Testar Checkout Real com R$ 1,00</span>
              <ArrowRight className="w-3.5 h-3.5 text-amber-700" />
            </button>
          </div>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
          {plans.map((p) => (
            <div
              key={p.name}
              className={`rounded-2xl p-8 flex flex-col justify-between transition-all duration-300 relative ${
                p.highlight
                  ? "bg-white text-slate-900 border-2 border-emerald-500 shadow-xl shadow-emerald-500/10 scale-[1.02] z-10"
                  : "bg-white text-slate-900 border border-slate-200 shadow-md"
              }`}
            >
              {p.badge && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-emerald-600 text-white text-[10px] font-extrabold uppercase px-3.5 py-1 rounded-full tracking-wider shadow-sm">
                  {p.badge}
                </div>
              )}

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold uppercase tracking-widest ${p.highlight ? "text-emerald-700" : "text-slate-400"}`}>
                    {p.name}
                  </span>
                  <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded ${p.highlight ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-slate-100 text-slate-700"}`}>
                    {p.coins} Coins/mês
                  </span>
                </div>

                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-extrabold tracking-tight text-slate-900">
                      {fmt(yearly ? p.yearlyPrice : p.price)}
                    </span>
                    <span className="text-xs font-medium text-slate-500">
                      /mês
                    </span>
                  </div>
                  <span className="text-[11px] block mt-1 text-slate-500">
                    {yearly ? "Faturado anualmente com desconto de 20%" : "Faturamento mensal via cartão ou boleto"}
                  </span>
                </div>

                <p className="text-xs leading-relaxed text-slate-600">
                  {p.target}
                </p>

                <div className="pt-6 border-t border-slate-100 space-y-3 text-xs">
                  {p.features.map((f) => (
                    <div key={f} className="flex items-start gap-2.5">
                      <Check className={`w-4 h-4 shrink-0 mt-0.5 ${p.highlight ? "text-emerald-600" : "text-slate-400"}`} />
                      <span className="text-slate-700">{f}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-8">
                <button
                  type="button"
                  onClick={() => onSelectPlan && onSelectPlan(p.name.toLowerCase() as any)}
                  className={`w-full py-3.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-xs ${
                    p.highlight
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                      : "bg-slate-900 hover:bg-slate-800 text-white"
                  }`}
                >
                  <span>{p.ctaText}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Matrix Comparison Table */}
        <div className="mt-20 space-y-6">
          <div className="text-center space-y-2">
            <h3 className="text-xl font-bold text-slate-900">Tabela de Comparação de Recurso por Plano</h3>
            <p className="text-xs text-slate-500">Veja detalhadamente os recursos incluídos em cada modalidade.</p>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-xs">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-700 font-bold">
                  <th className="p-4">Recurso / Funcionalidade</th>
                  <th className="p-4 text-center">Professional</th>
                  <th className="p-4 text-center bg-emerald-50/60 text-emerald-800 font-bold">Premium (Recomendado)</th>
                  <th className="p-4 text-center">Business</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                <tr>
                  <td className="p-4 font-bold text-slate-900">Franquia Mensal de OmniCoins</td>
                  <td className="p-4 text-center font-mono font-bold">5.000</td>
                  <td className="p-4 text-center font-mono font-bold bg-emerald-50/60 text-emerald-900">15.000</td>
                  <td className="p-4 text-center font-mono font-bold">50.000</td>
                </tr>
                <tr>
                  <td className="p-4">Plataforma Multi-Tenant com Perfil por Empresa</td>
                  <td className="p-4 text-center">✓</td>
                  <td className="p-4 text-center bg-emerald-50/60 text-emerald-800 font-bold">✓</td>
                  <td className="p-4 text-center">✓</td>
                </tr>
                <tr>
                  <td className="p-4">Gestão Financeira & Contas a Pagar</td>
                  <td className="p-4 text-center">✓</td>
                  <td className="p-4 text-center bg-emerald-50/60 text-emerald-800 font-bold">✓</td>
                  <td className="p-4 text-center">✓</td>
                </tr>
                <tr>
                  <td className="p-4">Integração Bi-direcional Conta Azul</td>
                  <td className="p-4 text-center">✓</td>
                  <td className="p-4 text-center bg-emerald-50/60 text-emerald-800 font-bold">✓</td>
                  <td className="p-4 text-center">✓</td>
                </tr>
                <tr>
                  <td className="p-4">Omni IA Hub (15 Modelos LLM Nativos)</td>
                  <td className="p-4 text-center">✓</td>
                  <td className="p-4 text-center bg-emerald-50/60 text-emerald-800 font-bold">✓</td>
                  <td className="p-4 text-center">✓</td>
                </tr>
                <tr>
                  <td className="p-4">Omni Conta Azul IA Especializado</td>
                  <td className="p-4 text-center">Básico</td>
                  <td className="p-4 text-center bg-emerald-50/60 text-emerald-800 font-bold">Avançado</td>
                  <td className="p-4 text-center">Avançado</td>
                </tr>
                <tr>
                  <td className="p-4">Gerador de Documentos A4 (Contratos & Propostas)</td>
                  <td className="p-4 text-center">✓</td>
                  <td className="p-4 text-center bg-emerald-50/60 text-emerald-800 font-bold">✓</td>
                  <td className="p-4 text-center">✓</td>
                </tr>
                <tr>
                  <td className="p-4">Gerador de Apresentações Executivas (Slides)</td>
                  <td className="p-4 text-center text-slate-300">—</td>
                  <td className="p-4 text-center bg-emerald-50/60 text-emerald-800 font-bold">✓</td>
                  <td className="p-4 text-center">✓</td>
                </tr>
                <tr>
                  <td className="p-4">Central de Aprovações BPO & Solicitações</td>
                  <td className="p-4 text-center text-slate-300">—</td>
                  <td className="p-4 text-center bg-emerald-50/60 text-emerald-800 font-bold">✓</td>
                  <td className="p-4 text-center">✓</td>
                </tr>
                <tr>
                  <td className="p-4">Suporte & Atendimento</td>
                  <td className="p-4 text-center">E-mail</td>
                  <td className="p-4 text-center bg-emerald-50/60 text-emerald-800 font-bold">Prioritário</td>
                  <td className="p-4 text-center">Dedicado 24/7</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────
   Do Problema à Solução (Antes vs Com o OmniZeus)
───────────────────────────────────────── */
function TransformationSection() {
  return (
    <section className="py-24 bg-slate-50/70 border-b border-slate-200/80" id="transformacao">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
          <span className="text-xs font-bold text-primary uppercase tracking-widest bg-primary/10 px-3 py-1 rounded-full border border-primary/20">
            Transformação Operacional
          </span>
          <h2 className="text-3xl lg:text-4xl font-bold text-slate-900 tracking-tight">
            Do Problema à Solução Centralizada.
          </h2>
          <p className="text-sm text-slate-500">
            Veja a diferença entre operar com sistemas fragmentados e utilizar o ecossistema OmniZeus.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Before */}
          <div className="bg-white p-8 rounded-2xl border border-rose-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-rose-700 font-bold text-sm border-b border-rose-100 pb-3">
              <X className="w-5 h-5 text-rose-600" />
              <span>ANTES — Operação Fragmentada</span>
            </div>

            <ul className="space-y-3 text-xs text-slate-600">
              <li className="flex items-start gap-2.5">
                <span className="text-rose-500 font-bold">•</span>
                <span>Informações e dados do cliente espalhados em múltiplas ferramentas e planilhas.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-rose-500 font-bold">•</span>
                <span>Consultas fiscais e financeiras demoradas que dependem de checagens manuais.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-rose-500 font-bold">•</span>
                <span>Dificuldade para controlar o tempo gasto em cada tarefa operacional da equipe.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-rose-500 font-bold">•</span>
                <span>Uso de inteligência artificial de forma isolada em chatbots genéricos sem contexto.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-rose-500 font-bold">•</span>
                <span>Falta de controle transparente sobre os custos reais de IA no final do mês.</span>
              </li>
            </ul>
          </div>

          {/* After */}
          <div className="bg-white p-8 rounded-2xl border border-emerald-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm border-b border-emerald-100 pb-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>COM O OMNIZEUS — Operação Centralizada</span>
            </div>

            <ul className="space-y-3 text-xs text-slate-700 font-medium">
              <li className="flex items-start gap-2.5">
                <span className="text-emerald-600 font-bold">✓</span>
                <span>Painel executivo único conectando finanças, tarefas, solicitações e IA.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-emerald-600 font-bold">✓</span>
                <span>Dados do ERP Conta Azul disponíveis instantaneamente no ambiente de consulta.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-emerald-600 font-bold">✓</span>
                <span>Cronômetro automático e visão dual (Gestor vs Funcionário) para SOPs da equipe.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-emerald-600 font-bold">✓</span>
                <span>Agentes de IA treinados com as regras e perfil específico da sua empresa.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-emerald-600 font-bold">✓</span>
                <span>Franquia mensal de OmniCoins previsível e acompanhada em tempo real.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────
   Por que Escolher a Plataforma?
───────────────────────────────────────── */
function WhyChooseSection() {
  const pillars = [
    { title: "Gestão + IA Nativas", desc: "Não são ferramentas coladas. A IA funciona nativamente dentro da rotina de tarefas e finanças." },
    { title: "Integração Conta Azul", desc: "Consulte o ERP do cliente sem precisar trocar de abas ou reescrever dados manuais." },
    { title: "Agentes Especializados", desc: "15 modelos nativos direcionados para pareceres tributários, DRE e automação de solicitações." },
    { title: "Controle Auditável", desc: "Cada ação, troca de status e consumo de IA fica devidamente gravado nos logs do banco SQL." },
    { title: "Operação Centralizada", desc: "Menos senhas, menos custos com assinaturas espalhadas e maior controle gerencial." },
    { title: "Arquitetura Multi-Tenant", desc: "Segurança de nível enterprise com isolamento total dos dados de cada empresa contratante." }
  ];

  return (
    <section className="py-24 bg-white border-b border-slate-100" id="diferenciais">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
          <span className="text-xs font-bold text-primary uppercase tracking-widest bg-primary/10 px-3 py-1 rounded-full border border-primary/20">
            Diferenciais de Mercado
          </span>
          <h2 className="text-3xl lg:text-4xl font-bold text-slate-900 tracking-tight">
            Por que escolher o OmniZeus?
          </h2>
          <p className="text-sm text-slate-500">
            Seis pilares estratégicos construídos para dar escalabilidade à sua operação.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {pillars.map((p) => (
            <div key={p.title} className="p-6 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-2">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-primary" />
                <span>{p.title}</span>
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed pl-6">{p.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────
   Como Funciona (Processo)
───────────────────────────────────────── */
function HowItWorksSection() {
  const steps = [
    { num: "01", title: "Crie sua empresa", desc: "Cadastre o seu escritório em menos de 2 minutos no ambiente multi-tenant." },
    { num: "02", title: "Configure a equipe", desc: "Adicione colaboradores com senhas temporárias geradas automaticamente." },
    { num: "03", title: "Conecte sua operação", desc: "Insira suas chaves do Conta Azul e defina as regras internas da empresa." },
    { num: "04", title: "Utilize os Agentes de IA", desc: "Acesse o Hub de IA e consulte pareceres, tarefas e DRE com o contexto da empresa." },
    { num: "05", title: "Acompanhe os resultados", desc: "Monitore a rentabilidade e o saldo de OmniCoins no seu dashboard executivo." }
  ];

  return (
    <section className="py-24 bg-slate-50/70 border-b border-slate-200/80" id="como-funciona">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
          <span className="text-xs font-bold text-primary uppercase tracking-widest bg-primary/10 px-3 py-1 rounded-full border border-primary/20">
            Passo a Passo
          </span>
          <h2 className="text-3xl lg:text-4xl font-bold text-slate-900 tracking-tight">
            Como funciona na prática?
          </h2>
          <p className="text-sm text-slate-500">
            Onboarding simples e direto para colocar sua equipe operando em minutos.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {steps.map((s) => (
            <div key={s.num} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <span className="text-2xl font-black text-primary font-mono block">{s.num}</span>
              <h3 className="text-xs font-bold text-slate-900">{s.title}</h3>
              <p className="text-[11px] text-slate-500 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────
   FAQ — Perguntas Frequentes (Acordeão)
───────────────────────────────────────── */
function FAQSection() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  const faqs = [
    {
      q: "Os OmniCoins são renovados mensalmente?",
      a: "Sim! Cada plano inclui uma franquia mensal fixa de OmniCoins que é automaticamente renovada a cada novo ciclo de faturamento da sua assinatura."
    },
    {
      q: "Posso fazer upgrade do meu plano a qualquer momento?",
      a: "Com certeza. Você pode migrar do plano Professional para o Premium ou Business instantaneamente pelo painel, aproveitando o pro-rata dos OmniCoins extras."
    },
    {
      q: "O que acontece quando os OmniCoins do mês acabam?",
      a: "Você não perde o acesso às funções de gestão da plataforma. Para continuar efetuando consultas avançadas de IA no mesmo mês, você pode realizar a recarga de pacotes adicionais de OmniCoins."
    },
    {
      q: "A plataforma possui integração com o ERP Conta Azul?",
      a: "Sim, a integração com o Conta Azul é nativa via API OAuth2, permitindo consultar clientes, vendas, recebíveis e relatórios sem sair da interface."
    },
    {
      q: "A inteligência artificial já está incluída no valor do plano?",
      a: "Sim! Todos os planos acompanham sua respectiva franquia de OmniCoins incluída, garantindo acesso direto aos 15 modelos de IA do Omni IA Hub."
    },
    {
      q: "Posso cadastrar múltiplos colaboradores no meu escritório?",
      a: "Sim! O sistema é multi-tenant e conta com gestão completa de equipe, gerando senhas temporárias seguras para os colaboradores no primeiro acesso."
    },
    {
      q: "Como funciona o cancelamento da assinatura?",
      a: "Você pode solicitar o cancelamento a qualquer momento diretamente na sua conta, sem fidelidade forçada ou multas rescisórias ocultas."
    }
  ];

  return (
    <section className="py-24 bg-white border-b border-slate-100" id="faq">
      <div className="max-w-[900px] mx-auto px-6 lg:px-8 space-y-12">
        <div className="text-center space-y-3">
          <span className="text-xs font-bold text-primary uppercase tracking-widest bg-primary/10 px-3 py-1 rounded-full border border-primary/20">
            Dúvidas Frequentes
          </span>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">
            Perguntas Frequentes sobre a Plataforma
          </h2>
          <p className="text-sm text-slate-500">
            Respostas diretas para as principais dúvidas sobre recursos, planos e OmniCoins.
          </p>
        </div>

        <div className="space-y-3">
          {faqs.map((f, idx) => {
            const isOpen = openIdx === idx;
            return (
              <div
                key={f.q}
                className="border border-slate-200 rounded-2xl overflow-hidden transition-all bg-white"
              >
                <button
                  onClick={() => setOpenIdx(isOpen ? null : idx)}
                  className="w-full p-5 text-left flex items-center justify-between gap-4 font-bold text-xs text-slate-900 hover:bg-slate-50/80 transition-colors"
                >
                  <span>{f.q}</span>
                  {isOpen ? <ChevronUp className="w-4 h-4 text-primary shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
                </button>

                {isOpen && (
                  <div className="px-5 pb-5 pt-1 text-xs text-slate-600 leading-relaxed border-t border-slate-100 bg-slate-50/50">
                    {f.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────
   CTA Final de Conversão (Suave Bege / Cinza)
───────────────────────────────────────── */
function FinalCTA() {
  return (
    <section className="py-20 bg-[#FAF8F5] border-t border-slate-200/90 text-slate-900">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-8">
        <div className="bg-white rounded-3xl p-10 lg:p-16 border border-slate-200 shadow-lg flex flex-col lg:flex-row items-center justify-between gap-8">
          <div className="space-y-4 text-center lg:text-left max-w-2xl">
            <span className="text-xs font-bold text-emerald-800 uppercase tracking-widest bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
              Pronto para Transformar sua Operação?
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 leading-tight">
              Sua operação pode ser mais simples e rentável.
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Gestão financeira + IA Nativas + Automação de Tarefas + Integração Conta Azul em um único ambiente enterprise.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3.5 shrink-0 w-full sm:w-auto">
            <Link
              href="#planos"
              className="px-8 py-4 bg-primary hover:opacity-90 text-white text-xs font-bold rounded-xl transition-all shadow-md text-center flex items-center justify-center gap-2"
            >
              <span>Começar agora</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <Link
              href="/login"
              className="px-8 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-all text-center"
            >
              Acessar plataforma
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────
   Rodapé Corporativo Completo
───────────────────────────────────────── */
function Footer() {
  const productLinks = [
    { label: "Visão Geral", href: "#produto" },
    { label: "Módulos", href: "#modulos" },
    { label: "Inteligência Artificial", href: "#ia" },
    { label: "Integração Conta Azul", href: "#contaazul" },
    { label: "Franquia OmniCoins", href: "#omnicoins" },
    { label: "Planos & Preços", href: "#planos" }
  ];

  const legalLinks = [
    { label: "Termos de Uso", href: "/legal/termos-de-uso" },
    { label: "Política de Privacidade", href: "/legal/politica-de-privacidade" },
    { label: "Conformidade LGPD", href: "/legal/conformidade-lgpd" },
    { label: "Segurança & Criptografia", href: "/legal/seguranca-criptografia" }
  ];

  return (
    <footer className="bg-white border-t border-slate-200/80 text-slate-600 text-xs">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          <div className="space-y-4 md:col-span-2">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xs">Z</span>
              </div>
              <span className="text-base font-bold text-slate-900 tracking-tight">OmniZeus</span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed max-w-md">
              Plataforma SaaS B2B All-in-One para Escritórios Contábeis e Prestadores de BPO Financeiro no Brasil. Centralize tarefas, tributos, ERP Conta Azul e Inteligência Artificial contextualizada.
            </p>
            <div className="pt-2 flex items-center gap-4 text-[11px] text-slate-400 font-semibold">
              <span>© 2026 OmniZeus. Todos os direitos reservados.</span>
            </div>
          </div>

          <div className="space-y-3">
            <strong className="text-slate-900 uppercase font-bold text-[10px] tracking-wider block">Navegação</strong>
            <ul className="space-y-2">
              {productLinks.map((l) => (
                <li key={l.label}>
                  <a href={l.href} className="hover:text-primary transition-colors">{l.label}</a>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-3">
            <strong className="text-slate-900 uppercase font-bold text-[10px] tracking-wider block">Segurança & Legal</strong>
            <ul className="space-y-2">
              {legalLinks.map((l) => (
                <li key={l.label}>
                  <a href={l.href} className="hover:text-primary transition-colors">{l.label}</a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ─────────────────────────────────────────
   Modal de Contratação & Pedido de Compra (Checkout)
───────────────────────────────────────── */
function ContractModal({
  selectedPlan,
  onClose
}: {
  selectedPlan: "test_1_real" | "profissional" | "premium" | "business" | null;
  onClose: () => void;
}) {
  const [plan, setPlan] = useState<"test_1_real" | "profissional" | "premium" | "business">(selectedPlan || "premium");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [segmento, setSegmento] = useState("Escritório de Contabilidade");
  const [observacoes, setObservacoes] = useState("");
  const [incluirContaAzul, setIncluirContaAzul] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (selectedPlan) setPlan(selectedPlan);
  }, [selectedPlan]);

  if (!selectedPlan) return null;

  const planDetailsMap: Record<string, { name: string; price: number; coins: number }> = {
    test_1_real: { name: "Plano Teste (Temporário)", price: 1, coins: 100 },
    profissional: { name: "Plano Profissional", price: 490, coins: 5000 },
    premium: { name: "Plano Premium", price: 890, coins: 15000 },
    business: { name: "Plano Business", price: 1990, coins: 50000 }
  };

  const planDetails = planDetailsMap[plan] || planDetailsMap.premium;
  const contaAzulFee = incluirContaAzul ? 39.90 : 0;
  const total = planDetails.price + contaAzulFee;

  const formatCnpj = (val: string) => {
    const nums = val.replace(/\D/g, "").slice(0, 14);
    if (nums.length <= 2) return nums;
    if (nums.length <= 5) return `${nums.slice(0, 2)}.${nums.slice(2)}`;
    if (nums.length <= 8) return `${nums.slice(0, 2)}.${nums.slice(2, 5)}.${nums.slice(5)}`;
    if (nums.length <= 12) return `${nums.slice(0, 2)}.${nums.slice(2, 5)}.${nums.slice(5, 8)}/${nums.slice(8)}`;
    return `${nums.slice(0, 2)}.${nums.slice(2, 5)}.${nums.slice(5, 8)}/${nums.slice(8, 12)}-${nums.slice(12)}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !email.trim() || !empresa.trim() || !cnpj.trim()) {
      setErrorMsg("Preencha todos os campos obrigatórios (*).");
      return;
    }
    setErrorMsg("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/checkout/create-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          responsavel_nome: nome,
          responsavel_email: email,
          responsavel_telefone: telefone,
          empresa_nome: empresa,
          empresa_cnpj: cnpj,
          empresa_segmento: segmento,
          empresa_observacoes: observacoes,
          plan_id: plan,
          incluir_conta_azul: incluirContaAzul
        })
      });

      const data = await res.json();
      if (res.ok && data.checkout_url) {
        window.location.href = data.checkout_url;
      } else {
        setErrorMsg(data.error || "Erro ao conectar ao checkout Stripe.");
        setSubmitting(false);
      }
    } catch (err) {
      console.error("Error creating checkout session:", err);
      setErrorMsg("Falha na conexão com os serviços de pagamento.");
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-xl shadow-xl max-w-xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-slate-900">
        {/* Minimal Header */}
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Checkout SaaS</span>
            <h3 className="text-base font-bold text-slate-900">Contratação OmniZeus</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 text-xs overflow-y-auto">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 font-medium rounded-lg text-xs">
              {errorMsg}
            </div>
          )}

          {/* 1. Plano Escolhido */}
          <div className="space-y-2">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              1. Plano Escolhido
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: "test_1_real", label: "Teste R$ 1,00", price: "R$ 1,00" },
                { id: "profissional", label: "Profissional", price: "R$ 490/m" },
                { id: "premium", label: "Premium", price: "R$ 890/m" },
                { id: "business", label: "Business", price: "R$ 1.990/m" }
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPlan(p.id as any)}
                  className={`p-2.5 rounded-lg border text-left transition-all ${
                    plan === p.id
                      ? "border-slate-900 bg-slate-900 text-white font-bold"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span className="text-[11px] block truncate">{p.label}</span>
                  <span className={`text-[10px] block font-mono ${plan === p.id ? "text-emerald-400" : "text-slate-500"}`}>{p.price}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 2. Valor */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
            <div>
              <span className="text-slate-500 block text-[11px]">Investimento Inicial Total:</span>
              <strong className="text-slate-900 font-bold">{planDetails.name}</strong>
            </div>
            <div className="text-right">
              <span className="text-lg font-bold text-slate-900 block">
                R$ {total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </span>
              <span className="text-[10px] text-slate-400 block font-mono">Processamento Seguro via Stripe</span>
            </div>
          </div>

          {/* 3. Resumo da Contratação & Dados Cadastrais */}
          <div className="space-y-3 pt-1">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block border-b border-slate-100 pb-1">
              2. Resumo da Contratação (Dados da Empresa & Responsável)
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-slate-600 block mb-1">Nome do Responsável *</label>
                <input
                  type="text"
                  required
                  placeholder="Nome completo"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs focus:border-slate-900 outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-600 block mb-1">E-mail Corporativo *</label>
                <input
                  type="email"
                  required
                  placeholder="gestor@empresa.com.br"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs focus:border-slate-900 outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-600 block mb-1">Razão Social / Nome Fantasia *</label>
                <input
                  type="text"
                  required
                  placeholder="Nome da empresa"
                  value={empresa}
                  onChange={(e) => setEmpresa(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs focus:border-slate-900 outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-600 block mb-1">CNPJ *</label>
                <input
                  type="text"
                  required
                  placeholder="00.000.000/0001-00"
                  value={cnpj}
                  onChange={(e) => setCnpj(formatCnpj(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono focus:border-slate-900 outline-none"
                />
              </div>
            </div>
          </div>

          {/* 4. Configurações Adicionais */}
          <div className="pt-1">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-2">
              3. Configurações Adicionais
            </span>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center gap-2.5">
              <input
                type="checkbox"
                id="chkContaAzul"
                checked={incluirContaAzul}
                onChange={(e) => setIncluirContaAzul(e.target.checked)}
                className="w-4 h-4 text-slate-900 rounded border-slate-300 focus:ring-slate-900 cursor-pointer"
              />
              <label htmlFor="chkContaAzul" className="text-[11px] text-slate-700 cursor-pointer select-none">
                Incluir Setup & Integração Guiada Conta Azul <span className="font-semibold text-slate-900">(+ R$ 39,90 taxa única)</span>
              </label>
            </div>
          </div>

          {/* 5. Pagamento (Botões) */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-lg text-xs font-medium text-slate-600 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs rounded-lg transition-all flex items-center gap-1.5 disabled:opacity-50 shadow-xs"
            >
              {submitting ? (
                <span>Redirecionando...</span>
              ) : (
                <>
                  <span>Ir para o Stripe Checkout</span>
                  <ArrowRight size={14} strokeWidth={1.5} />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   Root Component — Landing Page
───────────────────────────────────────── */
export default function LandingPage() {
  const [selectedPlan, setSelectedPlan] = useState<"test_1_real" | "profissional" | "premium" | "business" | null>(null);

  return (
    <div className="antialiased bg-white text-slate-900 min-h-screen overflow-x-hidden" style={{ fontFamily: "'Inter', sans-serif" }}>
      <Navbar />
      <main>
        <Hero />
        <TrustBar />
        <FeaturesModules />
        <HowItWorks />
        <AIDifferential />
        <ContaAzulSection />
        <OmniCoinsSection />
        <HorizontalFaqSection />
        <PricingSection onSelectPlan={setSelectedPlan} />
        <TransformationSection />
        <WhyChooseSection />
        <HowItWorksSection />
        <FAQSection />
        <FinalCTA />
      </main>
      <Footer />
      <ContractModal selectedPlan={selectedPlan} onClose={() => setSelectedPlan(null)} />
    </div>
  );
}

