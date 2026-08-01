import {
  fetchServerTable,
  insertServerTable,
  updateServerTableRecord,
  deleteServerTableRecord
} from "../db/serverDb";

export interface CompanyProfile {
  id: string;
  corporateName: string;
  tradeName: string;
  cnpj: string;
  city: string;
  state: string;
  plan: 'Profissional' | 'Premium' | 'Business';
  coinsFranchise: number;
  activeClientsCount: number;
  monthlyRevenueBrl: number;
  status: 'Ativo' | 'Suspenso';
  subscription_status?: 'active' | 'past_due' | 'unpaid' | 'canceled' | 'incomplete' | 'trialing';
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  subscription_current_period_start?: string;
  subscription_current_period_end?: string;
  grace_period_ends_at?: string;
  suspension_reason?: string;
  companyContext?: string;
  aiNotes?: string;
  openrouterApiKey?: string;
  openrouterKeyMasked?: string;
  openrouterKeyStatus?: 'connected' | 'not_configured' | 'error' | 'master_fallback';
  openrouterKeyTestedAt?: string;
  createdAt: string;
}


export interface EmployeeUser {
  id: string;
  companyId: string;
  name: string;
  email: string;
  department: string;
  role: 'gestor' | 'funcionario';
  allowedModules: string[]; // ['omni-ia', 'financeiro', 'whatsapp-bot', 'tarefas', 'documentos', 'apresentacoes', 'contaazul']
  birthDate?: string;
  status: 'Ativo' | 'Inativo' | 'Convite pendente' | 'Primeiro acesso pendente' | 'Bloqueado';
  mustChangePassword?: boolean;
  passwordHash?: string;
  passwordChangedAt?: string;
  lastLoginAt?: string;
  createdAt: string;
}

export const ALL_SYSTEM_MODULES = [
  { id: 'omni-ia', label: 'Omni IA Hub (15 LLMs)' },
  { id: 'financeiro', label: 'Financeiro & Coins' },
  { id: 'contaazul', label: 'Integração ContaAzul' },
  { id: 'whatsapp-bot', label: 'WhatsApp Bot & Live Chat' },
  { id: 'tarefas', label: 'Tarefas Operacionais (Gemini 2.5)' },
  { id: 'documentos', label: 'Gerador de Documentos A4' },
  { id: 'apresentacoes', label: 'Apresentações Decks' },
];

// No mock companies. Real data comes exclusively from the local DB.
export const INITIAL_COMPANIES: CompanyProfile[] = [];

// No mock employees. Real data comes exclusively from the local DB.
export const INITIAL_EMPLOYEES: EmployeeUser[] = [];

let inMemoryCompanies: CompanyProfile[] = [...INITIAL_COMPANIES];
let inMemoryEmployees: EmployeeUser[] = [...INITIAL_EMPLOYEES];
let companiesFetched = false;
let employeesFetched = false;

// Limpa o cache de empresas/funcionários ao trocar de tenant (impede vazamento entre empresas)
export function resetCompanyStore(): void {
  inMemoryCompanies = [...INITIAL_COMPANIES];
  inMemoryEmployees = [...INITIAL_EMPLOYEES];
  companiesFetched = false;
  employeesFetched = false;
}

export async function fetchCompaniesFromServer(): Promise<CompanyProfile[]> {
  try {
    const records = await fetchServerTable<any>('companies');
    // Always replace inMemory from DB — even if DB returns empty array
    if (Array.isArray(records)) {
      inMemoryCompanies = records.map((r: any) => {
        const planName = r.plan || 'Premium';
        const defaultPlanPrice = planName === 'Business' ? 1990 : planName === 'Premium' ? 890 : 490;
        const rawRev = r.monthlyRevenueBrl || r.monthly_revenue_brl;
        const realRevenue = (rawRev && rawRev <= 5000) ? rawRev : defaultPlanPrice;

        const rawKey = r.openrouterApiKey || r.openrouter_api_key || "";
        const maskedKey = rawKey ? `${rawKey.substring(0, 8)}-••••••••${rawKey.substring(rawKey.length - 4)}` : "";
        const keyStatus = rawKey ? (r.openrouterKeyStatus || r.openrouter_key_status || 'connected') : 'master_fallback';

        // Grace Period Auto-Suspension Evaluation
        let opStatus: 'Ativo' | 'Suspenso' = r.status || 'Ativo';
        const subStatus = r.subscription_status || 'active';
        const graceEnds = r.grace_period_ends_at;

        if (subStatus === 'past_due' && graceEnds) {
          const graceEndMs = new Date(graceEnds).getTime();
          if (!isNaN(graceEndMs) && Date.now() > graceEndMs) {
            opStatus = 'Suspenso';
          }
        } else if (subStatus === 'unpaid' || subStatus === 'canceled') {
          opStatus = 'Suspenso';
        }

        return {
          id: r.id,
          corporateName: r.corporateName || r.corporate_name || '',
          tradeName: r.tradeName || r.trade_name || r.corporate_name || '',
          cnpj: r.cnpj || '',
          city: r.city || '',
          state: r.state || '',
          plan: planName,
          coinsFranchise: r.coinsFranchise || r.coins_franchise || (planName === 'Business' ? 50000 : planName === 'Premium' ? 15000 : 5000),
          activeClientsCount: r.activeClientsCount || r.active_clients_count || 1,
          monthlyRevenueBrl: realRevenue,
          status: opStatus,
          subscription_status: subStatus,
          stripe_customer_id: r.stripe_customer_id || r.stripeCustomerId,
          stripe_subscription_id: r.stripe_subscription_id || r.stripeSubscriptionId,
          subscription_current_period_start: r.subscription_current_period_start,
          subscription_current_period_end: r.subscription_current_period_end,
          grace_period_ends_at: r.grace_period_ends_at,
          suspension_reason: r.suspension_reason,
          companyContext: r.companyContext || r.company_context || '',
          aiNotes: r.aiNotes || r.ai_notes || '',
          openrouterApiKey: rawKey,
          openrouterKeyMasked: maskedKey,
          openrouterKeyStatus: keyStatus,
          openrouterKeyTestedAt: r.openrouterKeyTestedAt || r.openrouter_key_tested_at,
          createdAt: r.createdAt || r.created_at || new Date().toISOString()
        };
      });
    }
    companiesFetched = true;
  } catch (err) {
    console.error("Error fetching companies from server:", err);
  }
  return inMemoryCompanies;
}

export async function fetchEmployeesFromServer(): Promise<EmployeeUser[]> {
  try {
    const records = await fetchServerTable<any>('employees');
    if (Array.isArray(records)) {
      inMemoryEmployees = records.map((r: any) => ({
        id: r.id,
        companyId: r.companyId || r.company_id || '',
        name: r.name || '',
        email: r.email || '',
        department: r.department || '',
        role: r.role || 'funcionario',
        allowedModules: r.allowedModules || r.allowed_modules || [],
        birthDate: r.birthDate || r.birth_date,
        status: r.status || 'Ativo',
        mustChangePassword: typeof r.mustChangePassword === 'boolean' ? r.mustChangePassword : (typeof r.must_change_password === 'boolean' ? r.must_change_password : false),
        passwordHash: r.passwordHash || r.password_hash || r.password || '',
        passwordChangedAt: r.passwordChangedAt || r.password_changed_at,
        lastLoginAt: r.lastLoginAt || r.last_login_at,
        createdAt: r.createdAt || r.created_at || new Date().toISOString()
      }));
    }
    employeesFetched = true;
  } catch (err) {
    console.error("Error fetching employees from server:", err);
  }
  return inMemoryEmployees;
}


// Company Operations
export function getCompanies(): CompanyProfile[] {
  if (typeof window !== 'undefined' && !companiesFetched) {
    companiesFetched = true;
    fetchCompaniesFromServer().then(() => {
      window.dispatchEvent(new Event('omnizeus_companies_change'));
    }).catch(() => {});
  }
  return inMemoryCompanies;
}

export function saveCompany(companyData: Partial<CompanyProfile> & Omit<CompanyProfile, 'createdAt'>): CompanyProfile {
  const existingIndex = companyData.id ? inMemoryCompanies.findIndex(c => c.id === companyData.id) : -1;

  if (existingIndex >= 0) {
    const updated: CompanyProfile = {
      ...inMemoryCompanies[existingIndex],
      ...companyData
    };
    inMemoryCompanies[existingIndex] = updated;

    updateServerTableRecord('companies', {
      id: updated.id,
      corporate_name: updated.corporateName,
      tradeName: updated.tradeName,
      cnpj: updated.cnpj,
      city: updated.city,
      state: updated.state,
      plan: updated.plan,
      coins_franchise: updated.coinsFranchise,
      monthly_revenue_brl: updated.monthlyRevenueBrl,
      status: updated.status,
      company_context: updated.companyContext || '',
      ai_notes: updated.aiNotes || ''
    }).catch(() => {});

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('omnizeus_companies_change'));
    }
    return updated;
  } else {
    const newComp: CompanyProfile = {
      id: companyData.id || `comp_${Date.now()}`,
      corporateName: companyData.corporateName || '',
      tradeName: companyData.tradeName || companyData.corporateName || '',
      cnpj: companyData.cnpj || '',
      city: companyData.city || 'São Paulo',
      state: companyData.state || 'SP',
      plan: companyData.plan || 'Premium',
      coinsFranchise: companyData.coinsFranchise || 15000,
      activeClientsCount: companyData.activeClientsCount || 1,
      monthlyRevenueBrl: companyData.monthlyRevenueBrl || (companyData.plan === 'Business' ? 1990 : companyData.plan === 'Premium' ? 890 : 490),
      status: companyData.status || 'Ativo',
      companyContext: companyData.companyContext || '',
      aiNotes: companyData.aiNotes || '',
      createdAt: new Date().toISOString()
    };

    inMemoryCompanies = [newComp, ...inMemoryCompanies];

    insertServerTable('companies', {
      id: newComp.id,
      corporate_name: newComp.corporateName,
      tradeName: newComp.tradeName,
      cnpj: newComp.cnpj,
      city: newComp.city,
      state: newComp.state,
      plan: newComp.plan,
      coins_franchise: newComp.coinsFranchise,
      monthly_revenue_brl: newComp.monthlyRevenueBrl,
      activeClientsCount: newComp.activeClientsCount,
      status: newComp.status,
      company_context: newComp.companyContext || '',
      ai_notes: newComp.aiNotes || '',
      created_at: newComp.createdAt
    }).catch(() => {});


    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('omnizeus_companies_change'));
    }
    return newComp;
  }
}

// Employee Operations
export function getEmployees(companyId?: string): EmployeeUser[] {
  if (typeof window !== 'undefined' && !employeesFetched) {
    employeesFetched = true;
    fetchEmployeesFromServer().then(() => {
      window.dispatchEvent(new Event('omnizeus_employees_change'));
    }).catch(() => {});
  }
  return companyId ? inMemoryEmployees.filter(e => e.companyId === companyId) : inMemoryEmployees;
}

export function saveEmployee(empData: Omit<EmployeeUser, 'id' | 'createdAt'>): EmployeeUser {
  const newEmp: EmployeeUser = {
    ...empData,
    id: `emp_${Date.now()}`,
    createdAt: new Date().toISOString()
  };

  inMemoryEmployees = [newEmp, ...inMemoryEmployees];

  insertServerTable('employees', {
    id: newEmp.id,
    company_id: newEmp.companyId,
    name: newEmp.name,
    email: newEmp.email,
    department: newEmp.department,
    role: newEmp.role,
    allowed_modules: newEmp.allowedModules,
    status: newEmp.status,
    must_change_password: newEmp.mustChangePassword ?? false,
    password_hash: newEmp.passwordHash || '',
    password_changed_at: newEmp.passwordChangedAt || '',
    last_login_at: newEmp.lastLoginAt || '',
    birth_date: newEmp.birthDate || '',
    created_at: newEmp.createdAt
  }, newEmp.companyId).catch(() => {});

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('omnizeus_employees_change'));
  }
  return newEmp;
}

export function updateEmployee(employeeData: Partial<EmployeeUser> & { id: string }): void {
  inMemoryEmployees = inMemoryEmployees.map(e => e.id === employeeData.id ? { ...e, ...employeeData } : e);
  
  const target = inMemoryEmployees.find(e => e.id === employeeData.id);
  if (target) {
    updateServerTableRecord('employees', {
      id: target.id,
      company_id: target.companyId,
      name: target.name,
      email: target.email,
      department: target.department,
      role: target.role,
      allowed_modules: target.allowedModules,
      birth_date: target.birthDate,
      status: target.status,
      must_change_password: target.mustChangePassword,
      password_hash: target.passwordHash,
      password_changed_at: target.passwordChangedAt,
      last_login_at: target.lastLoginAt
    }).catch(() => {});
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('omnizeus_employees_change'));
  }
}


export function updateEmployeePermissions(employeeId: string, allowedModules: string[]): void {
  updateEmployee({ id: employeeId, allowedModules });
}

export function deleteEmployee(employeeId: string): void {
  inMemoryEmployees = inMemoryEmployees.filter(e => e.id !== employeeId);
  deleteServerTableRecord('employees', employeeId).catch(() => {});

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('omnizeus_employees_change'));
  }
}

