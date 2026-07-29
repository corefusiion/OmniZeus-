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
  status: 'Ativo' | 'Inativo';
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

export const INITIAL_COMPANIES: CompanyProfile[] = [
  {
    id: 'comp_zenitus',
    corporateName: 'Zenitus Inteligência Contábil Ltda',
    tradeName: 'Zenitus Contábil',
    cnpj: '42.189.902/0001-55',
    city: 'Salvador',
    state: 'BA',
    plan: 'Premium',
    coinsFranchise: 15000,
    activeClientsCount: 142,
    monthlyRevenueBrl: 184500.00,
    status: 'Ativo',
    createdAt: '2026-01-15T10:00:00.000Z'
  }
];

export const INITIAL_EMPLOYEES: EmployeeUser[] = [
  {
    id: 'emp_1',
    companyId: 'comp_zenitus',
    name: 'Carlos Mendes',
    email: 'carlos@zenitus.com.br',
    department: 'Diretoria Contábil & Master',
    role: 'gestor',
    allowedModules: ['omni-ia', 'financeiro', 'contaazul', 'whatsapp-bot', 'tarefas', 'documentos', 'apresentacoes'],
    status: 'Ativo',
    createdAt: '2026-01-15T10:00:00.000Z'
  }
];

let inMemoryCompanies: CompanyProfile[] = [...INITIAL_COMPANIES];
let inMemoryEmployees: EmployeeUser[] = [...INITIAL_EMPLOYEES];
let companiesFetched = false;
let employeesFetched = false;

export async function fetchCompaniesFromServer(): Promise<CompanyProfile[]> {
  try {
    const records = await fetchServerTable<any>('companies');
    if (records && records.length > 0) {
      inMemoryCompanies = records.map((r: any) => ({
        id: r.id,
        corporateName: r.corporateName || r.corporate_name || '',
        tradeName: r.tradeName || r.trade_name || r.corporate_name || '',
        cnpj: r.cnpj || '',
        city: r.city || '',
        state: r.state || '',
        plan: r.plan || 'Premium',
        coinsFranchise: r.coinsFranchise || r.coins_franchise || 15000,
        activeClientsCount: r.activeClientsCount || r.active_clients_count || 142,
        monthlyRevenueBrl: r.monthlyRevenueBrl || r.monthly_revenue_brl || 0,
        status: r.status || 'Ativo',
        createdAt: r.createdAt || r.created_at || new Date().toISOString()
      }));
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
    if (records && records.length > 0) {
      inMemoryEmployees = records.map((r: any) => ({
        id: r.id,
        companyId: r.companyId || r.company_id || 'comp_zenitus',
        name: r.name || '',
        email: r.email || '',
        department: r.department || '',
        role: r.role || 'funcionario',
        allowedModules: r.allowedModules || r.allowed_modules || [],
        status: r.status || 'Ativo',
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

export function saveCompany(companyData: Omit<CompanyProfile, 'id' | 'createdAt'>): CompanyProfile {
  const newComp: CompanyProfile = {
    ...companyData,
    id: `comp_${Date.now()}`,
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
    created_at: newComp.createdAt
  }).catch(() => {});

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('omnizeus_companies_change'));
  }
  return newComp;
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
    created_at: newEmp.createdAt
  }).catch(() => {});

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('omnizeus_employees_change'));
  }
  return newEmp;
}

export function updateEmployeePermissions(employeeId: string, allowedModules: string[]): void {
  inMemoryEmployees = inMemoryEmployees.map(e => e.id === employeeId ? { ...e, allowedModules } : e);
  
  const target = inMemoryEmployees.find(e => e.id === employeeId);
  if (target) {
    updateServerTableRecord('employees', {
      id: target.id,
      company_id: target.companyId,
      name: target.name,
      email: target.email,
      department: target.department,
      role: target.role,
      allowed_modules: allowedModules,
      status: target.status
    }).catch(() => {});
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('omnizeus_employees_change'));
  }
}

export function deleteEmployee(employeeId: string): void {
  inMemoryEmployees = inMemoryEmployees.filter(e => e.id !== employeeId);
  deleteServerTableRecord('employees', employeeId).catch(() => {});

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('omnizeus_employees_change'));
  }
}

