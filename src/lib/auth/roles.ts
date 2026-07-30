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
    companyId: 'comp_zenitus',
    companyName: 'Zenitus Inteligência Contábil'
  },
  {
    id: 'usr_gestor',
    name: 'Carlos Mendes (Gestor Master)',
    email: 'gestor@gmail.com',
    passwordHash: '123',
    role: 'gestor',
    companyId: 'comp_zenitus',
    companyName: 'Zenitus Inteligência Contábil'
  },
  {
    id: 'usr_gestor_alpha',
    name: 'Roberto Santos (Gestor Alpha)',
    email: 'roberto@alphabpo.com.br',
    passwordHash: '123',
    role: 'gestor',
    companyId: 'comp_alpha',
    companyName: 'Alpha BPO Financeiro'
  },
  {
    id: 'usr_demo',
    name: 'Operador Demo (Funcionário)',
    email: 'demo@gmail.com',
    passwordHash: '123',
    role: 'funcionario',
    companyId: 'comp_zenitus',
    companyName: 'Zenitus Inteligência Contábil'
  }
];

export const ROLE_LABELS: Record<UserRole, { label: string; badgeClass: string }> = {
  super_adm: { label: 'Super ADM Master', badgeClass: 'bg-purple-100 text-purple-700 border-purple-200' },
  gestor: { label: 'Gestor de Escritório', badgeClass: 'bg-blue-100 text-primary border-primary/20' },
  funcionario: { label: 'Funcionário Operacional', badgeClass: 'bg-slate-100 text-slate-700 border-slate-200' },
};

let activeUserSession: UserProfile = {
  id: PRODUCTION_USERS[0].id,
  name: PRODUCTION_USERS[0].name,
  email: PRODUCTION_USERS[0].email,
  role: PRODUCTION_USERS[0].role,
  companyId: PRODUCTION_USERS[0].companyId,
  companyName: PRODUCTION_USERS[0].companyName
};

// Master Admin Active Tenant Context Switcher
let activeTenantContextId: string = 'comp_zenitus';

export function getCurrentUser(): UserProfile {
  return activeUserSession;
}

export function getActiveRole(): UserRole {
  return activeUserSession.role;
}

export function getActiveCompanyId(): string {
  // If Master Admin, return the selected active tenant context ID
  if (activeUserSession.role === 'super_adm') {
    return activeTenantContextId || activeUserSession.companyId || 'comp_zenitus';
  }
  return activeUserSession.companyId || 'comp_zenitus';
}

export function setActiveCompanyContext(companyId: string, companyName?: string): void {
  activeTenantContextId = companyId;
  if (companyName && activeUserSession.role === 'super_adm') {
    activeUserSession.companyName = companyName;
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('omnizeus_company_context_change'));
    window.dispatchEvent(new Event('omnizeus_user_change'));
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

  const found = PRODUCTION_USERS.find(
    u => u.email.toLowerCase() === cleanEmail && u.passwordHash === cleanPass
  );

  if (!found) {
    return { success: false, error: 'E-mail ou senha incorretos. Verifique suas credenciais.' };
  }

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
