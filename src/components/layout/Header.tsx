"use client";

import { useState, useEffect } from "react";
import { 
  Coins, 
  Bell, 
  Menu, 
  LogOut,
  ShieldCheck,
  UserCheck,
  Briefcase,
  Building2,
  ChevronDown
} from "lucide-react";
import { 
  getCurrentUser, logoutUser, UserProfile, ROLE_LABELS, 
  getActiveCompanyId, setActiveCompanyContext 
} from "@/lib/auth/roles";
import { getCompanies, CompanyProfile } from "@/lib/company/store";
import { getCoinBalance } from "@/lib/coins/store";
import NotificationsFilter from "@/components/ui/NotificationsFilter";

export function Header({ 
  isCollapsed, 
  setIsMobileOpen 
}: { 
  isCollapsed: boolean;
  setIsMobileOpen: (val: boolean) => void;
}) {
  const [currentUser, setCurrentUser] = useState<UserProfile>(getCurrentUser());
  const [balance, setBalance] = useState<number>(14250);
  
  // Multi-Tenant Context State
  const [companies, setCompanies] = useState<CompanyProfile[]>([]);
  const [activeCompanyId, setActiveCompanyIdState] = useState<string>("comp_zenitus");

  useEffect(() => {
    setCurrentUser(getCurrentUser());
    setCompanies(getCompanies());
    const currentActiveId = getActiveCompanyId();
    setActiveCompanyIdState(currentActiveId);

    // Calculate initial coins for active company
    const activeComp = getCompanies().find(c => c.id === currentActiveId);
    if (activeComp) {
      setBalance(activeComp.coinsFranchise || 15000);
    } else {
      setBalance(getCoinBalance());
    }

    const handleUserChange = () => {
      setCurrentUser(getCurrentUser());
      const newActiveId = getActiveCompanyId();
      setActiveCompanyIdState(newActiveId);
      const targetComp = getCompanies().find(c => c.id === newActiveId);
      if (targetComp) {
        setBalance(targetComp.coinsFranchise || 15000);
      }
    };
    const handleCoinsChange = () => setBalance(getCoinBalance());
    const handleCompChange = () => {
      const all = getCompanies();
      setCompanies(all);
      const newActiveId = getActiveCompanyId();
      setActiveCompanyIdState(newActiveId);
      const targetComp = all.find(c => c.id === newActiveId);
      if (targetComp) {
        setBalance(targetComp.coinsFranchise || 15000);
      }
    };

    window.addEventListener("omnizeus_role_change", handleUserChange);
    window.addEventListener("omnizeus_user_change", handleUserChange);
    window.addEventListener("omnizeus_company_context_change", handleUserChange);
    window.addEventListener("omnizeus_coins_change", handleCoinsChange);
    window.addEventListener("omnizeus_companies_change", handleCompChange);

    return () => {
      window.removeEventListener("omnizeus_role_change", handleUserChange);
      window.removeEventListener("omnizeus_user_change", handleUserChange);
      window.removeEventListener("omnizeus_company_context_change", handleUserChange);
      window.removeEventListener("omnizeus_coins_change", handleCoinsChange);
      window.removeEventListener("omnizeus_companies_change", handleCompChange);
    };
  }, []);

  const handleSelectCompany = (comp: CompanyProfile) => {
    setActiveCompanyContext(comp.id, comp.tradeName || comp.corporateName);
    setActiveCompanyIdState(comp.id);
    setBalance(comp.coinsFranchise || 15000);
  };

  const isMasterAdmin = currentUser.role === "super_adm" || currentUser.email === "jsgleisson@gmail.com";
  const activeCompany = companies.find(c => c.id === activeCompanyId) || companies[0] || {
    id: "comp_zenitus",
    corporateName: "Zenitus Inteligência Contábil Ltda",
    tradeName: "Zenitus Contábil",
    cnpj: "42.189.902/0001-55"
  };

  return (
    <header 
      className={`h-14 bg-white border-b border-gray-200 fixed top-0 right-0 z-30 flex items-center justify-between px-4 sm:px-6 transition-all duration-300 ${
        isCollapsed ? "left-0 lg:left-16" : "left-0 lg:left-64"
      }`}
    >
      {/* Left: Mobile Toggle & Company Context */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 mr-2">
        <button
          onClick={() => setIsMobileOpen(true)}
          className="lg:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors shrink-0"
          title="Abrir menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Multi-Tenant Company Context Selector ONLY VISIBLE FOR MASTER ADMIN */}
        {isMasterAdmin ? (
          <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-lg">
            <Building2 className="w-4 h-4 text-primary shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="text-[9px] font-bold uppercase tracking-wider text-primary leading-none">
                Empresa Ativa (Master Admin):
              </span>
              <select
                value={activeCompanyId}
                onChange={(e) => {
                  const target = companies.find(c => c.id === e.target.value);
                  if (target) handleSelectCompany(target);
                }}
                className="bg-transparent text-xs font-bold text-slate-900 focus:outline-none cursor-pointer truncate max-w-[180px] sm:max-w-[260px]"
              >
                {companies.map(c => (
                  <option key={c.id} value={c.id}>{c.tradeName || c.corporateName}</option>
                ))}
              </select>
            </div>
          </div>
        ) : (
          /* Standard Company Title for Gestores and Funcionários */
          <div className="hidden sm:flex flex-col shrink-0 min-w-0">
            <div className="flex items-center gap-1.5 truncate">
              <h2 className="text-xs font-semibold text-gray-900 tracking-tight truncate max-w-[200px] lg:max-w-[300px]">
                {activeCompany.tradeName || activeCompany.corporateName}
              </h2>
              <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 text-[10px] font-medium border border-gray-200 shrink-0">
                Matriz
              </span>
            </div>
            <p className="text-[10px] text-gray-400 font-normal truncate">CNPJ: {activeCompany.cnpj || "42.189.902/0001-55"}</p>
          </div>
        )}
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* OmniCoins Balance Widget (Specific to current active company) */}
        {currentUser.role !== "funcionario" && (
          <div className="flex items-center gap-1.5 sm:gap-2 bg-gray-50 border border-gray-200 px-2.5 sm:px-3 py-1 rounded-lg transition-all hover:bg-gray-100 shrink-0">
            <Coins className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <div className="text-xs font-medium">
              <span className="text-gray-500 font-normal hidden xl:inline">Saldo OmniCoins: </span>
              <span className="font-semibold text-gray-900">{balance.toLocaleString('pt-BR')}</span>
              <span className="text-[10px] text-gray-400 ml-1 hidden 2xl:inline">(~R$ {(balance * 0.1).toFixed(2)})</span>
            </div>
          </div>
        )}

        {/* Interactive Notifications Trigger */}
        <NotificationsFilter />

        {/* Logged User Role Badge */}
        <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 shrink-0">
          {currentUser.role === 'super_adm' && <ShieldCheck className="w-3.5 h-3.5 text-primary" strokeWidth={1.5} />}
          {currentUser.role === 'gestor' && <UserCheck className="w-3.5 h-3.5 text-primary" strokeWidth={1.5} />}
          {currentUser.role === 'funcionario' && <Briefcase className="w-3.5 h-3.5 text-gray-700" strokeWidth={1.5} />}
          <span>{ROLE_LABELS[currentUser.role]?.label}</span>
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
    </header>
  );
}
