import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getSession } from "@/lib/auth/session";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE_PATH = path.join(DATA_DIR, "omnizeus_local_sql_database.json");

export interface DatabaseSchema {
  settings: {
    id: string;
    openrouter_api_key: string;
    lobehub_url: string;
    lobehub_api_key: string;
    lobehub_model: string;
    evolution_url: string;
    evolution_api_key: string;
    stripe_pub_key: string;
    stripe_secret_key: string;
    stripe_webhook_secret?: string;
    custom_ai_enabled?: boolean;
    custom_ai_url?: string;
    custom_ai_key?: string;
    custom_ai_model?: string;
    coins_balance?: number;
    custom_job_roles?: string[];
    updated_at: string;
  };
  companies: {
    id: string;
    corporate_name: string;
    cnpj: string;
    city: string;
    state: string;
    plan: string;
    coins_franchise: number;
    monthly_revenue_brl: number;
    status: string;
    created_at: string;
    tradeName?: string;
    activeClientsCount?: number;
    company_context?: string;
    ai_notes?: string;
  }[];
  employees: {
    id: string;
    company_id: string;
    name: string;
    email: string;
    department: string;
    role: string;
    allowed_modules: string[];
    status: string;
    created_at: string;
  }[];

  purchase_requests: {
    id: string;
    company_id?: string;
    req_number: string;
    requester_name: string;
    department: string;
    type: string;
    description: string;
    value_brl: number;
    coins_amount?: number;
    status: string;
    created_at: string;
    approved_by?: string;
    manager_observation?: string;
    requester_role?: string;
    approved_at?: string;
  }[];
  contracts: {
    id: string;
    company_id?: string;
    contract_number: string;
    client_name: string;
    cnpj: string;
    monthly_fee_brl: number;
    adjustment_index: string;
    last_adjustment_date: string;
    next_adjustment_date: string;
    cost_center: string;
    allocated_hours_month: number;
    hourly_rate_brl: number;
    status: string;
    created_at: string;
    start_date?: string;
    end_date?: string;
    entries_limit?: number;
  }[];
  tasks: {
    id: string;
    company_id?: string;
    title: string;
    client: string;
    assignee: string;
    priority: string;
    status: string;
    time_spent_sec: number;
    gemini_suggestion?: string;
    created_at: string;
    started_at?: string | null;
    completed_at?: string | null;
    duration_sec?: number | null;
    execution_report?: string | null;
    updated_at?: string;
  }[];
  payables: {
    id: string;
    company_id?: string;
    description: string;
    vendor: string;
    value_brl: number;
    due_date: string;
    status: string;
    desc?: string;
    fornecedor?: string;
    valor?: number;
    vencimento?: string;
    vendor_cnpj?: string | null;
    category?: string;
    cost_center?: string;
    paid_at?: string | null;
    paid_by_user?: string | null;
    payment_method?: string | null;
    notes?: string | null;
    created_at?: string;
    updated_at?: string;
  }[];
  conversations: any[];
  messages: any[];
  contaazul_customers: any[];
  custom_agents: {
    id: string;
    company_id?: string;
    label: string;
    category: string;
    systemPrompt?: string;
    system_prompt?: string;
    color: string;
    isCustom?: boolean;
    is_custom?: boolean;
    createdAt?: string;
    created_at?: string;
  }[];
  contaazul_config: any;
  contaazul_clients: any[];
  contaazul_suppliers: any[];
  contaazul_entries: any[];
  custom_job_roles: string[];
  dashboard_metrics: any[];
  ai_stress_test_logs: any[];
  ai_usage_metrics: any[];
  ai_usage_logs: any[];
  audit_logs?: any[];
  contaazul_categories: any[];
  purchase_orders?: any[];
}

const DEFAULT_DB: DatabaseSchema = {
  settings: {
    id: "master_config",
    openrouter_api_key: "",
    lobehub_url: "https://lobe.ai/api/v1",
    lobehub_api_key: "sk-lobe-ai-master-998811",
    lobehub_model: "lobe-gpt-4o-mini",
    evolution_url: "https://api.whatsapp.zenitus.com.br",
    evolution_api_key: "evo_key_master_998877",
    stripe_pub_key: "pk_live_51M********************************",
    stripe_secret_key: "sk_live_51M********************************",
    custom_ai_enabled: true,
    custom_ai_url: "http://localhost:20128/v1",
    custom_ai_key: "sk-641103a4808c7841-1424a6-87f45f0d",
    custom_ai_model: "kimicode",
    coins_balance: 14250,
    custom_job_roles: [
      "Gestor de Escritório",
      "Analista Fiscal Sênior",
      "Analista Contábil Pleno",
      "Assistente de BPO Financeiro"
    ],
    updated_at: new Date().toISOString()
  },
  companies: [],
  employees: [],
  purchase_orders: [],

  purchase_requests: [],
  contracts: [],
  tasks: [],
  payables: [],
  conversations: [],
  messages: [],
  contaazul_customers: [],
  custom_agents: [],
  contaazul_config: [{
    company_id: "comp_zenitus",
    client_id: "",
    client_secret: "",
    access_token: "",
    refresh_token: "",
    is_connected: false,
    updated_at: new Date().toISOString()
  }],
  contaazul_clients: [],
  contaazul_suppliers: [],
  contaazul_entries: [],
  custom_job_roles: [
    "Gestor de Escritório",
    "Analista Fiscal Sênior",
    "Analista Contábil Pleno",
    "Assistente de BPO Financeiro"
  ],
  dashboard_metrics: [],
  ai_stress_test_logs: [],
  ai_usage_metrics: [],
  ai_usage_logs: [],
  contaazul_categories: []
};

function getLocalDbFile(): DatabaseSchema {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DB_FILE_PATH)) {
      fs.writeFileSync(DB_FILE_PATH, JSON.stringify(DEFAULT_DB, null, 2), "utf-8");
      return DEFAULT_DB;
    }
    let raw = fs.readFileSync(DB_FILE_PATH, "utf-8");
    if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
    const db = JSON.parse(raw);
    
    let modified = false;
    for (const key of Object.keys(DEFAULT_DB) as (keyof DatabaseSchema)[]) {
      if ((db as any)[key] === undefined) {
        (db as any)[key] = (DEFAULT_DB as any)[key];
        modified = true;
      }
    }
    if (modified) {
      saveLocalDbFile(db);
    }
    return db;
  } catch (err) {
    return DEFAULT_DB;
  }
}

function saveLocalDbFile(db: DatabaseSchema): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(db, null, 2), "utf-8");
  } catch (err) {
    console.error("Error saving local SQL database file:", err);
  }
}

// Global tables that are NOT scoped to a single tenant
const GLOBAL_TABLES = ["settings", "companies", "custom_job_roles", "audit_logs", "purchase_orders"];

// Tabelas que só o super_adm pode ler/escrever (contêm credenciais ou dados de toda a plataforma)
const SUPER_ADMIN_ONLY_TABLES = ["settings", "contaazul_config", "purchase_orders", "audit_logs"];

// Campos sensíveis que nunca devem sair na resposta da API
const SENSITIVE_FIELDS = [
  "openrouter_api_key", "stripe_secret_key", "stripe_pub_key", "stripe_webhook_secret",
  "evolution_api_key", "custom_ai_key", "lobehub_api_key",
  "client_secret", "access_token", "refresh_token",
  "password", "passwordHash", "password_hash", "temporary_password", "temporaryPassword"
];

// Apenas as tabelas declaradas no schema podem ser escritas. Isso bloqueia
// prototype pollution (__proto__, constructor) e criação de tabelas arbitrárias.
const WRITABLE_TABLES = new Set(Object.keys(DEFAULT_DB));

function isWritableTable(table: string): boolean {
  return WRITABLE_TABLES.has(table);
}

function maskSecret(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) return "";
  return value.length <= 8 ? "********" : `${value.slice(0, 4)}...${value.slice(-4)}`;
}

// Substitui segredos por versão mascarada, recursivamente
function redact<T>(input: T): T {
  if (Array.isArray(input)) return input.map(item => redact(item)) as unknown as T;
  if (input && typeof input === "object") {
    const out: any = {};
    for (const [key, val] of Object.entries(input as Record<string, unknown>)) {
      if (SENSITIVE_FIELDS.includes(key)) {
        out[key] = val ? maskSecret(val) : val;
      } else {
        out[key] = redact(val);
      }
    }
    return out;
  }
  return input;
}

export async function GET(req: NextRequest) {
  const db = getLocalDbFile();
  const url = new URL(req.url);
  const table = url.searchParams.get("table");

  // Read authenticated session from HttpOnly cookie
  const session = getSession(req);
  if (!session) {
    return NextResponse.json(
      { error: "Acesso negado. Faça login para continuar.", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  const isSuperAdmin = session.role === "super_adm";
  const requestedCompanyId = url.searchParams.get("company_id") || url.searchParams.get("companyId") || req.headers.get("x-company-id");

  // Strict tenant security check for non-Super Admin users
  if (!isSuperAdmin && requestedCompanyId && requestedCompanyId !== "global" && requestedCompanyId !== session.companyId) {
    return NextResponse.json(
      { error: "Acesso negado. Você não possui permissão para consultar dados de outra empresa.", code: "FORBIDDEN" },
      { status: 403 }
    );
  }

  // Dump do banco inteiro nunca é permitido — vazaria dados de todos os tenants
  if (!table) {
    return NextResponse.json(
      { error: "Parâmetro 'table' é obrigatório.", code: "TABLE_REQUIRED" },
      { status: 400 }
    );
  }

  // Impede leitura de propriedades herdadas (__proto__, constructor, toString...)
  if (!Object.prototype.hasOwnProperty.call(db, table) && table !== "payables_list") {
    return NextResponse.json({ data: [] });
  }

  if (SUPER_ADMIN_ONLY_TABLES.includes(table) && !isSuperAdmin) {
    return NextResponse.json(
      { error: "Acesso negado. Recurso restrito ao administrador da plataforma.", code: "FORBIDDEN" },
      { status: 403 }
    );
  }

  const effectiveCompanyId = isSuperAdmin
    ? (requestedCompanyId || "global")
    : session.companyId;

  {
    let val = (db as any)[table];

    // Payables alias fallback
    if (val === undefined && table === "payables_list") {
      val = (db as any)["omnizeus_payables_list"] || (db as any)["payables"] || [];
    }

    // Special scoping for companies table: Non-super_adm only sees their assigned company
    if (table === "companies" && Array.isArray(val) && !isSuperAdmin) {
      const myCompany = val.filter((c: any) => c.id === session.companyId);
      return NextResponse.json({ data: redact(myCompany) });
    }

    if (Array.isArray(val) && !GLOBAL_TABLES.includes(table)) {
      if (isSuperAdmin && (effectiveCompanyId === "global" || !effectiveCompanyId)) {
        return NextResponse.json({ data: redact(val) });
      }

      // Filter strictly by company_id when a specific company is selected.
      // Registros sem company_id são omitidos: sem dono definido, não pertencem a este tenant.
      const filtered = val.filter((item: any) => {
        const itemCompany = item.company_id || item.companyId;
        return itemCompany === effectiveCompanyId;
      });
      return NextResponse.json({ data: redact(filtered) });
    }

    return NextResponse.json({ data: redact(val !== undefined ? val : []) });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { action, table, record, settings, contaazul_config } = await req.json();
    const db = getLocalDbFile();

    const session = getSession(req);
    if (!session) {
      return NextResponse.json(
        { error: "Acesso negado. Faça login para continuar.", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const isSuperAdmin = session.role === "super_adm";
    const canManageEmployees = session.role === "super_adm" || session.role === "gestor";
    const requestedCompanyId = req.headers.get("x-company-id");

    // Non-Super Admins cannot override tenant context
    if (!isSuperAdmin && requestedCompanyId && requestedCompanyId !== session.companyId) {
      return NextResponse.json(
        { error: "Acesso negado. Operação não permitida para outra empresa.", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    const effectiveCompanyId = isSuperAdmin
      ? (requestedCompanyId || session.companyId)
      : session.companyId;

    if (action === "update_settings" && settings) {
      if (!isSuperAdmin) {
        return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
      }
      db.settings = {
        ...db.settings,
        ...settings,
        updated_at: new Date().toISOString()
      };
      saveLocalDbFile(db);
      return NextResponse.json({ success: true, settings: db.settings });
    }

    if (action === "update_contaazul_config" && contaazul_config) {
      if (!isSuperAdmin) {
        return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
      }

      // Garantir formato ARRAY (legado gravava como objeto plano — incompatível com auto-sync multi-tenant)
      if (!Array.isArray(db.contaazul_config)) {
        const existing = db.contaazul_config || {};
        if (existing.access_token || existing.client_id) {
          db.contaazul_config = [{ ...existing, company_id: existing.company_id || effectiveCompanyId }];
        } else {
          db.contaazul_config = [];
        }
      }

      // Upsert: atualiza a entrada da empresa específica ou cria nova
      const compId = contaazul_config.company_id || effectiveCompanyId;
      const cfgIdx = db.contaazul_config.findIndex((c: any) => c.company_id === compId);

      const merged = {
        ...(cfgIdx !== -1 ? db.contaazul_config[cfgIdx] : {}),
        ...contaazul_config,
        company_id: compId,
        updated_at: new Date().toISOString()
      };

      if (cfgIdx !== -1) {
        db.contaazul_config[cfgIdx] = merged;
      } else {
        db.contaazul_config.push(merged);
      }

      saveLocalDbFile(db);
      return NextResponse.json({ success: true, contaazul_config: merged });
    }

    if (action === "set_table" && table && record !== undefined) {
      if (!isSuperAdmin) {
        return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
      }
      if (!isWritableTable(table)) {
        return NextResponse.json({ error: "Tabela inválida." }, { status: 400 });
      }
      (db as any)[table] = record;
      saveLocalDbFile(db);
      return NextResponse.json({ success: true, record });
    }

    if (action === "insert" && table && record) {
      if (!isWritableTable(table)) {
        return NextResponse.json({ error: "Tabela inválida." }, { status: 400 });
      }
      if (SUPER_ADMIN_ONLY_TABLES.includes(table) && !isSuperAdmin) {
        return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
      }
      // Só o super_adm cria registros em tabelas globais (ex.: empresas da plataforma)
      if (GLOBAL_TABLES.includes(table) && !isSuperAdmin) {
        return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
      }
      if (table === "employees" && !canManageEmployees) {
        return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
      }
      if (!Array.isArray((db as any)[table])) {
        (db as any)[table] = [];
      }
      // Ensure company_id is attached to inserted records
      if (!GLOBAL_TABLES.includes(table)) {
        record.company_id = effectiveCompanyId;
        delete record.companyId;
      }
      if (table === "employees" && !isSuperAdmin && record.role === "super_adm") {
        return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
      }

      (db as any)[table].unshift(record);
      saveLocalDbFile(db);
      return NextResponse.json({ success: true, record });
    }

    if (action === "update" && table && record && record.id) {
      if (!isWritableTable(table)) {
        return NextResponse.json({ error: "Tabela inválida." }, { status: 400 });
      }
      if (SUPER_ADMIN_ONLY_TABLES.includes(table) && !isSuperAdmin) {
        return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
      }
      if (table === "employees" && !canManageEmployees) {
        return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
      }
      const list = (db as any)[table];
      if (Array.isArray(list)) {
        let denied = false;
        (db as any)[table] = list.map((item: any) => {
          if (item.id !== record.id) return item;

          // Registro de outro tenant, ou sem dono definido, não pode ser tocado
          if (!isSuperAdmin && !GLOBAL_TABLES.includes(table)) {
            const owner = item.company_id || item.companyId;
            if (owner !== effectiveCompanyId) {
              denied = true;
              return item;
            }
          }

          const merged = { ...item, ...record };
          if (!isSuperAdmin) {
            // Impede troca de dono e escalonamento de privilégio
            merged.company_id = item.company_id;
            merged.companyId = item.companyId;
            if (table === "employees" && record.role === "super_adm") {
              merged.role = item.role;
            }
            // Senha só muda pelas rotas dedicadas de autenticação
            merged.password = item.password;
            merged.passwordHash = item.passwordHash;
            merged.password_hash = item.password_hash;
          }
          return merged;
        });
        if (denied) {
          return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
        }
      }
      saveLocalDbFile(db);
      return NextResponse.json({ success: true, record });
    }

    if (action === "delete" && table && record && record.id) {
      if (!isWritableTable(table)) {
        return NextResponse.json({ error: "Tabela inválida." }, { status: 400 });
      }
      if (SUPER_ADMIN_ONLY_TABLES.includes(table) && !isSuperAdmin) {
        return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
      }
      if (GLOBAL_TABLES.includes(table) && !isSuperAdmin) {
        return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
      }
      if (table === "employees" && !canManageEmployees) {
        return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
      }
      const list = (db as any)[table];
      if (Array.isArray(list)) {
        let denied = false;
        (db as any)[table] = list.filter((item: any) => {
          if (item.id !== record.id) return true;
          if (!isSuperAdmin) {
            const owner = item.company_id || item.companyId;
            if (owner !== effectiveCompanyId) {
              denied = true;
              return true; // Mantém o registro
            }
          }
          return false; // Remove
        });
        if (denied) {
          return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
        }
      }
      saveLocalDbFile(db);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action or parameters" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Database error" }, { status: 500 });
  }
}
