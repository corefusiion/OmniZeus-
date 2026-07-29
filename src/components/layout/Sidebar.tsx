"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import {
  LayoutDashboard, Sparkles, DollarSign, MessageSquare, CheckSquare,
  FileText, Presentation, Settings, Shield, ChevronLeft, ChevronRight, X,
  Link as LinkIcon, FileCheck, Briefcase, Bell, Calendar, Bot, History,
  Activity, PenTool, Users, Building2, ChevronDown, User, Network
} from "lucide-react";
import { getActiveRole, UserRole, ROLE_LABELS } from "@/lib/auth/roles";
import { getEmployees, EmployeeUser } from "@/lib/company/store";
import LiveVisitorCounter from "@/components/ui/LiveVisitorCounter";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  isFuture?: boolean;
  badge?: number;
}

interface NavGroup {
  id: string;
  category: string;
  icon: React.ElementType;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    id: "visao-geral",
    category: "Visão Geral",
    icon: LayoutDashboard,
    items: [
      { href: "/dashboard", label: "Dashboard Executivo", icon: Activity },
      { href: "#", label: "Central de Notificações", icon: Bell, isFuture: true, badge: 3 },
      { href: "#", label: "Agenda Corporativa", icon: Calendar, isFuture: true },
    ],
  },
  {
    id: "ia",
    category: "Inteligência Artificial",
    icon: Sparkles,
    items: [
      { href: "/omni-ia", label: "Omni IA Hub", icon: Sparkles },
      { href: "#", label: "Agentes Especializados", icon: Bot, isFuture: true },
      { href: "#", label: "Histórico de Conversas", icon: History, isFuture: true },
    ],
  },
  {
    id: "financeiro",
    category: "Operação Financeira",
    icon: DollarSign,
    items: [
      { href: "/financeiro", label: "Financeiro | Contas a pagar", icon: DollarSign },
      { href: "/contratos", label: "Contratos de Honorários", icon: Briefcase },
      { href: "/solicitacoes", label: "Solicitações & Compras", icon: FileCheck, badge: 3 },
      { href: "/contaazul", label: "Integração Conta Azul", icon: LinkIcon },
    ],
  },
  {
    id: "operacao",
    category: "Operação",
    icon: CheckSquare,
    items: [
      { href: "/tarefas", label: "Tarefas Operacionais", icon: CheckSquare },
      { href: "#", label: "WhatsApp Bot & Kanban", icon: MessageSquare, isFuture: true },
      { href: "#", label: "Fluxos Automatizados", icon: Network, isFuture: true },
    ],
  },
  {
    id: "documentos",
    category: "Documentos",
    icon: FileText,
    items: [
      { href: "/documentos", label: "Gerador de Documentos", icon: FileText },
      { href: "/apresentacoes", label: "Apresentações Decks", icon: Presentation },
      { href: "#", label: "Modelos LLM", icon: Bot, isFuture: true },
      { href: "#", label: "Assinaturas", icon: PenTool, isFuture: true },
    ],
  },
];

const adminGroup: NavGroup = {
  id: "admin",
  category: "Administração",
  icon: Settings,
  items: [
    { href: "/configuracoes", label: "Configurações", icon: Settings },
    { href: "/usuarios", label: "Usuários", icon: Users },
    { href: "/empresas", label: "Empresas", icon: Building2 },
    { href: "/permissoes", label: "Permissões", icon: Shield },
    { href: "/treinar-agente", label: "Criar & Treinar Agente", icon: Bot },
    { href: "/estatisticas-ia", label: "Estatísticas de IA", icon: Activity },
  ],
};

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
  const [role, setRole] = useState<UserRole>("gestor");
  
  // Accordion State
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    "visao-geral": true,
    "ia": true,
    "financeiro": false,
    "operacao": true,
    "documentos": false,
    "admin": false
  });

  // Online Presence Modal State
  const [showOnlineUsers, setShowOnlineUsers] = useState(false);
  const [employees, setEmployees] = useState<EmployeeUser[]>([]);

  useEffect(() => {
    setRole(getActiveRole());
    setEmployees(getEmployees('comp_zenitus').filter(e => e.status === 'Ativo'));

    const handleRoleChange = () => setRole(getActiveRole());
    const handleEmp = () => setEmployees(getEmployees('comp_zenitus').filter(e => e.status === 'Ativo'));

    window.addEventListener("omnizeus_role_change", handleRoleChange);
    window.addEventListener("omnizeus_employees_change", handleEmp);

    return () => {
      window.removeEventListener("omnizeus_role_change", handleRoleChange);
      window.removeEventListener("omnizeus_employees_change", handleEmp);
    };
  }, []);

  const toggleCollapse = () => setIsCollapsed((prev) => !prev);

  const toggleGroup = (id: string) => {
    if (isCollapsed) setIsCollapsed(false);
    setOpenGroups(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const displayedGroups = [...navGroups];
  if (role === "gestor" || role === "super_adm") {
    displayedGroups.push(adminGroup);
  }

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden backdrop-blur-xs bg-slate-900/60 transition-opacity"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Online Users Modal (Simulated) */}
      {showOnlineUsers && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-xs" onClick={() => setShowOnlineUsers(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm border border-slate-200 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-900 flex items-center gap-2 text-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Usuários Online ({Math.max(1, employees.length)})
              </h3>
              <button onClick={() => setShowOnlineUsers(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-2 space-y-1 max-h-[300px] overflow-y-auto">
              {employees.length === 0 && (
                <div className="p-4 text-center text-slate-500 text-xs">Apenas você está online.</div>
              )}
              {employees.map((emp) => (
                <div key={emp.id} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg cursor-pointer">
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0">
                    {emp.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-800 truncate">{emp.name}</p>
                    <p className="text-[10px] text-emerald-600 font-medium">Ativo agora</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 bottom-0 z-50 flex flex-col transition-all duration-300 ${
          isCollapsed ? "w-16" : "w-64"
        } ${isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
        style={{
          background: "#18181B", // Zinc-900 (Linear-like dark theme)
          borderRight: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        {/* Header */}
        <div
          className={`h-14 flex items-center shrink-0 ${
            isCollapsed ? "justify-center px-2" : "justify-between px-4"
          }`}
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          {isCollapsed ? (
            <button
              onClick={toggleCollapse}
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors"
              title="Expandir menu"
            >
              <ChevronRight className="w-4 h-4 text-gray-400" strokeWidth={2} />
            </button>
          ) : (
            <>
              <div className="flex items-center gap-2.5 overflow-hidden">
                <div className="flex flex-col min-w-0 py-1">
                  <span className="font-bold text-white text-[15px] tracking-tight leading-none truncate mb-1">
                    OmniZeus
                  </span>
                  <span className="text-[10px] text-gray-400 font-medium tracking-wider uppercase">
                    • Workspace
                  </span>
                </div>
              </div>

              <button
                onClick={toggleCollapse}
                className="hidden lg:flex p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-colors shrink-0"
                title="Recolher menu"
              >
                <ChevronLeft className="w-4 h-4" strokeWidth={2} />
              </button>
            </>
          )}

          {/* Mobile close */}
          <button
            onClick={() => setIsMobileOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-gray-500 hover:text-white transition-colors ml-auto"
          >
            <X className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4 custom-scrollbar">
          {displayedGroups.map((group) => {
            const isOpen = openGroups[group.id];
            const hasActiveItem = group.items.some(i => pathname === i.href);

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
                  <div className="flex items-center gap-2 text-slate-400 group-hover/header:text-slate-200">
                    {isCollapsed && <group.icon className="w-4 h-4" />}
                    {!isCollapsed && (
                      <span className="text-[10px] font-bold uppercase tracking-widest">
                        {group.category}
                      </span>
                    )}
                  </div>
                  {!isCollapsed && (
                    <ChevronDown 
                      className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} 
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
                          onClick={(e) => {
                            if (item.isFuture) e.preventDefault();
                            setIsMobileOpen(false);
                          }}
                          title={isCollapsed ? item.label : undefined}
                          className={`flex items-center gap-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all group ${
                            isCollapsed ? "justify-center px-0" : "px-2"
                          } ${item.isFuture ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
                          style={{
                            background: isActive ? "rgba(30, 111, 217, 0.15)" : "transparent",
                            color: isActive ? "#FFFFFF" : "rgba(255,255,255,0.6)",
                            borderLeft: isActive && !isCollapsed ? "3px solid #1E6FD9" : isCollapsed ? undefined : "3px solid transparent",
                          }}
                        >
                          <Icon
                            className="shrink-0 transition-colors"
                            style={{
                              width: 15,
                              height: 15,
                              strokeWidth: 2,
                              color: isActive ? "#1E6FD9" : "rgba(255,255,255,0.45)",
                            }}
                          />
                          {!isCollapsed && (
                            <div className="flex-1 flex items-center justify-between min-w-0">
                              <span className={`truncate ${isActive ? 'font-bold' : ''}`}>
                                {item.label} {item.isFuture && <span className="text-[9px] font-normal opacity-50 ml-1">(futuro)</span>}
                              </span>
                              
                              {/* Badges */}
                              {item.badge && !item.isFuture && (
                                <span className={`ml-2 px-1.5 py-0.5 rounded-md text-[9px] font-bold ${
                                  isActive ? 'bg-[#1E6FD9] text-white' : 'bg-slate-700 text-slate-300'
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

          {/* Super ADM */}
          {role === "super_adm" && (
            <div className="space-y-0.5" style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 16 }}>
              {!isCollapsed && (
                <div
                  className="px-2 mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400"
                >
                  Master SaaS
                </div>
              )}
              <Link
                href="/super-adm"
                onClick={() => setIsMobileOpen(false)}
                title={isCollapsed ? "Master Configs" : undefined}
                className={`flex items-center gap-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  isCollapsed ? "justify-center px-0" : "px-2"
                }`}
                style={{
                  background: pathname === "/super-adm" ? "rgba(30, 111, 217, 0.15)" : "transparent",
                  color: pathname === "/super-adm" ? "#FFFFFF" : "rgba(255,255,255,0.6)",
                  borderLeft: !isCollapsed ? (pathname === "/super-adm" ? "3px solid #1E6FD9" : "3px solid transparent") : undefined,
                }}
              >
                <Shield
                  style={{ width: 15, height: 15, strokeWidth: 2, color: pathname === "/super-adm" ? "#1E6FD9" : "rgba(255,255,255,0.45)", flexShrink: 0 }}
                />
                {!isCollapsed && <span className="truncate">Master Configs</span>}
              </Link>
            </div>
          )}
        </nav>

        {/* Presence Footer Widget */}
        <div
          className="hidden shrink-0 p-3"
          style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div onClick={() => setShowOnlineUsers(true)}>
            <LiveVisitorCounter isCollapsed={isCollapsed} visitorCount={Math.max(1, employees.length)} />
          </div>
        </div>
      </aside>
    </>
  );
}
