"use client";

import { useState, useEffect } from "react";
import { 
  Bell, 
  Menu, 
  LogOut,
  ShieldCheck,
  UserCheck,
  Briefcase,
  Building2,
  ChevronDown,
  Globe,
  DoorOpen,
  ArrowRight,
  X,
  CheckCircle2
} from "lucide-react";
import { 
  getCurrentUser, logoutUser, UserProfile, ROLE_LABELS
} from "@/lib/auth/roles";
import { getCompanies, CompanyProfile } from "@/lib/company/store";
import { useTenant } from "@/lib/tenant/TenantContext";
import NotificationsFilter from "@/components/ui/NotificationsFilter";

export function Header({ 
  isCollapsed, 
  setIsMobileOpen 
}: { 
  isCollapsed: boolean;
  setIsMobileOpen: (val: boolean) => void;
}) {
  const [currentUser, setCurrentUser] = useState<UserProfile>(getCurrentUser());
  const [companies, setCompanies] = useState<CompanyProfile[]>([]);
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);
  const [pendingCompany, setPendingCompany] = useState<CompanyProfile | null>(null);

  const { tenantId, activeCompany, isTenantMode, canSwitchCompany, enterTenant, exitTenant } = useTenant();

  useEffect(() => {
    setCurrentUser(getCurrentUser());
    setCompanies(getCompanies());

    const handleUserChange = () => setCurrentUser(getCurrentUser());
    const handleCompChange = () => setCompanies(getCompanies());

    window.addEventListener("omnizeus_role_change", handleUserChange);
    window.addEventListener("omnizeus_user_change", handleUserChange);
    window.addEventListener("omnizeus_company_context_change", handleUserChange);
    window.addEventListener("omnizeus_companies_change", handleCompChange);

    return () => {
      window.removeEventListener("omnizeus_role_change", handleUserChange);
      window.removeEventListener("omnizeus_user_change", handleUserChange);
      window.removeEventListener("omnizeus_company_context_change", handleUserChange);
      window.removeEventListener("omnizeus_companies_change", handleCompChange);
    };
  }, []);

  const isMasterAdmin = currentUser.role === "super_adm";
  const sessionResolved = Boolean(currentUser.id);

  const confirmEnter = () => {
    if (pendingCompany) {
      enterTenant(pendingCompany.id);
      setPendingCompany(null);
      setIsSwitcherOpen(false);
    }
  };

  return (
    <>
      <header 
        className={`fixed top-0 right-0 z-30 flex flex-col bg-white border-b border-slate-200/80 transition-all duration-300 ${
          isCollapsed ? "left-0 lg:left-16" : "left-0 lg:left-64"
        }`}
      >
        <div className="h-14 flex items-center justify-between px-4 sm:px-6 shrink-0">
          {/* Left: Mobile Toggle & Tenant Context Switcher */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 mr-2">
            <button
              onClick={() => setIsMobileOpen(true)}
              className="lg:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors shrink-0"
              title="Abrir menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            {sessionResolved && isMasterAdmin ? (
              /* ── Workspace Switcher (Super ADM): Visão Global SaaS + Empresas ── */
              <div className="relative">
                <button
                  onClick={() => setIsSwitcherOpen(o => !o)}
                  className={`flex items-center gap-2 pl-3 pr-2.5 h-8 font-medium rounded-lg border transition-all ${
                    isTenantMode
                      ? "bg-amber-50 hover:bg-amber-100/70 text-amber-900 border-amber-200/90"
                      : "bg-slate-50 hover:bg-slate-100/80 text-slate-800 border-slate-200/90"
                  }`}
                  title={isTenantMode ? "Alternar empresa / voltar à plataforma" : "Selecionar Empresa"}
                >
                  {isTenantMode ? (
                    <DoorOpen className="w-3.5 h-3.5 text-amber-600" />
                  ) : (
                    <Globe className="w-3.5 h-3.5 text-primary" />
                  )}
                  <span className="text-xs max-w-[150px] sm:max-w-[220px] truncate">
                    {isTenantMode
                      ? activeCompany?.tradeName || activeCompany?.corporateName || "Empresa"
                      : "Visão Global SaaS"}
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isSwitcherOpen ? "rotate-180" : ""}`} />
                </button>

                {isSwitcherOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsSwitcherOpen(false)} />
                    <div className="absolute top-full left-0 mt-2 w-[320px] bg-white rounded-xl border border-slate-200 shadow-xl z-50 overflow-hidden">
                      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/60">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Workspace</p>
                        <p className="text-xs text-slate-600 mt-0.5">
                          Administre a plataforma ou entre em uma empresa
                        </p>
                      </div>

                      <div className="max-h-[320px] overflow-y-auto p-2 space-y-1">
                        {/* Visão Global SaaS — clicável para sair da empresa */}
                        <button
                          onClick={() => {
                            if (isTenantMode) exitTenant();
                            setIsSwitcherOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors ${
                            !isTenantMode
                              ? "bg-primary/5 border border-primary/15"
                              : "hover:bg-slate-50 border border-transparent"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Globe className="w-4 h-4 text-primary shrink-0" />
                            <div className="min-w-0 text-left">
                              <p className="text-xs font-semibold text-slate-800 truncate">Visão Global SaaS</p>
                              <p className="text-[10px] text-slate-400">Centro de controle da plataforma</p>
                            </div>
                          </div>
                          {!isTenantMode && <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />}
                        </button>

                        <div className="my-1 border-t border-slate-100" />

                        {companies.length === 0 && (
                          <p className="px-3 py-4 text-center text-xs text-slate-400">
                            Nenhuma empresa cadastrada ainda.
                          </p>
                        )}

                        {companies.map(c => (
                          <div
                            key={c.id}
                            className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-slate-50 transition-colors group"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                                <Building2 className="w-3.5 h-3.5" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-slate-800 truncate">{c.tradeName || c.corporateName}</p>
                                <p className="text-[10px] text-slate-400 truncate">
                                  {c.plan} · {c.status}
                                </p>
                              </div>
                            </div>
                            {isTenantMode && tenantId === c.id ? (
                              <span className="ml-3 shrink-0 px-2 py-1 rounded-md bg-amber-50 text-amber-700 text-[10px] font-bold border border-amber-200">
                                Atual
                              </span>
                            ) : (
                              <button
                                onClick={() => setPendingCompany(c)}
                                className="ml-3 shrink-0 px-2.5 py-1.5 rounded-md bg-primary text-white text-[11px] font-semibold flex items-center gap-1 hover:bg-primary/90 transition-colors"
                              >
                                {isTenantMode ? "Trocar" : "Entrar"}
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700">
                <Building2 className="w-3.5 h-3.5 text-primary" />
                <span>{currentUser.companyName || 'Empresa Contratante'}</span>
              </div>
            )}
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <NotificationsFilter />

            {/* Logged User Role Badge */}
            <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 shrink-0">
              {sessionResolved ? (
                <>
                  {isMasterAdmin && <ShieldCheck className="w-3.5 h-3.5 text-primary" strokeWidth={1.5} />}
                  {currentUser.role === 'gestor' && <UserCheck className="w-3.5 h-3.5 text-primary" strokeWidth={1.5} />}
                  {currentUser.role === 'funcionario' && <Briefcase className="w-3.5 h-3.5 text-gray-700" strokeWidth={1.5} />}
                  <span>{ROLE_LABELS[currentUser.role]?.label}</span>
                </>
              ) : (
                <span className="text-gray-400">Carregando sessão...</span>
              )}
            </div>
            {/* Clean User Profile Avatar & Logout Button */}
            <div className="flex items-center gap-2 sm:gap-3 pl-2 border-l border-gray-200 shrink-0">
              <div className="w-7 h-7 rounded-lg bg-gray-900 text-white font-semibold flex items-center justify-center text-xs shrink-0">
                {currentUser.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
              </div>
              <div className="text-xs hidden 2xl:block">
                <p className="font-semibold text-gray-900 leading-tight truncate max-w-[120px]">{currentUser.name}</p>
                <p className="text-[10px] text-gray-400 font-normal truncate max-w-[120px]">{currentUser.email}</p>
              </div>
              <button
                onClick={logoutUser}
                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                title="Sair do Sistema (Logout)"
              >
                <LogOut className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>
          </div>
        </div>

        {/* ── Banner fixo: apenas Super ADM dentro de uma empresa ── */}
        {isMasterAdmin && isTenantMode && canSwitchCompany && (
          <div className="h-9 flex items-center justify-between px-4 sm:px-6 bg-amber-50 border-t border-amber-200 text-xs text-amber-900 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <DoorOpen className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span className="truncate">
                Você está administrando: <strong className="font-bold">{activeCompany?.tradeName || activeCompany?.corporateName || tenantId}</strong>
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-[10px] font-semibold">
                Modo Empresa
              </span>
            </div>
            <button
              onClick={exitTenant}
              className="shrink-0 ml-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-amber-600 hover:bg-amber-700 text-white font-semibold text-[11px] transition-colors"
              title="Voltar ao centro de controle da plataforma"
            >
              <X className="w-3.5 h-3.5" />
              Sair da Empresa
            </button>
          </div>
        )}
      </header>

      {/* ── Modal: Confirmação para entrar na empresa ── */}
      {pendingCompany && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full animate-in fade-in zoom-in-95">
            <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4">
              <Building2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Você está entrando na empresa</h3>
            <p className="text-lg font-extrabold text-primary mt-1">
              {pendingCompany.tradeName || pendingCompany.corporateName}
            </p>
            <p className="text-xs text-slate-500 mt-3 leading-relaxed">
              Durante este período, todo o sistema será carregado utilizando exclusivamente os dados desta empresa
              <span className="font-semibold text-slate-700"> ({pendingCompany.plan} · {pendingCompany.status})</span>.
            </p>

            <div className="mt-6 flex items-center gap-3">
              <button
                onClick={() => setPendingCompany(null)}
                className="flex-1 py-2.5 rounded-lg border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmEnter}
                className="flex-1 py-2.5 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary/90 transition-colors flex items-center justify-center gap-1.5"
              >
                Entrar na Empresa
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
