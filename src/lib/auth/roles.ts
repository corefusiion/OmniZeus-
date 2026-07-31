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

export const PRODUCTION_USERS: (UserProfile & { passwordHash: string })[] = [
  {
    id: 'usr_super',
    name: 'Gleisson (Master Admin)',
    email: 'jsgleisson@gmail.com',
    passwordHash: 'Design20',
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
    const res = await fetch('/api/auth/me');
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

export function loginUser(emailInput: string, passwordInput: string): { success: boolean; user?: UserProfile; error?: string } {
  const cleanEmail = emailInput.trim().toLowerCase();
  const cleanPass = passwordInput.trim();

  // 1. Check hardcoded production users (master admin + any fixed accounts)
  const found = PRODUCTION_USERS.find(
    u => u.email.toLowerCase() === cleanEmail && u.passwordHash === cleanPass
  );

  if (found) {
    const userProfile: UserProfile = {
      id: found.id,
      name: found.name,
      email: found.email,
      role: found.role,
      companyId: found.companyId,
      companyName: found.companyName
    };

    activeUserSession = userProfile;
    activeTenantContextId = userProfile.companyId;

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('omnizeus_role_change'));
      window.dispatchEvent(new Event('omnizeus_user_change'));
      window.dispatchEvent(new Event('omnizeus_company_context_change'));
    }
    return { success: true, user: userProfile };
  }

  // 2. Check dynamically created employees in localStorage/DB cache
  // Employees created via super-adm have their password stored as 'passwordHash' field
  try {
    const { getEmployees } = require('../company/store');
    const allEmployees = getEmployees() as Array<any>;
    const emp = allEmployees.find(
      (e: any) => (e.email || '').toLowerCase() === cleanEmail && (e.passwordHash || e.password || '123') === cleanPass
    );

    if (emp) {
      const userProfile: UserProfile = {
        id: emp.id,
        name: emp.name,
        email: emp.email,
        role: emp.role as UserRole,
        companyId: emp.companyId,
        companyName: emp.companyName || emp.companyId
      };

      activeUserSession = userProfile;
      activeTenantContextId = userProfile.companyId;

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('omnizeus_role_change'));
        window.dispatchEvent(new Event('omnizeus_user_change'));
        window.dispatchEvent(new Event('omnizeus_company_context_change'));
      }
      return { success: true, user: userProfile };
    }
  } catch (_e) {}

  return { success: false, error: 'E-mail ou senha incorretos. Verifique suas credenciais.' };
}

export function logoutUser(): void {
  activeUserSession = {
    id: PRODUCTION_USERS[0].id,
    name: PRODUCTION_USERS[0].name,
    email: PRODUCTION_USERS[0].email,
    role: PRODUCTION_USERS[0].role,
    companyId: PRODUCTION_USERS[0].companyId,
    companyName: PRODUCTION_USERS[0].companyName
  };
  activeTenantContextId = PRODUCTION_USERS[0].companyId;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('omnizeus_user_change'));
    window.location.href = '/login';
  }
}
