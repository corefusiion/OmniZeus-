"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import {
  ArrowRight,
  BarChart2,
  FileText,
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
  ArrowUpRight,
  Server,
} from "lucide-react";

/* ─────────────────────────────────────────
   Inline App Preview
───────────────────────────────────────── */
function AppPreview() {
  const kpis = [
    { label: "Receita do Mês", value: "R$ 48.200", sub: "↑ 12% vs anterior" },
    { label: "Clientes Ativos", value: "147", sub: "+3 neste mês" },
    { label: "Tarefas Abertas", value: "23", sub: "4 com urgência" },
    { label: "OmniCoins", value: "12.400", sub: "48% utilizados" },
  ];
  const activities = [
    { text: "DAS MEI — vencimento em 3 dias", badge: "Urgente", cls: "text-red-600 bg-red-50" },
    { text: "Proposta enviada — Farmácia Silva Ltda", badge: "Enviado", cls: "text-primary bg-primary/10" },
    { text: "IA resolveu 4 consultas fiscais", badge: "Concluído", cls: "text-emerald-700 bg-emerald-50" },
    { text: "Folha Jun/2026 — aprovada pelo gestor", badge: "Aprovado", cls: "text-emerald-700 bg-emerald-50" },
  ];
  const navItems = ["Dashboard", "Financeiro", "Omni IA", "WhatsApp", "Tarefas", "Documentos"];
  const data = [28, 33, 37, 44, 41, 50, 56, 60, 64];
  const W = 320; const H = 52;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - (v / 80) * H;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const area = `${pts} ${W},${H} 0,${H}`;

  return (
    <div
      className="w-full rounded-xl overflow-hidden bg-white border border-gray-200"
      style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.05), 0 24px 64px rgba(0,0,0,0.08)" }}
    >
      {/* Chrome */}
      <div className="h-7 bg-gray-50 border-b border-gray-200 flex items-center px-3 gap-1.5">
        <div className="w-2.5 h-2.5 rounded-full bg-gray-200" />
        <div className="w-2.5 h-2.5 rounded-full bg-gray-200" />
        <div className="w-2.5 h-2.5 rounded-full bg-gray-200" />
        <div className="flex-1 flex justify-center">
          <div className="bg-white rounded border border-gray-200 px-3 py-px text-center w-44" style={{ fontSize: 9, color: "#9CA3AF" }}>
            app.omnizeus.com.br
          </div>
        </div>
      </div>
      {/* Layout */}
      <div className="flex" style={{ height: 390 }}>
        {/* Sidebar */}
        <div className="w-36 border-r border-gray-100 bg-white flex flex-col py-3 flex-shrink-0">
          <div className="px-3 mb-4 flex items-center gap-1.5">
            <div className="w-4 h-4 bg-primary rounded-[3px] flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold" style={{ fontSize: 7 }}>Z</span>
            </div>
            <span className="font-semibold text-gray-900" style={{ fontSize: 10 }}>OmniZeus</span>
          </div>
          {navItems.map((item, i) => (
            <div key={item} className={`mx-2 px-2 py-1.5 rounded-md mb-0.5 flex items-center gap-2 ${i === 0 ? "bg-gray-100 text-gray-900 font-medium" : "text-gray-400"}`} style={{ fontSize: 10 }}>
              <div className={`w-1 h-1 rounded-full flex-shrink-0 ${i === 0 ? "bg-primary" : "bg-gray-300"}`} />
              {item}
            </div>
          ))}
          <div className="mt-auto px-3">
            <div className="text-gray-400 font-medium" style={{ fontSize: 9 }}>Zenitus Contábil</div>
            <div className="text-gray-300 mt-0.5" style={{ fontSize: 8 }}>Plano Premium</div>
          </div>
        </div>
        {/* Main */}
        <div className="flex-1 min-w-0" style={{ background: "#FAFAF9" }}>
          <div className="h-9 bg-white border-b border-gray-100 flex items-center justify-between px-4">
            <div className="flex items-baseline gap-2">
              <span className="font-semibold text-gray-900" style={{ fontSize: 11 }}>Dashboard Executivo</span>
              <span className="text-gray-400" style={{ fontSize: 9 }}>· Julho 2026</span>
            </div>
            <div className="flex items-center gap-2">
              <Bell strokeWidth={1.5} className="text-gray-400" style={{ width: 12, height: 12 }} />
              <div className="w-5 h-5 rounded-full bg-primary text-white font-bold flex items-center justify-center" style={{ fontSize: 8 }}>J</div>
            </div>
          </div>
          <div className="p-3.5">
            <div className="grid grid-cols-4 gap-2 mb-3">
              {kpis.map((k) => (
                <div key={k.label} className="bg-white rounded-lg border border-gray-100 px-2.5 py-2">
                  <p className="text-gray-400 uppercase tracking-wide mb-1" style={{ fontSize: 7 }}>{k.label}</p>
                  <p className="font-semibold text-gray-900" style={{ fontSize: 11 }}>{k.value}</p>
                  <p className="text-gray-400 mt-0.5" style={{ fontSize: 8 }}>{k.sub}</p>
                </div>
              ))}
            </div>
            <div className="bg-white rounded-lg border border-gray-100 px-3 pt-2.5 pb-2 mb-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-medium text-gray-700">Receita Mensal</p>
                <p className="text-gray-400" style={{ fontSize: 8 }}>Jan – Set 2026</p>
              </div>
              <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
                <polygon points={area} fill="rgba(47,111,237,0.05)" />
                <polyline points={pts} fill="none" stroke="#2F6FED" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div className="flex justify-between mt-1">
                {["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set"].map((m) => (
                  <span key={m} className="text-gray-300" style={{ fontSize: 7 }}>{m}</span>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-100 px-3 py-2.5">
              <p className="text-[10px] font-medium text-gray-700 mb-2">Atividade Recente</p>
              <div className="space-y-1.5">
                {activities.map((a) => (
                  <div key={a.text} className="flex items-center justify-between gap-2">
                    <span className="text-gray-500 truncate" style={{ fontSize: 9 }}>{a.text}</span>
                    <span className={`px-1.5 py-0.5 rounded flex-shrink-0 font-medium ${a.cls}`} style={{ fontSize: 7 }}>{a.badge}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   Navbar
───────────────────────────────────────── */
const NAV_LINKS = [
  { label: "Funcionalidades", href: "#funcionalidades" },
  { label: "Módulos", href: "#modulos" },
  { label: "Planos", href: "#planos" },
  { label: "Sobre", href: "#sobre" },
];

function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white transition-all duration-200"
      style={{ borderBottom: scrolled ? "1px solid #EBEBEB" : "1px solid transparent" }}>
      <div className="max-w-[1400px] mx-auto px-8 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-6 h-6 bg-primary rounded-md flex items-center justify-center group-hover:opacity-90 transition-colors">
            <span className="text-white font-bold" style={{ fontSize: 10 }}>Z</span>
          </div>
          <span className="text-sm font-semibold text-gray-900 tracking-tight">OmniZeus</span>
        </Link>
        <nav className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map((l) => (
            <a key={l.label} href={l.href} className="text-sm text-gray-500 hover:text-gray-900 transition-colors">{l.label}</a>
          ))}
        </nav>
        <div className="hidden md:flex items-center gap-3">
          <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900 transition-colors px-3 py-1.5">Entrar</Link>
          <Link href="/login" className="text-sm font-medium bg-primary text-white px-5 py-2 rounded-lg hover:opacity-90 transition-colors inline-flex items-center gap-1.5">
            Acessar plataforma <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <button className="md:hidden p-1.5 text-gray-600" onClick={() => setOpen(!open)}>
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>
      {open && (
        <div className="md:hidden border-t border-gray-100 bg-white px-8 py-5 flex flex-col gap-4">
          {NAV_LINKS.map((l) => (
            <a key={l.label} href={l.href} className="text-sm text-gray-600" onClick={() => setOpen(false)}>{l.label}</a>
          ))}
          <div className="flex flex-col gap-2 pt-3 border-t border-gray-100">
            <Link href="/login" className="text-sm text-center text-gray-700 py-2.5 border border-gray-200 rounded-lg">Entrar</Link>
            <Link href="/login" className="text-sm text-center font-medium bg-primary text-white py-2.5 rounded-lg">Acessar plataforma</Link>
          </div>
        </div>
      )}
    </header>
  );
}

/* ─────────────────────────────────────────
   Hero
───────────────────────────────────────── */
function Hero() {
  return (
    <section className="pt-28 pb-20 bg-white">
      <div className="max-w-[1400px] mx-auto px-8">
        <div className="grid lg:grid-cols-[1fr_1.1fr] gap-20 items-center">
          <div>
            <p className="text-[11px] font-medium text-gray-400 uppercase tracking-[0.18em] mb-7">
              Plataforma para Escritórios Contábeis e BPO Financeiro
            </p>
            <h1 className="text-[56px] lg:text-[64px] font-bold text-gray-900 leading-[1.05] tracking-tight mb-7">
              Gestão contábil<br />inteligente.
            </h1>
            <p className="text-[17px] text-gray-500 leading-relaxed mb-10 max-w-[460px]">
              Centralize operações, automatize processos fiscais e escale seu escritório com inteligência artificial integrada.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/login" className="inline-flex items-center gap-2 bg-primary text-white text-sm font-medium px-7 py-3.5 rounded-lg hover:opacity-90 transition-colors">
                Acessar plataforma <ArrowRight className="w-4 h-4" />
              </Link>
              <a href="#planos" className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 px-7 py-3.5 rounded-lg border border-gray-200 hover:border-gray-300 hover:text-gray-900 transition-colors">
                Ver planos e preços
              </a>
            </div>
            <div className="mt-10 flex items-center gap-6 text-xs text-gray-400">
              <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5" strokeWidth={1.5} /> Setup em 5 minutos</span>
              <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5" strokeWidth={1.5} /> Sem taxa de configuração</span>
              <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5" strokeWidth={1.5} /> Suporte em português</span>
            </div>
          </div>
          <div>
            <AppPreview />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────
   Trust Bar
───────────────────────────────────────── */
function TrustBar() {
  const names = ["Almeida & Associados", "Grupo Fischer Contábil", "Silva BPO Financeiro", "Costa & Martins", "Próspera Contabilidade", "Lopes Assessoria", "Monteiro & Filhos"];
  return (
    <section className="py-10 border-y border-gray-100" style={{ background: "#FAFAF8" }}>
      <div className="max-w-[1400px] mx-auto px-8">
        <p className="text-[10px] text-gray-400 text-center uppercase tracking-[0.18em] mb-7">
          Utilizado por escritórios contábeis em todo o Brasil
        </p>
        <div className="flex flex-wrap justify-center items-center gap-10 lg:gap-16">
          {names.map((n) => (
            <span key={n} className="text-[13px] font-medium text-gray-300 whitespace-nowrap tracking-tight">{n}</span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────
   Benefits
───────────────────────────────────────── */
function Benefits() {
  const items = [
    { icon: Zap, title: "Automatize o operacional.", desc: "Fluxos para DAS, DARF, cobranças e folha. Menos tempo manual, mais controle sobre cada processo." },
    { icon: Users, title: "Equipe alinhada.", desc: "Hierarquia entre Sócios, Gestores e Colaboradores. Cada usuário vê apenas o que é relevante." },
    { icon: Shield, title: "Dados protegidos.", desc: "Isolamento por escritório, controle de acesso granular e histórico auditável de todas as operações." },
    { icon: Globe, title: "Acesso de qualquer lugar.", desc: "Plataforma web completa. Sem instalação. Disponível em qualquer dispositivo com navegador." },
  ];
  return (
    <section className="py-24 bg-white" id="funcionalidades">
      <div className="max-w-[1400px] mx-auto px-8">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-12">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title}>
                <Icon className="text-gray-400 mb-5" style={{ width: 18, height: 18, strokeWidth: 1.5 }} />
                <h3 className="text-[15px] font-semibold text-gray-900 mb-2.5 tracking-tight">{item.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────
   Features Grid
───────────────────────────────────────── */
function Features() {
  const features = [
    { icon: Bot, tag: "Inteligência Artificial", title: "Omni IA Hub", desc: "15 modelos de ponta em tempo real. GPT-5.5, o4-mini, Claude 4.8 Sonnet, Gemini 3.6 Pro, DeepSeek V4 e Kimi Moonshot." },
    { icon: DollarSign, tag: "Financeiro", title: "Gestão Financeira", desc: "Contas a pagar, DAS, DARF e folha centralizados. Gráficos de evolução mensal com exportação direta em PDF." },
    { icon: MessageSquare, tag: "Comunicação", title: "WhatsApp Bot", desc: "Atendimento automatizado com IA por setor. Kanban de conversas, fluxos configuráveis e transferência entre departamentos." },
    { icon: CheckSquare, tag: "Operacional", title: "Gestão de Tarefas", desc: "SOPs com cronômetro integrado. Visão separada para gestor e colaborador, com resolução assistida por IA." },
    { icon: FileText, tag: "Documentos", title: "Gerador de Documentos", desc: "Contratos, propostas e notificações fiscais em formato A4. Exportação em PDF com um clique." },
    { icon: BarChart2, tag: "Aprovações", title: "Central de Aprovações", desc: "Workflow completo de solicitações BPO. Aprovações pelo gestor com notificação por nível de acesso." },
  ];
  return (
    <section className="py-24 border-y border-gray-100" style={{ background: "#FAFAF8" }} id="modulos">
      <div className="max-w-[1400px] mx-auto px-8">
        <div className="mb-16">
          <p className="text-[11px] font-medium text-gray-400 uppercase tracking-[0.18em] mb-5">Módulos</p>
          <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 tracking-tight leading-tight">
            Seis módulos integrados.<br />Uma plataforma.
          </h2>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3" style={{ border: "1px solid #EBEBEB" }}>
          {features.map((f, i) => {
            const Icon = f.icon;
            const isLastRow = i >= 3;
            const isLastInRow3 = (i + 1) % 3 === 0;
            return (
              <div
                key={f.title}
                className="bg-white p-9 hover:bg-[#FAFAF8] transition-colors"
                style={{
                  borderRight: isLastInRow3 ? "none" : "1px solid #EBEBEB",
                  borderBottom: isLastRow ? "none" : "1px solid #EBEBEB",
                }}
              >
                <p className="text-gray-400 uppercase tracking-[0.12em] mb-5 font-medium" style={{ fontSize: 10 }}>{f.tag}</p>
                <div className="flex items-center gap-2.5 mb-3">
                  <Icon className="text-gray-400 flex-shrink-0" style={{ width: 15, height: 15, strokeWidth: 1.5 }} />
                  <h3 className="text-sm font-semibold text-gray-900">{f.title}</h3>
                </div>
                <p className="text-sm text-gray-500 leading-relaxed pl-[23px]">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────
   Stats
───────────────────────────────────────── */
function Stats() {
  const items = [
    { number: "15+", label: "Modelos de IA integrados" },
    { number: "6", label: "Módulos operacionais" },
    { number: "< 5 min", label: "Para configurar e usar" },
    { number: "98.6%", label: "Margem sobre custos de API" },
  ];
  return (
    <section className="py-28 bg-white">
      <div className="max-w-[1400px] mx-auto px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-16">
          {items.map((s) => (
            <div key={s.label}>
              <div className="text-[44px] font-bold text-gray-900 tracking-tight mb-2 leading-none">{s.number}</div>
              <div className="text-sm text-gray-400 mt-2">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────
   Testimonials
───────────────────────────────────────── */
function Testimonials() {
  const items = [
    { quote: "Reduzimos em 60% o tempo gasto em tarefas repetitivas. O WhatsApp Bot sozinho já justificou o investimento.", name: "Rodrigo Almeida", role: "Sócio-Diretor", company: "Almeida & Associados" },
    { quote: "A integração entre IA e gestão financeira é precisa. Conseguimos escalar sem aumentar o time operacional.", name: "Patricia Fischer", role: "Gestora de BPO", company: "Grupo Fischer Contábil" },
    { quote: "Interface limpa, dados confiáveis, suporte ágil. É exatamente o que um escritório moderno precisa.", name: "Carlos Mendes", role: "Contador Responsável", company: "Próspera Contabilidade" },
  ];
  return (
    <section className="py-24 border-y border-gray-100" style={{ background: "#FAFAF8" }}>
      <div className="max-w-[1400px] mx-auto px-8">
        <div className="mb-16">
          <p className="text-[11px] font-medium text-gray-400 uppercase tracking-[0.18em] mb-5">Depoimentos</p>
          <h2 className="text-3xl font-bold text-gray-900 tracking-tight">O que nossos clientes dizem.</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {items.map((t) => (
            <div key={t.name} className="bg-white border border-gray-100 rounded-xl p-8 flex flex-col">
              <p className="text-[15px] text-gray-600 leading-relaxed flex-1 mb-8">&ldquo;{t.quote}&rdquo;</p>
              <div className="border-t border-gray-100 pt-5">
                <p className="text-sm font-semibold text-gray-900">{t.name}</p>
                <p className="text-xs text-gray-400 mt-1">{t.role} · {t.company}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────
   Sobre (About Section with Architecture Infographic)
───────────────────────────────────────── */
function AboutSection() {
  const nodes = [
    { title: "Camada de Interface & WhatsApp Bot", desc: "OmniIA, Kanban multi-setor e notificações automatizadas de obrigações tributárias.", tag: "Front-end & Bot Engine", icon: MessageSquare },
    { title: "Orquestrador de IA & OpenRouter Proxy", desc: "15 LLMs (GPT-5.5, o4-mini, Claude 4.8, Gemini 3.6, DeepSeek V4) com suporte a streaming em tempo real.", tag: "AI Gateway 2026", icon: Cpu },
    { title: "Motor de Operação Contábil & DRE", desc: "Gestão de pagáveis, contratos BPO, solicitações e integração bidirecional ContaAzul v2.", tag: "BPO Core", icon: Layers },
    { title: "Banco de Dados SQL & Supabase Ready", desc: "Persistência em esquema relacional, isolamento multi-tenant seguro e auditoria completa.", tag: "Data Persistence", icon: Database },
  ];

  return (
    <section className="py-24 bg-white border-t border-gray-100" id="sobre">
      <div className="max-w-[1400px] mx-auto px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left Text */}
          <div>
            <p className="text-[11px] font-medium text-gray-400 uppercase tracking-[0.18em] mb-5">Sobre o OmniZeus</p>
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 tracking-tight leading-tight mb-6">
              A infraestrutura definitiva para escritórios contábeis de alto desempenho.
            </h2>
            <p className="text-gray-600 text-base leading-relaxed mb-6">
              Desenvolvido para eliminar retrabalho e sistemas fragmentados, o OmniZeus unifica inteligência artificial generativa, atendimento via WhatsApp Bot, gestão de tarefas com cronômetro integrado, contratos de honorários e DRE gerencial em um único ecossistema enterprise.
            </p>
            <p className="text-gray-500 text-sm leading-relaxed mb-8">
              Nossa missão é permitir que escritórios contábeis e prestadores de BPO Financeiro no Brasil aumentem sua margem operacional e escalem sua carteira de clientes mantendo rígidos padrões de compliance e segurança.
            </p>

            <div className="grid sm:grid-cols-3 gap-6 pt-6 border-t border-gray-100">
              <div>
                <h4 className="text-xs font-semibold text-gray-900 uppercase tracking-wider mb-1">Multi-Tenant</h4>
                <p className="text-xs text-gray-400">Isolamento de dados e perfis Granulares.</p>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-gray-900 uppercase tracking-wider mb-1">SQL Relacional</h4>
                <p className="text-xs text-gray-400">Estrutura pronta para Supabase PostgreSQL.</p>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-gray-900 uppercase tracking-wider mb-1">Suporte BPO</h4>
                <p className="text-xs text-gray-400">Time especialista em tributos e processos.</p>
              </div>
            </div>
          </div>

          {/* Right Minimalist Infographic Component */}
          <div>
            <div className="bg-[#FAFAF8] border border-gray-200 rounded-xl p-7 space-y-4">
              <div className="flex items-center justify-between border-b border-gray-200/80 pb-4">
                <div>
                  <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Arquitetura de Sistemas OmniZeus</h3>
                  <p className="text-[11px] text-gray-400 mt-0.5">Infográfico de fluxo operacional e integração de IA</p>
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-gray-200 text-gray-700">Enterprise v2.5</span>
              </div>

              {/* Stack Nodes Diagram */}
              <div className="space-y-3 pt-1">
                {nodes.map((node, i) => {
                  const Icon = node.icon;
                  return (
                    <div key={node.title} className="bg-white border border-gray-200 rounded-lg p-4 transition-all hover:border-gray-300">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <Icon className="text-gray-500" style={{ width: 14, height: 14, strokeWidth: 1.5 }} />
                          <h4 className="text-xs font-bold text-gray-900">{node.title}</h4>
                        </div>
                        <span className="text-[9px] font-mono text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">{node.tag}</span>
                      </div>
                      <p className="text-[11px] text-gray-500 leading-normal pl-5">{node.desc}</p>
                    </div>
                  );
                })}
              </div>

              <div className="pt-2 flex items-center justify-between text-[11px] text-gray-400">
                <span>99.9% Uptime Garantido</span>
                <span>Latência Média: &lt; 200ms</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────
   Pricing
───────────────────────────────────────── */
function Pricing() {
  const [yearly, setYearly] = useState(false);
  const plans = [
    {
      name: "Profissional", price: 490, yearlyPrice: 392, coins: "5.000", highlight: false,
      desc: "Para escritórios que estão estruturando sua operação digital.",
      features: [
        "Omni IA Hub — 15 modelos", 
        "Gestão Financeira & BPO", 
        "WhatsApp Bot (1 instância)", 
        "Gestão de Tarefas Operacionais", 
        "Gerador de Documentos PDF", 
        "Suporte por e-mail"
      ],
      cta: "Começar com Profissional",
    },
    {
      name: "Premium", price: 890, yearlyPrice: 712, coins: "15.000", highlight: true,
      desc: "Para escritórios em crescimento que precisam de mais capacidade.",
      features: [
        "Tudo do Profissional", 
        "WhatsApp Bot (3 instâncias)", 
        "Agentes de IA treinados",
        "Central de Aprovações BPO", 
        "Apresentações Executivas", 
        "Relatórios avançados em PDF", 
        "Suporte prioritário"
      ],
      cta: "Começar com Premium",
    },
    {
      name: "Business", price: 1990, yearlyPrice: 1592, coins: "50.000", highlight: false,
      desc: "Para operações de grande porte com múltiplos gestores.",
      features: [
        "Tudo do Premium", 
        "Instâncias ilimitadas", 
        "APIs dedicadas", 
        "Multi-tenant avançado", 
        "SLA de disponibilidade", 
        "Suporte dedicado 24/7"
      ],
      cta: "Começar com Business",
    },
  ];
  const fmt = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(n);

  return (
    <section className="py-24 bg-white border-t border-gray-100" id="planos">
      <div className="max-w-[1400px] mx-auto px-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-14 gap-6">
          <div>
            <p className="text-[11px] font-medium text-gray-400 uppercase tracking-[0.18em] mb-5">Planos</p>
            <h2 className="text-3xl font-bold text-gray-900 tracking-tight">Preços transparentes.</h2>
          </div>
          <div className="flex items-center p-1 border border-gray-200 rounded-lg gap-1">
            <button onClick={() => setYearly(false)} className={`text-xs px-4 py-2 rounded-md font-medium transition-colors ${!yearly ? "bg-primary text-white" : "text-gray-500 hover:text-gray-900"}`}>Mensal</button>
            <button onClick={() => setYearly(true)} className={`text-xs px-4 py-2 rounded-md font-medium transition-colors inline-flex items-center gap-2 ${yearly ? "bg-primary text-white" : "text-gray-500 hover:text-gray-900"}`}>
              Anual
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${yearly ? "bg-white/20 text-white" : "bg-primary/10 text-primary"}`}>−20%</span>
            </button>
          </div>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {plans.map((plan) => (
            <div key={plan.name} className="rounded-xl flex flex-col p-9 transition-all"
              style={{ background: plan.highlight ? "#181818" : "#FFFFFF", border: plan.highlight ? "none" : "1px solid #E8E8E8" }}>
              <p className={`text-[10px] font-medium uppercase tracking-[0.18em] mb-6 ${plan.highlight ? "text-gray-500" : "text-gray-400"}`}>{plan.name}</p>
              <div className="mb-2">
                <div className="flex items-baseline gap-1">
                  <span className={`text-[42px] font-bold tracking-tight leading-none ${plan.highlight ? "text-white" : "text-gray-900"}`}>{fmt(yearly ? plan.yearlyPrice : plan.price)}</span>
                  <span className={`text-sm ml-1 ${plan.highlight ? "text-gray-500" : "text-gray-400"}`}>/mês</span>
                </div>
                <p className={`text-xs mt-2 ${plan.highlight ? "text-gray-600" : "text-gray-400"}`}>{plan.coins} OmniCoins inclusos</p>
              </div>
              <p className={`text-sm leading-relaxed mt-5 mb-8 ${plan.highlight ? "text-gray-400" : "text-gray-500"}`}>{plan.desc}</p>
              <div className={`flex-1 pt-7 mb-8 border-t ${plan.highlight ? "border-gray-800" : "border-gray-100"}`}>
                <ul className="space-y-3.5">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-3">
                      <Check className={`flex-shrink-0 mt-0.5 ${plan.highlight ? "text-gray-600" : "text-gray-400"}`} style={{ width: 14, height: 14, strokeWidth: 1.5 }} />
                      <span className={`text-sm ${plan.highlight ? "text-gray-300" : "text-gray-600"}`}>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <Link href="/login" className={`text-center text-sm font-medium py-3.5 rounded-lg transition-colors ${plan.highlight ? "bg-white text-gray-900 hover:bg-gray-100" : "border border-gray-200 text-gray-700 hover:border-gray-300 hover:text-gray-900"}`}>
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-wrap justify-center gap-8">
          {["Sem taxa de configuração", "Cancele a qualquer momento", "Dados criptografados", "Suporte em português"].map((t) => (
            <span key={t} className="flex items-center gap-1.5 text-xs text-gray-400">
              <Check className="text-gray-400" style={{ width: 12, height: 12, strokeWidth: 1.5 }} /> {t}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────
   Final CTA
───────────────────────────────────────── */
function FinalCTA() {
  return (
    <section className="py-28" style={{ background: "#181818" }}>
      <div className="max-w-[1400px] mx-auto px-8">
        <div className="grid lg:grid-cols-[1fr_auto] items-center gap-12">
          <div>
            <p className="text-[11px] font-medium text-gray-500 uppercase tracking-[0.18em] mb-5">Pronto para começar?</p>
            <h2 className="text-3xl lg:text-4xl font-bold text-white tracking-tight leading-tight mb-4">
              Modernize seu escritório contábil.
            </h2>
            <p className="text-gray-400 text-base max-w-lg leading-relaxed">
              Configure em menos de 5 minutos e comece a automatizar operações hoje.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row lg:flex-col gap-3 flex-shrink-0">
            <Link href="/login" className="inline-flex items-center justify-center gap-2 bg-white text-gray-900 text-sm font-medium px-8 py-3.5 rounded-lg hover:bg-gray-100 transition-colors whitespace-nowrap">
              Acessar plataforma <ArrowRight className="w-4 h-4" />
            </Link>
            <a href="#planos" className="inline-flex items-center justify-center gap-2 text-sm font-medium text-gray-500 px-8 py-3.5 rounded-lg border border-gray-700 hover:border-gray-600 hover:text-gray-300 transition-colors whitespace-nowrap">
              Ver planos
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────
   Footer (completo)
───────────────────────────────────────── */
function Footer() {
  const product = [
    { label: "Funcionalidades", href: "#funcionalidades" },
    { label: "Módulos", href: "#modulos" },
    { label: "Planos e preços", href: "#planos" },
    { label: "Changelog", href: "#sobre" },
    { label: "Roadmap", href: "#sobre" },
    { label: "Status do sistema", href: "#sobre" },
  ];
  const resources = [
    { label: "Documentação", href: "/login" },
    { label: "API Reference", href: "/login" },
    { label: "Guia de início rápido", href: "/login" },
    { label: "Central de ajuda", href: "/login" },
    { label: "Comunidade", href: "/login" },
    { label: "Blog", href: "#sobre" },
  ];
  const company = [
    { label: "Sobre nós", href: "#sobre" },
    { label: "Missão", href: "#sobre" },
    { label: "Carreiras", href: "#sobre" },
    { label: "Imprensa", href: "#sobre" },
    { label: "Contato", href: "mailto:contato@omnizeus.com.br" },
    { label: "Parceiros", href: "#sobre" },
  ];
  const legal = [
    { label: "Privacidade", href: "#sobre" },
    { label: "Termos de uso", href: "#sobre" },
    { label: "Cookies", href: "#sobre" },
    { label: "LGPD", href: "#sobre" },
    { label: "Segurança", href: "#sobre" },
    { label: "Compliance", href: "#sobre" },
  ];

  return (
    <footer className="bg-white border-t border-gray-100">
      {/* Main footer */}
      <div className="max-w-[1400px] mx-auto px-8 py-16">
        <div className="grid grid-cols-2 lg:grid-cols-[300px_1fr_1fr_1fr_1fr] gap-10 lg:gap-8">
          {/* Brand */}
          <div className="col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-6 h-6 bg-primary rounded-md flex items-center justify-center">
                <span className="text-white font-bold" style={{ fontSize: 10 }}>Z</span>
              </div>
              <span className="text-sm font-semibold text-gray-900">OmniZeus</span>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed mb-6 max-w-[240px]">
              Plataforma SaaS All-in-One para Escritórios Contábeis e Prestadores de BPO Financeiro no Brasil.
            </p>
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <Building2 style={{ width: 13, height: 13, strokeWidth: 1.5 }} className="text-gray-300" />
                contato@omnizeus.com.br
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <Headphones style={{ width: 13, height: 13, strokeWidth: 1.5 }} className="text-gray-300" />
                Suporte: seg–sex, 9h–18h
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <Lock style={{ width: 13, height: 13, strokeWidth: 1.5 }} className="text-gray-300" />
                LGPD compliant · SSL/TLS
              </div>
            </div>
          </div>

          {/* Product */}
          <div>
            <p className="text-xs font-semibold text-gray-900 mb-5 uppercase tracking-wider">Produto</p>
            <ul className="space-y-3">
              {product.map((item) => (
                <li key={item.label}>
                  <a href={item.href} className="text-xs text-gray-400 hover:text-gray-700 transition-colors">
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources */}
          <div>
            <p className="text-xs font-semibold text-gray-900 mb-5 uppercase tracking-wider">Recursos</p>
            <ul className="space-y-3">
              {resources.map((item) => (
                <li key={item.label}>
                  <a href={item.href} className="text-xs text-gray-400 hover:text-gray-700 transition-colors">
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <p className="text-xs font-semibold text-gray-900 mb-5 uppercase tracking-wider">Empresa</p>
            <ul className="space-y-3">
              {company.map((item) => (
                <li key={item.label}>
                  <a href={item.href} className="text-xs text-gray-400 hover:text-gray-700 transition-colors">
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <p className="text-xs font-semibold text-gray-900 mb-5 uppercase tracking-wider">Legal</p>
            <ul className="space-y-3">
              {legal.map((item) => (
                <li key={item.label}>
                  <a href={item.href} className="text-xs text-gray-400 hover:text-gray-700 transition-colors">
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-gray-100">
        <div className="max-w-[1400px] mx-auto px-8 py-5 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-6">
            <p className="text-xs text-gray-400">© 2026 OmniZeus. Todos os direitos reservados.</p>
          </div>
          <div className="flex items-center gap-5">
            <Link href="/login" className="text-xs text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1.5">
              <BookOpen style={{ width: 12, height: 12 }} /> Documentação
            </Link>
            <Link href="/login" className="text-xs text-[#2F6FED] hover:text-primary transition-colors font-medium">
              Acessar plataforma →
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ─────────────────────────────────────────
   Root
───────────────────────────────────────── */
export default function LandingPage() {
  return (
    <div className="antialiased" style={{ fontFamily: "'Inter', sans-serif" }}>
      <Navbar />
      <main>
        <Hero />
        <TrustBar />
        <Benefits />
        <Features />
        <Stats />
        <AboutSection />
        <Testimonials />
        <Pricing />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
