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
  ChevronDown,
  Globe
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
  const [activeCompanyId, setActiveCompanyIdState] = useState<string>("global");

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

  const isMasterAdmin = currentUser.role === "super_adm";
  const activeCompany = companies.find(c => c.id === activeCompanyId);

  return (
    <header 
      className={`h-14 bg-white border-b border-slate-200/80 fixed top-0 right-0 z-30 flex items-center justify-between px-4 sm:px-6 transition-all duration-300 ${
        isCollapsed ? "left-0 lg:left-16" : "left-0 lg:left-64"
      }`}
    >
      {/* Left: Mobile Toggle & Super Admin Company Context Selector */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 mr-2">
        <button
          onClick={() => setIsMobileOpen(true)}
          className="lg:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors shrink-0"
          title="Abrir menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {isMasterAdmin ? (
          <div className="flex items-center gap-2">
            <div className="relative flex items-center">
              {activeCompanyId === 'global' ? (
                <Globe className="w-3.5 h-3.5 text-primary absolute left-3 pointer-events-none" />
              ) : (
                <Building2 className="w-3.5 h-3.5 text-primary absolute left-3 pointer-events-none" />
              )}
              <select
                value={activeCompanyId}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'global') {
                    setActiveCompanyContext('global', 'Visão Global SaaS Master');
                  } else {
                    const found = companies.find(c => c.id === val);
                    if (found) {
                      setActiveCompanyContext(found.id, found.tradeName || found.corporateName);
                    }
                  }
                }}
                className="h-8 pl-8 pr-7 text-xs bg-slate-50 hover:bg-slate-100/80 text-slate-800 font-medium rounded-lg border border-slate-200/90 focus:outline-none focus:border-primary cursor-pointer transition-all appearance-none max-w-[140px] sm:max-w-[220px] truncate"
              >
                <option value="global">Visão Global (Consolidado SaaS)</option>
                {companies.length > 0 && <option disabled>──────────────</option>}
                {companies.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.tradeName || c.corporateName}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 pointer-events-none" />
            </div>

            {activeCompanyId !== 'global' ? (
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200/70 rounded-md text-[10px] font-semibold tracking-tight">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                Empresa Ativa: <strong className="font-bold">{activeCompany?.tradeName || activeCompanyId}</strong>
              </span>
            ) : (
              <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 bg-primary/5 text-primary border border-primary/20 rounded-md text-[10px] font-semibold">
                Consolidado Master
              </span>
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
        {/* OmniCoins widget removed per user request */}

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
