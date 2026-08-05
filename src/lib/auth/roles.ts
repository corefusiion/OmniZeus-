export type UserRole = 'super_adm' | 'gestor' | 'funcionario';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  companyId: string;
  companyName: string;
  avatarUrl?: string;
  allowedModules?: string[];
}

export const PRODUCTION_USERS: UserProfile[] = [
  {
    id: 'usr_super',
    name: 'Gleisson (Master Admin)',
    email: 'jsgleisson@gmail.com',
    role: 'super_adm',
    companyId: 'global',
    companyName: 'Visão Global SaaS Master'
  }
];

export const ROLE_LABELS: Record<UserRole, { label: string; badgeClass: string }> = {
  super_adm: { label: 'Super ADM Master', badgeClass: 'bg-purple-100 text-purple-700 border-purple-200' },
  gestor: { label: 'Gestor de Escritório', badgeClass: 'bg-blue-100 text-primary border-primary/20' },
  funcionario: { label: 'Funcionário Operacional', badgeClass: 'bg-slate-100 text-slate-700 border-slate-200' },
};

let activeUserSession: UserProfile = {
  id: '',
  name: '',
  email: '',
  role: 'funcionario',
  companyId: '',
  companyName: ''
};

// Master Admin Active Tenant Context Switcher
// null = modo SaaS (Super ADM no centro de controle da plataforma)
// string = tenant ativo (Super ADM "entrou" na empresa / Tenant sempre na sua empresa)
let activeTenantContextId: string | null = typeof localStorage !== 'undefined'
  ? (localStorage.getItem('omnizeus_active_company_id') || null)
  : null;

export function getCurrentUser(): UserProfile {
  return activeUserSession;
}

export function getActiveRole(): UserRole {
  return activeUserSession.role;
}

export function getAllowedModules(): string[] {
  return activeUserSession.allowedModules || [];
}

export function getActiveCompanyId(): string {
  if (activeUserSession.role === 'super_adm') {
    return activeTenantContextId || 'global';
  }
  return activeUserSession.companyId || '';
}

/**
 * Contexto oficial do tenant ativo.
 * - super_adm: null = modo SaaS (plataforma), string = empresa "entrada".
 * - gestor/funcionario: sempre sua própria empresa.
 */
export function getActiveTenantId(): string | null {
  if (activeUserSession.role === 'super_adm') {
    if (!activeTenantContextId || activeTenantContextId === 'global') return null;
    return activeTenantContextId;
  }
  return activeUserSession.companyId || null;
}

export function isInTenantMode(): boolean {
  if (activeUserSession.role === 'super_adm') {
    return activeTenantContextId !== null && activeTenantContextId !== 'global';
  }
  return true;
}

export async function rehydrateSession(): Promise<UserProfile | null> {
  if (typeof window === 'undefined') return null;
  try {
    const res = await fetch('/api/auth/me', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.user) {
        setCurrentUser(data.user);
        return data.user;
      }
    }
  } catch (err) {
    console.error('Falha ao reidratar sessão:', err);
  }
  return null;
}

export function setActiveCompanyContext(companyId: string | null, companyName?: string): void {
  // Only Super Admin can change company context
  if (activeUserSession.role !== 'super_adm') return;

  activeTenantContextId = companyId;
  if (typeof window !== 'undefined') {
    if (companyId && companyId !== 'global') {
      localStorage.setItem('omnizeus_active_company_id', companyId);
      if (companyName) {
        localStorage.setItem('omnizeus_active_company_name', companyName);
      }
    } else {
      // Sair da empresa = voltar ao modo SaaS
      localStorage.removeItem('omnizeus_active_company_id');
      localStorage.removeItem('omnizeus_active_company_name');
    }
  }
  if (companyName) {
    activeUserSession.companyName = companyName;
  } else if (!companyId || companyId === 'global') {
    activeUserSession.companyName = 'Visão Global SaaS Master';
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('omnizeus_company_context_change'));
    window.dispatchEvent(new Event('omnizeus_user_change'));
    window.dispatchEvent(new Event('omnizeus_coins_change'));
    window.dispatchEvent(new Event('omnizeus_sql_db_change'));
  }
}

export function setCurrentUser(userProfile: UserProfile): void {
  activeUserSession = userProfile;

  // Normaliza o contexto do Super ADM:
  // - Sessão diz "global" (super_adm na plataforma): preserva o tenant ativo em
  //   localStorage (se o usuário estava dentro de uma empresa), para que um F5
  //   não o expulse da empresa. Se não houver tenant persistido, fica em SaaS.
  // - Sessão diz uma empresa concreta: usa essa empresa.
  // Jamais deixar "global" como tenant ativo — isso causaria vazamento de dados consolidados.
  let effectiveCompanyId: string | null;
  if (userProfile.role === 'super_adm') {
    if (userProfile.companyId && userProfile.companyId !== 'global') {
      effectiveCompanyId = userProfile.companyId;
    } else {
      const persisted = typeof window !== 'undefined'
        ? localStorage.getItem('omnizeus_active_company_id')
        : null;
      effectiveCompanyId = persisted && persisted !== 'global' ? persisted : null;
    }
  } else {
    effectiveCompanyId = userProfile.companyId;
  }

  activeTenantContextId = effectiveCompanyId;

  if (typeof window !== 'undefined') {
    if (effectiveCompanyId) {
      localStorage.setItem('omnizeus_active_company_id', effectiveCompanyId);
      if (userProfile.companyName) {
        localStorage.setItem('omnizeus_active_company_name', userProfile.companyName);
      }
    } else {
      localStorage.removeItem('omnizeus_active_company_id');
      localStorage.removeItem('omnizeus_active_company_name');
    }
    window.dispatchEvent(new Event('omnizeus_role_change'));
    window.dispatchEvent(new Event('omnizeus_user_change'));
    window.dispatchEvent(new Event('omnizeus_company_context_change'));
  }
}

export async function logoutUser(): Promise<void> {
  if (typeof window !== 'undefined') {
    try {
      await fetch('/api/auth/login', { method: 'DELETE' });
    } catch (e) {
      console.error("Logout falhou", e);
    }
    
    localStorage.removeItem('omnizeus_active_company_id');
    localStorage.removeItem('omnizeus_active_company_name');
    
    activeUserSession = {
      id: '',
      name: '',
      email: '',
      role: 'funcionario',
      companyId: '',
      companyName: ''
    };
    activeTenantContextId = 'global';
    
    window.dispatchEvent(new Event('omnizeus_user_change'));
    window.location.href = '/login';
  }
}
