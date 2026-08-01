"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import {
  LayoutDashboard, Sparkles, DollarSign, MessageSquare, CheckSquare,
  FileText, Presentation, Settings, Shield, ChevronLeft, ChevronRight, X,
  Link as LinkIcon, FileCheck, Briefcase, Bell, Bot, History,
  Activity, Users, Building2, ChevronDown,
  ShieldAlert, Cpu, BrainCircuit, Wallet,
  CreditCard, Globe, Server, GitBranch
} from "lucide-react";
import { UserRole, getCurrentUser, getAllowedModules } from "@/lib/auth/roles";
import { useTenant } from "@/lib/tenant/TenantContext";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  isFuture?: boolean;
  badge?: number;
  module?: string;
}

interface NavGroup {
  id: string;
  category: string;
  icon: React.ElementType;
  items: NavItem[];
}

// ─────────────────────────────────────────────────────────────
// MENUS DA EMPRESA (Tenant) — exclusivos do modo Empresa.
// Super ADM dentro de uma empresa vê exatamente isto (como o Gestor).
// ─────────────────────────────────────────────────────────────
const tenantNavGroups: NavGroup[] = [
  {
    id: "visao-geral",
    category: "Visão Geral",
    icon: LayoutDashboard,
    items: [
      { href: "/dashboard", label: "Dashboard Executivo", icon: Activity },
      { href: "#", label: "Central de Notificações", icon: Bell, isFuture: true, badge: 3 },
    ],
  },
  {
    id: "ia",
    category: "Inteligência Artificial",
    icon: Sparkles,
    items: [
      { href: "/omni-ia", label: "Omni IA Hub", icon: Sparkles, module: "omni-ia" },
      { href: "/omni-contaazul-ia", label: "Omni Conta Azul IA", icon: BrainCircuit, module: "contaazul" },
      { href: "/treinar-agente", label: "Meus Agentes IA", icon: Bot, module: "omni-ia" },
      { href: "/estatisticas-ia", label: "Consumo & Métricas IA", icon: Cpu, module: "omni-ia" },
    ],
  },
  {
    id: "financeiro",
    category: "Operação Financeira",
    icon: DollarSign,
    items: [
      { href: "/financeiro", label: "Contas a Pagar", icon: DollarSign, module: "financeiro" },
      { href: "/contratos", label: "Contratos de Honorários", icon: Briefcase, module: "financeiro" },
      { href: "/solicitacoes", label: "Solicitações & Compras", icon: FileCheck, module: "financeiro" },
      { href: "/contaazul", label: "Integração Conta Azul", icon: LinkIcon, module: "contaazul" },
    ],
  },

  {
    id: "operacao",
    category: "Operação",
    icon: CheckSquare,
    items: [
      { href: "/tarefas", label: "Tarefas Operacionais", icon: CheckSquare, module: "tarefas" },
      { href: "#", label: "WhatsApp Bot Chat", icon: MessageSquare, isFuture: true, module: "whatsapp-bot" },
    ],
  },
  {
    id: "documentos",
    category: "Documentos",
    icon: FileText,
    items: [
      { href: "/documentos", label: "Gerador de Documentos A4", icon: FileText, module: "documentos" },
      { href: "/apresentacoes", label: "Apresentações Executivas", icon: Presentation, module: "apresentacoes" },
    ],
  },
  {
    id: "admin",
    category: "Administração",
    icon: Settings,
    items: [
      { href: "/configuracoes", label: "Configurações da Empresa", icon: Settings },
      { href: "/usuarios", label: "Usuários & Equipe", icon: Users },
      { href: "#", label: "Matriz de Permissões", icon: Shield, isFuture: true },
    ],
  },
];

// ─────────────────────────────────────────────────────────────
// MENUS DA PLATAFORMA (SaaS) — exclusivos do Super ADM em modo
// Plataforma (fora de qualquer empresa). Nenhum menu operacional
// de empresa aparece aqui.
// ─────────────────────────────────────────────────────────────
const saasNavGroups: NavGroup[] = [
  {
    id: "saas-visao-geral",
    category: "Visão Geral SaaS",
    icon: Globe,
    items: [
      { href: "/dashboard-master", label: "Dashboard Master SaaS", icon: LayoutDashboard },
    ],
  },
  {
    id: "saas-empresas",
    category: "Empresas & Comercial",
    icon: Building2,
    items: [
      { href: "/empresas", label: "Centro de Comando Multi-Finance", icon: Building2 },
      { href: "/super-adm", label: "Pedidos de Compra", icon: FileText },
      { href: "#", label: "Planos & Preços", icon: Wallet, isFuture: true },
      { href: "#", label: "Provisionamento", icon: GitBranch, isFuture: true },
    ],
  },
  {
    id: "saas-financeiro",
    category: "Financeiro da Plataforma",
    icon: DollarSign,
    items: [
      { href: "#", label: "Stripe", icon: CreditCard, isFuture: true },
    ],
  },
  {
    id: "saas-ops",
    category: "Operação & Segurança",
    icon: ShieldAlert,
    items: [
      { href: "#", label: "Logs & Auditoria", icon: History, isFuture: true },
      { href: "#", label: "Monitoramento", icon: Activity, isFuture: true },
      { href: "#", label: "Usuários da Plataforma", icon: Users, isFuture: true },
      { href: "#", label: "Alertas", icon: Bell, isFuture: true },
      { href: "#", label: "Segurança & LGPD", icon: Shield, isFuture: true },
      { href: "#", label: "Backups", icon: Server, isFuture: true },
    ],
  },
];

export function Sidebar({
  isCollapsed,
  setIsCollapsed,
  isMobileOpen,
  setIsMobileOpen,
}: {
  isCollapsed: boolean;
  setIsCollapsed: (val: boolean | ((prev: boolean) => boolean)) => void;
  isMobileOpen: boolean;
  setIsMobileOpen: (val: boolean) => void;
}) {
  const pathname = usePathname();
  const [role, setRole] = useState<UserRole | null>(
    () => (getCurrentUser().id ? getCurrentUser().role : null)
  );
  const { isSaaSMode } = useTenant();

  // Accordion State
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    "visao-geral": true,
    "ia": true,
    "financeiro": true,
    "operacao": false,
    "documentos": false,
    "admin": false,
    "saas-visao-geral": true,
    "saas-empresas": true,
    "saas-financeiro": true,
    "saas-ops": false
  });

  useEffect(() => {
    const user = getCurrentUser();
    setRole(user.role);

    const handleRoleChange = () => {
      const u = getCurrentUser();
      setRole(u.role);
    };

    window.addEventListener("omnizeus_role_change", handleRoleChange);
    window.addEventListener("omnizeus_user_change", handleRoleChange);

    return () => {
      window.removeEventListener("omnizeus_role_change", handleRoleChange);
      window.removeEventListener("omnizeus_user_change", handleRoleChange);
    };
  }, []);

  const toggleCollapse = () => setIsCollapsed((prev) => !prev);

  const toggleGroup = (id: string) => {
    if (isCollapsed) setIsCollapsed(false);
    setOpenGroups(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const isMasterAdmin = role === "super_adm";

  // ── Modo SaaS (Super ADM na plataforma): APENAS menus do SaaS.
  // ── Modo Empresa (super_adm dentro de empresa OU gestor/funcionário): APENAS menus da empresa.
  // Os dois conjuntos NUNCA se misturam.
  // Enquanto a sessão não é reidratada (role === null), o sidebar fica neutro
  // (sem itens), evitando piscar o menu de empresa para o Super ADM no 1º render.
  const showSaaS = role !== null && isMasterAdmin && isSaaSMode;
  // Funcionários operacionais têm o menu filtrado pelos módulos liberados
  // (allowedModules). Gestores e Super ADM veem todos os menus do tenant.
  const allowedModules = role === "funcionario" ? getAllowedModules() : null;
  const displayedGroups = role === null
    ? []
    : showSaaS
      ? saasNavGroups
      : tenantNavGroups
          .filter(group => {
            // Hide "Administração" category for operational employees (funcionario)
            if (group.id === "admin" && role === "funcionario") {
              return false;
            }
            return true;
          })
          .map(group => {
            if (!allowedModules) return group;
            const items = group.items.filter(item => !item.module || allowedModules.includes(item.module));
            return { ...group, items };
          })
          .filter(group => group.items.length > 0);


  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden backdrop-blur-xs bg-slate-900/60 transition-opacity"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 bottom-0 z-50 flex flex-col transition-all duration-300 bg-slate-50 border-r border-slate-200 ${
          isCollapsed ? "w-16" : "w-64"
        } ${isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      >
        {/* Header */}
        <div
          className={`h-14 flex items-center shrink-0 border-b border-slate-100 ${
            isCollapsed ? "justify-center px-2" : "justify-between px-4"
          }`}
        >
          {isCollapsed ? (
            <button
              onClick={toggleCollapse}
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 transition-colors"
              title="Expandir menu"
            >
              <ChevronRight className="w-4 h-4 text-slate-500" strokeWidth={2} />
            </button>
          ) : (
            <>
              <div className="flex items-center gap-2.5 overflow-hidden">
                <div className="flex flex-col min-w-0 py-1">
                  <span className="font-extrabold text-primary text-[15px] tracking-tight leading-none truncate mb-1 flex items-center gap-2">
                    OmniZeus
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium tracking-wider uppercase">
                    • Multi-Finance
                  </span>
                </div>
              </div>

              <button
                onClick={toggleCollapse}
                className="hidden lg:flex p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
                title="Recolher menu"
              >
                <ChevronLeft className="w-4 h-4" strokeWidth={2} />
              </button>
            </>
          )}

          {/* Mobile close */}
          <button
            onClick={() => setIsMobileOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-700 transition-colors ml-auto"
          >
            <X className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4 custom-scrollbar">
          {displayedGroups.map((group) => {
            const isOpen = openGroups[group.id];

            return (
              <div key={group.id} className="space-y-0.5">
                {/* Section Header / Accordion Trigger */}
                <button
                  onClick={() => toggleGroup(group.id)}
                  className={`w-full flex items-center transition-colors group/header ${
                    isCollapsed ? "justify-center py-2" : "justify-between px-2 py-1.5"
                  }`}
                  title={isCollapsed ? group.category : undefined}
                >
                  <div className={`flex items-center gap-2 ${
                    group.id.startsWith('saas-') ? 'text-primary font-semibold' : 'text-slate-500 group-hover/header:text-slate-700'
                  }`}>
                    {isCollapsed && <group.icon className="w-4 h-4" />}
                    {!isCollapsed && (
                      <span className="text-[11px] font-semibold uppercase tracking-tight flex items-center gap-1.5">
                        {group.category}
                      </span>
                    )}
                  </div>
                  {!isCollapsed && (
                    <ChevronDown 
                      className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ease-out ${isOpen ? "rotate-180" : ""}`} 
                    />
                  )}
                </button>

                {/* Items */}
                {(!isCollapsed ? isOpen : true) && (
                  <div className={`space-y-0.5 ${isCollapsed ? "" : "mt-1"}`}>
                    {group.items.map((item) => {
                      const isActive = pathname === item.href;
                      const Icon = item.icon;

                      return (
                        <Link
                          key={item.label}
                          href={item.href}
                          prefetch={true}
                          onClick={(e) => {
                            if (item.isFuture) e.preventDefault();
                            setIsMobileOpen(false);
                          }}
                          title={isCollapsed ? item.label : undefined}
                          className={`flex items-center gap-3 py-2 rounded-lg text-xs transition-all duration-200 ease-out group ${
                            isCollapsed ? "justify-center px-0" : "px-3"
                          } ${item.isFuture ? "cursor-not-allowed opacity-50" : "cursor-pointer"} ${
                            isActive
                              ? "bg-primary/5 text-primary font-semibold"
                              : "text-slate-500 font-medium hover:bg-slate-200/50 hover:text-slate-900"
                          }`}
                          style={{
                            borderLeft: isActive && !isCollapsed 
                              ? "3px solid hsl(var(--primary))" 
                              : isCollapsed ? undefined : "3px solid transparent",
                          }}
                        >
                          <Icon
                            className={`shrink-0 transition-all duration-200 ease-out ${isActive ? "text-primary" : "text-slate-400 group-hover:text-slate-600"}`}
                            style={{
                              width: 17,
                              height: 17,
                              strokeWidth: isActive ? 2 : 1.5,
                            }}
                          />
                          {!isCollapsed && (
                            <div className="flex-1 flex items-center justify-between min-w-0">
                              <span className={`truncate ${isActive ? 'font-bold' : ''}`}>
                                {item.label} {item.isFuture && <span className="text-[9px] font-normal opacity-60 ml-1">(Em breve)</span>}
                              </span>
                              
                              {item.badge && !item.isFuture && (
                                <span className={`ml-2 px-1.5 py-0.5 rounded-md text-[9px] font-bold ${
                                  isActive ? 'bg-primary text-white' : 'bg-slate-700 text-slate-300'
                                }`}>
                                  {item.badge}
                                </span>
                              )}
                            </div>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
