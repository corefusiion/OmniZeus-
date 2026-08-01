export type UserRole = 'super_adm' | 'gestor' | 'funcionario';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  companyId: string;
  companyName: string;
  avatarUrl?: string;
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
let activeTenantContextId: string = typeof window !== 'undefined'
  ? (localStorage.getItem('omnizeus_active_company_id') || 'global')
  : 'global';

export function getCurrentUser(): UserProfile {
  return activeUserSession;
}

export function getActiveRole(): UserRole {
  return activeUserSession.role;
}

export function getActiveCompanyId(): string {
  if (activeUserSession.role === 'super_adm') {
    return activeTenantContextId || 'global';
  }
  return activeUserSession.companyId || '';
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

export function setActiveCompanyContext(companyId: string, companyName?: string): void {
  // Only Super Admin can change company context
  if (activeUserSession.role !== 'super_adm') return;

  activeTenantContextId = companyId;
  if (typeof window !== 'undefined') {
    localStorage.setItem('omnizeus_active_company_id', companyId);
    if (companyName) {
      localStorage.setItem('omnizeus_active_company_name', companyName);
    }
  }
  if (companyName) {
    activeUserSession.companyName = companyName;
  } else if (companyId === 'global') {
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
  activeTenantContextId = userProfile.companyId;
  if (typeof window !== 'undefined') {
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
