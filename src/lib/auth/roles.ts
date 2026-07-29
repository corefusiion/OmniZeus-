export type UserRole = 'super_adm' | 'gestor' | 'funcionario';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl?: string;
  companyName: string;
}

export const PRODUCTION_USERS = [
  {
    id: 'usr_super',
    name: 'Gleisson (Super ADM)',
    email: 'jsgleisson@gmail.com',
    passwordHash: 'Design20',
    role: 'super_adm' as UserRole,
    companyName: 'OmniZeus Master SaaS'
  },
  {
    id: 'usr_gestor',
    name: 'Carlos Mendes (Gestor Master)',
    email: 'gestor@gmail.com',
    passwordHash: '123',
    role: 'gestor' as UserRole,
    companyName: 'Zenitus Inteligência Contábil'
  },
  {
    id: 'usr_demo',
    name: 'Operador Demo (Funcionário)',
    email: 'demo@gmail.com',
    passwordHash: '123',
    role: 'funcionario' as UserRole,
    companyName: 'Zenitus Inteligência Contábil'
  }
];

export const ROLE_LABELS: Record<UserRole, { label: string; badgeClass: string }> = {
  super_adm: { label: 'Super ADM Master', badgeClass: 'bg-purple-100 text-purple-700 border-purple-200' },
  gestor: { label: 'Gestor de Escritório', badgeClass: 'bg-blue-100 text-blue-700 border-blue-200' },
  funcionario: { label: 'Funcionário Operacional', badgeClass: 'bg-slate-100 text-slate-700 border-slate-200' },
};

let activeUserSession: UserProfile = {
  id: PRODUCTION_USERS[0].id,
  name: PRODUCTION_USERS[0].name,
  email: PRODUCTION_USERS[0].email,
  role: PRODUCTION_USERS[0].role,
  companyName: PRODUCTION_USERS[0].companyName
};

export function getCurrentUser(): UserProfile {
  return activeUserSession;
}

export function getActiveRole(): UserRole {
  return activeUserSession.role;
}

export function setCurrentUser(userProfile: UserProfile): void {
  activeUserSession = userProfile;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('omnizeus_role_change'));
    window.dispatchEvent(new Event('omnizeus_user_change'));
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
    companyName: found.companyName
  };

  activeUserSession = userProfile;

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('omnizeus_role_change'));
    window.dispatchEvent(new Event('omnizeus_user_change'));
  }

  return { success: true, user: userProfile };
}

export function logoutUser(): void {
  activeUserSession = {
    id: PRODUCTION_USERS[0].id,
    name: PRODUCTION_USERS[0].name,
    email: PRODUCTION_USERS[0].email,
    role: PRODUCTION_USERS[0].role,
    companyName: PRODUCTION_USERS[0].companyName
  };
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('omnizeus_user_change'));
    window.location.href = '/login';
  }
}

