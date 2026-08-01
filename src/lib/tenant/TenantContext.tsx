"use client";

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  getActiveTenantId,
  setActiveCompanyContext,
  getActiveRole,
  getCurrentUser,
  UserRole
} from "@/lib/auth/roles";
import { getCompanies, CompanyProfile } from "@/lib/company/store";
import { invalidateSwrCache } from "@/lib/cache/swrCache";
import { resetCoinStore } from "@/lib/coins/store";
import { resetCompanyStore } from "@/lib/company/store";
import { resetTaskStore } from "@/lib/tasks/store";
import { resetSqliteDb } from "@/lib/db/sqlite";

export interface TenantContextValue {
  /** null = modo SaaS (Super ADM no painel da plataforma). string = empresa ativa. */
  tenantId: string | null;
  /** Empresa ativa do tenant (null quando no modo SaaS). */
  activeCompany: CompanyProfile | null;
  /** true quando o Super ADM está no centro de controle da plataforma (sem empresa). */
  isSaaSMode: boolean;
  /** true quando há uma empresa ativa (Super ADM entrou ou é um gestor/funcionário). */
  isTenantMode: boolean;
  /** true apenas para Super ADM (tem o poder de navegar entre empresas). */
  canSwitchCompany: boolean;
  enterTenant: (companyId: string) => void;
  exitTenant: () => void;
  refresh: () => void;
}

const TenantContext = createContext<TenantContextValue | null>(null);

/**
 * Limpa TODOS os caches em memória ao trocar de tenant,
 * impedindo vazamento de dados entre empresas.
 */
function resetTenantStores(): void {
  invalidateSwrCache();
  resetCoinStore();
  resetCompanyStore();
  resetTaskStore();
  resetSqliteDb();
}

export function TenantProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [role, setRoleState] = useState<UserRole | null>(
    typeof window !== "undefined" && getCurrentUser().id ? getActiveRole() : null
  );

  const sync = useCallback(() => {
    setTenantId(getActiveTenantId());
    // Só aplica o role quando a sessão real já foi reidratada. Antes disso
    // getActiveRole() retorna 'funcionario' (default do módulo) e derrubaria
    // o Super ADM no modo empresa no 1º render.
    if (getCurrentUser().id) setRoleState(getActiveRole());
  }, []);

  useEffect(() => {
    sync();
    window.addEventListener("omnizeus_company_context_change", sync);
    window.addEventListener("omnizeus_role_change", sync);
    window.addEventListener("omnizeus_user_change", sync);
    return () => {
      window.removeEventListener("omnizeus_company_context_change", sync);
      window.removeEventListener("omnizeus_role_change", sync);
      window.removeEventListener("omnizeus_user_change", sync);
    };
  }, [sync]);

  const enterTenant = useCallback((companyId: string) => {
    const companies = getCompanies();
    const comp = companies.find(c => c.id === companyId);
    setActiveCompanyContext(companyId, comp?.tradeName || comp?.corporateName || companyId);
    resetTenantStores();
    router.push("/dashboard");
  }, [router]);

  const exitTenant = useCallback(() => {
    setActiveCompanyContext(null);
    resetTenantStores();
    // Super ADM volta ao Dashboard Master SaaS (centro de controle da plataforma)
    router.push("/dashboard-master");
  }, [router]);

  const user = getCurrentUser();
  const isSuperAdmin = role === "super_adm" || user.email === "jsgleisson@gmail.com";

  const companies = getCompanies();
  const activeCompany = tenantId ? (companies.find(c => c.id === tenantId) || null) : null;

  // Deriva o modo dos states reais (nunca do role default do módulo, que vale
  // 'funcionario' antes da reidratação da sessão — isso causava um redirect
  // incorreto para o modo empresa no 1º render do Super ADM).
  const isTenantMode = role === null
    ? false
    : role === "super_adm"
      ? tenantId !== null
      : true;
  const isSaaSMode = !isTenantMode;

  return (
    <TenantContext.Provider
      value={{
        tenantId,
        activeCompany,
        isSaaSMode,
        isTenantMode,
        canSwitchCompany: isSuperAdmin,
        enterTenant,
        exitTenant,
        refresh: sync
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant(): TenantContextValue {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error("useTenant must be used within a TenantProvider");
  return ctx;
}
