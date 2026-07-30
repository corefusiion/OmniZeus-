import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

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
    title: string;
    client: string;
    assignee: string;
    priority: string;
    status: string;
    time_spent_sec: number;
    gemini_suggestion?: string;
    created_at: string;
    company_id?: string;
    started_at?: string | null;
    completed_at?: string | null;
    duration_sec?: number | null;
    execution_report?: string | null;
    updated_at?: string;
  }[];
  payables: {
    id: string;
    description: string;
    vendor: string;
    value_brl: number;
    due_date: string;
    status: string;
    desc?: string;
    fornecedor?: string;
    valor?: number;
    vencimento?: string;
    company_id?: string;
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
  contaazul_config: {
    client_id?: string;
    client_secret?: string;
    access_token?: string;
    refresh_token?: string;
    is_connected?: boolean;
    updated_at?: string;
  };
  contaazul_clients: any[];
  contaazul_suppliers: any[];
  contaazul_entries: any[];
  custom_job_roles: string[];
  dashboard_metrics: any[];
  ai_stress_test_logs: any[];
  ai_usage_metrics: any[];
  audit_logs: any[];
  contaazul_categories: any[];
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
  companies: [
    {
      id: "comp_zenitus",
      corporate_name: "Zenitus Inteligência Contábil Ltda",
      cnpj: "42.189.902/0001-55",
      city: "Salvador",
      state: "BA",
      plan: "Business",
      coins_franchise: 50000,
      monthly_revenue_brl: 184500.00,
      status: "Ativo",
      created_at: new Date().toISOString()
    },
    {
      id: "comp_alpha",
      corporate_name: "Alpha BPO Financeiro Ltda",
      cnpj: "18.420.910/0001-88",
      city: "São Paulo",
      state: "SP",
      plan: "Premium",
      coins_franchise: 15000,
      monthly_revenue_brl: 92400.00,
      status: "Ativo",
      created_at: new Date().toISOString()
    },
    {
      id: "comp_beta",
      corporate_name: "Beta Tax Consultoria Tributária Ltda",
      cnpj: "33.918.402/0001-12",
      city: "Curitiba",
      state: "PR",
      plan: "Profissional",
      coins_franchise: 5000,
      monthly_revenue_brl: 48000.00,
      status: "Ativo",
      created_at: new Date().toISOString()
    }
  ],
  employees: [
    {
      id: "emp_1",
      company_id: "comp_zenitus",
      name: "Carlos Mendes",
      email: "carlos@zenitus.com.br",
      department: "Diretoria Contábil & Master",
      role: "gestor",
      allowed_modules: ["omni-ia", "financeiro", "contaazul", "whatsapp-bot", "tarefas", "documentos", "apresentacoes"],
      status: "Ativo",
      created_at: new Date().toISOString()
    },
    {
      id: "emp_alpha_1",
      company_id: "comp_alpha",
      name: "Roberto Santos",
      email: "roberto@alphabpo.com.br",
      department: "Gerência Operacional",
      role: "gestor",
      allowed_modules: ["omni-ia", "financeiro", "tarefas", "documentos"],
      status: "Ativo",
      created_at: new Date().toISOString()
    },
    {
      id: "emp_beta_1",
      company_id: "comp_beta",
      name: "Fernanda Lima",
      email: "fernanda@betatax.com.br",
      department: "Consultoria Tributária",
      role: "gestor",
      allowed_modules: ["omni-ia", "tarefas", "apresentacoes"],
      status: "Ativo",
      created_at: new Date().toISOString()
    }
  ],
  purchase_requests: [],
  contracts: [],
  tasks: [],
  payables: [],
  conversations: [],
  messages: [],
  contaazul_customers: [],
  custom_agents: [],
  contaazul_config: {
    client_id: "",
    client_secret: "",
    access_token: "",
    refresh_token: "",
    is_connected: false,
    updated_at: new Date().toISOString()
  },
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
    const raw = fs.readFileSync(DB_FILE_PATH, "utf-8");
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

export async function GET(req: NextRequest) {
  const db = getLocalDbFile();
  const url = new URL(req.url);
  const table = url.searchParams.get("table");

  if (table) {
    const val = (db as any)[table];
    return NextResponse.json({ data: val !== undefined ? val : [] });
  }

  return NextResponse.json({ data: db });
}

export async function POST(req: NextRequest) {
  try {
    const { action, table, record, settings, contaazul_config } = await req.json();
    const db = getLocalDbFile();

    if (action === "update_settings" && settings) {
      db.settings = {
        ...db.settings,
        ...settings,
        updated_at: new Date().toISOString()
      };
      saveLocalDbFile(db);
      return NextResponse.json({ success: true, settings: db.settings });
    }

    if (action === "update_contaazul_config" && contaazul_config) {
      db.contaazul_config = {
        ...db.contaazul_config,
        ...contaazul_config,
        updated_at: new Date().toISOString()
      };
      saveLocalDbFile(db);
      return NextResponse.json({ success: true, contaazul_config: db.contaazul_config });
    }

    if (action === "set_table" && table && record !== undefined) {
      (db as any)[table] = record;
      saveLocalDbFile(db);
      return NextResponse.json({ success: true, record });
    }

    if (action === "insert" && table && record) {
      if (!Array.isArray((db as any)[table])) {
        (db as any)[table] = [];
      }
      (db as any)[table].unshift(record);
      saveLocalDbFile(db);
      return NextResponse.json({ success: true, record });
    }

    if (action === "update" && table && record && record.id) {
      const list = (db as any)[table];
      if (Array.isArray(list)) {
        (db as any)[table] = list.map((item: any) => item.id === record.id ? { ...item, ...record } : item);
      }
      saveLocalDbFile(db);
      return NextResponse.json({ success: true, record });
    }

    if (action === "delete" && table && record && record.id) {
      const list = (db as any)[table];
      if (Array.isArray(list)) {
        (db as any)[table] = list.filter((item: any) => item.id !== record.id);
      }
      saveLocalDbFile(db);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action or parameters" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Database error" }, { status: 500 });
  }
}
