// Server-Backed Local SQL Database Client
// Reads and writes directly to server API route /api/db (backed by data/omnizeus_local_sql_database.json)
// Prepares structure for seamless future Supabase PostgreSQL migration

export interface SystemSettings {
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
  grace_period_days?: number;
  openrouter_enabled?: boolean;
  custom_ai_enabled?: boolean;
  custom_ai_url?: string;
  custom_ai_key?: string;
  custom_ai_model?: string;
  super_admin_ai_provider?: 'openrouter_master' | 'custom_endpoint';
  super_admin_auto_fallback?: boolean;
  coins_balance?: number;
  custom_job_roles?: string[];
  platform_operational_costs?: {
    fixed_monthly_cost_per_company: number;
    detailed_costs?: {
      server: number;
      db: number;
      storage: number;
      whatsapp: number;
      email: number;
      monitoring: number;
      support: number;
      other: number;
    };
    allocation_method: 'fixed_per_company' | 'proportional_split';
    updated_at?: string;
  };
  updated_at: string;
}

export async function fetchServerSettings(): Promise<SystemSettings> {
  try {
    const res = await fetch("/api/db?table=settings", { cache: "no-store" });
    if (res.ok) {
      const json = await res.json();
      if (json.data && Object.keys(json.data).length > 0) {
        return json.data;
      }
    }
  } catch (err) {
    console.error("Error fetching settings from local SQL DB:", err);
  }
  return {
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
    updated_at: new Date().toISOString()
  };
}

export async function updateServerSettings(settings: Partial<SystemSettings>): Promise<boolean> {
  try {
    const res = await fetch("/api/db", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update_settings",
        settings
      })
    });
    return res.ok;
  } catch (err) {
    console.error("Error updating settings in local SQL DB:", err);
    return false;
  }
}

function getActiveCompanyIdForRequest(overrideCompId?: string): string {
  if (overrideCompId) return overrideCompId;
  if (typeof localStorage !== "undefined") {
    return localStorage.getItem("omnizeus_active_company_id") || "global";
  }
  return "global";
}

export async function fetchServerTable<T = any>(table: string, companyId?: string): Promise<T[]> {
  try {
    const compId = getActiveCompanyIdForRequest(companyId);
    const res = await fetch(`/api/db?table=${table}&company_id=${encodeURIComponent(compId)}`, { 
      cache: "no-store",
      headers: { "x-company-id": compId }
    });
    if (res.ok) {
      const json = await res.json();
      return Array.isArray(json.data) ? json.data : [];
    }
  } catch (err) {
    console.error(`Error fetching table ${table} from local SQL DB:`, err);
  }
  return [];
}

export async function insertServerTable<T = any>(table: string, record: T, companyId?: string): Promise<boolean> {
  try {
    const compId = getActiveCompanyIdForRequest(companyId);
    const recordWithCompany = {
      ...(record as any),
      company_id: (record as any).company_id || (record as any).companyId || compId
    };
    const res = await fetch("/api/db", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "x-company-id": compId
      },
      body: JSON.stringify({
        action: "insert",
        table,
        record: recordWithCompany
      })
    });
    return res.ok;
  } catch (err) {
    console.error(`Error inserting into ${table} in local SQL DB:`, err);
    return false;
  }
}

export async function updateServerTableRecord<T = any>(table: string, record: T, companyId?: string): Promise<boolean> {
  try {
    const compId = getActiveCompanyIdForRequest(companyId);
    const res = await fetch("/api/db", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "x-company-id": compId
      },
      body: JSON.stringify({
        action: "update",
        table,
        record
      })
    });
    return res.ok;
  } catch (err) {
    console.error(`Error updating record in ${table} in local SQL DB:`, err);
    return false;
  }
}

export async function deleteServerTableRecord(table: string, id: string): Promise<boolean> {
  try {
    const res = await fetch("/api/db", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "delete",
        table,
        record: { id }
      })
    });
    return res.ok;
  } catch (err) {
    console.error(`Error deleting from ${table} in local SQL DB:`, err);
    return false;
  }
}

export async function setServerTable<T = any>(table: string, record: T): Promise<boolean> {
  try {
    const res = await fetch("/api/db", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "set_table",
        table,
        record
      })
    });
    return res.ok;
  } catch (err) {
    console.error(`Error setting table ${table} in local SQL DB:`, err);
    return false;
  }
}

// Strongly-typed table helpers
export async function fetchCompanies() { return fetchServerTable('companies'); }
export async function insertCompany(company: any) { return insertServerTable('companies', company); }
export async function updateCompany(company: any) { return updateServerTableRecord('companies', company); }
export async function deleteCompany(id: string) { return deleteServerTableRecord('companies', id); }

export async function fetchEmployees() { return fetchServerTable('employees'); }
export async function insertEmployee(employee: any) { return insertServerTable('employees', employee); }
export async function updateEmployee(employee: any) { return updateServerTableRecord('employees', employee); }
export async function deleteEmployee(id: string) { return deleteServerTableRecord('employees', id); }

export async function fetchContracts() { return fetchServerTable('contracts'); }
export async function insertContract(contract: any) { return insertServerTable('contracts', contract); }
export async function updateContract(contract: any) { return updateServerTableRecord('contracts', contract); }
export async function deleteContract(id: string) { return deleteServerTableRecord('contracts', id); }

export async function fetchPurchaseRequests() { return fetchServerTable('purchase_requests'); }
export async function insertPurchaseRequest(req: any) { return insertServerTable('purchase_requests', req); }
export async function updatePurchaseRequest(req: any) { return updateServerTableRecord('purchase_requests', req); }
export async function deletePurchaseRequest(id: string) { return deleteServerTableRecord('purchase_requests', id); }

export async function fetchTasks() { return fetchServerTable('tasks'); }
export async function insertTask(task: any) { return insertServerTable('tasks', task); }
export async function updateTask(task: any) { return updateServerTableRecord('tasks', task); }
export async function deleteTask(id: string) { return deleteServerTableRecord('tasks', id); }

export async function fetchPayables() { return fetchServerTable('payables'); }
export async function insertPayable(payable: any) { return insertServerTable('payables', payable); }
export async function updatePayable(payable: any) { return updateServerTableRecord('payables', payable); }
export async function deletePayable(id: string) { return deleteServerTableRecord('payables', id); }

export async function fetchCustomAgents() { return fetchServerTable('custom_agents'); }
export async function insertCustomAgent(agent: any) { return insertServerTable('custom_agents', agent); }
export async function updateCustomAgent(agent: any) { return updateServerTableRecord('custom_agents', agent); }
export async function deleteCustomAgent(id: string) { return deleteServerTableRecord('custom_agents', id); }

export async function fetchContaAzulConfig(companyId?: string) {
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (companyId) {
      headers["x-company-id"] = companyId;
    }
    const targetCompanyId = companyId || "comp_techcontabil_01";
    const res = await fetch(`/api/contaazul/config?companyId=${targetCompanyId}`, { cache: "no-store", headers });
    if (res.ok) {
      const json = await res.json();
      const dbCfg = json.data;

      if (dbCfg) {
        return {
          clientId: dbCfg.clientId || dbCfg.client_id,
          clientSecret: dbCfg.clientSecret || dbCfg.client_secret,
          redirectUri: dbCfg.redirectUri || dbCfg.redirect_uri,
          accessToken: dbCfg.accessToken || dbCfg.access_token,
          refreshToken: dbCfg.refreshToken || dbCfg.refresh_token,
          isConnected: dbCfg.isConnected ?? dbCfg.is_connected,
          updatedAt: dbCfg.updatedAt || dbCfg.updated_at
        };
      }
      return null;
    }
  } catch (err) {
    console.error("Error fetching contaazul_config:", err);
  }
  return null;
}

export async function updateContaAzulConfig(config: any) {
  try {
    const res = await fetch("/api/contaazul/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyId: config.companyId || config.company_id,
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        accessToken: config.accessToken,
        refreshToken: config.refreshToken,
        isConnected: config.isConnected
      })
    });
    return res.ok;
  } catch (err) {
    console.error("Error updating contaazul_config:", err);
    return false;
  }
}

export async function fetchContaAzulCustomers(companyId?: string) { return fetchServerTable('contaazul_customers', companyId); }
export async function insertContaAzulCustomer(customer: any, companyId?: string) { return insertServerTable('contaazul_customers', customer, companyId); }

export async function fetchContaAzulClients(companyId?: string) { return fetchServerTable('contaazul_clients', companyId); }
export async function saveContaAzulClients(clients: any[]) { return setServerTable('contaazul_clients', clients); }

export async function fetchContaAzulSuppliers(companyId?: string) { return fetchServerTable('contaazul_suppliers', companyId); }
export async function saveContaAzulSuppliers(suppliers: any[]) { return setServerTable('contaazul_suppliers', suppliers); }

export async function fetchContaAzulEntries(companyId?: string) { return fetchServerTable('contaazul_entries', companyId); }
export async function saveContaAzulEntries(entries: any[]) { return setServerTable('contaazul_entries', entries); }

export async function fetchContaAzulCategories(companyId?: string) { return fetchServerTable('contaazul_categories', companyId); }
export async function saveContaAzulCategories(categories: any[]) { return setServerTable('contaazul_categories', categories); }
export async function insertContaAzulCategory(cat: any, companyId?: string) { return insertServerTable('contaazul_categories', cat, companyId); }
export async function updateContaAzulCategory(cat: any) { return updateServerTableRecord('contaazul_categories', cat); }

export async function fetchCustomJobRoles(): Promise<string[]> {
  try {
    const res = await fetch("/api/db?table=custom_job_roles", { cache: "no-store" });
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json.data) && json.data.length > 0) {
        return json.data.map((roleStr: string) => {
          if (typeof roleStr !== 'string') return roleStr;
          return roleStr
            .replace(/EscritÃ³rio/g, "Escritório")
            .replace(/SÃªnior/g, "Sênior")
            .replace(/ContÃ¡bil/g, "Contábil")
            .replace(/TributÃ¡rio/g, "Tributário");
        });
      }
    }
  } catch (err) {
    console.error("Error fetching custom_job_roles:", err);
  }
  return [];
}


export async function saveCustomJobRoles(roles: string[]) {
  return setServerTable('custom_job_roles', roles);
}

export async function fetchDashboardMetrics() { return fetchServerTable('dashboard_metrics'); }
export async function insertDashboardMetric(metric: any) { return insertServerTable('dashboard_metrics', metric); }

export async function fetchAIUsageLogs() { return fetchServerTable('ai_usage_logs'); }
export async function insertAIUsageLog(log: any) { return insertServerTable('ai_usage_logs', log); }

export async function fetchAIStressTestLogs() { return fetchServerTable('ai_stress_test_logs'); }
export async function insertAIStressTestLog(log: any) { return insertServerTable('ai_stress_test_logs', log); }

export async function fetchAIUsageMetrics() { return fetchServerTable('ai_usage_metrics'); }
export async function insertAIUsageMetric(metric: any) { return insertServerTable('ai_usage_metrics', metric); }

export interface PurchaseOrder {
  id: string; // e.g. "ORD-2026-894123"
  order_number: string;
  responsavel_nome: string;
  responsavel_email: string;
  responsavel_telefone: string;
  empresa_nome: string;
  empresa_cnpj: string;
  empresa_segmento: string;
  empresa_observacoes?: string;
  plan_id: "profissional" | "premium" | "business";
  plan_name: string;
  plan_price_monthly: number;
  coins_franchise: number;
  incluir_conta_azul: boolean;
  conta_azul_setup_fee: number;
  total_initial_payment: number;
  status: "PENDENTE_PAGAMENTO" | "PAGAMENTO_CONFIRMADO" | "PROVISIONADO" | "CANCELADO";
  stripe_session_id?: string;
  stripe_payment_intent_id?: string;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  processed_event_ids?: string[];
  created_at: string;
  paid_at?: string;
  provisioned_at?: string;
  provisioned_company_id?: string;
  origin_source?: "landing_page" | "manual_super_admin";
  created_by_user_id?: string;
  created_by_user_name?: string;
}

export async function fetchAuditLogs() { return fetchServerTable('audit_logs'); }
export async function fetchPurchaseOrders(): Promise<PurchaseOrder[]> { return fetchServerTable<PurchaseOrder>('pedidos_saas'); }
export async function insertPurchaseOrder(order: PurchaseOrder) { return insertServerTable('pedidos_saas', order); }
export async function updatePurchaseOrder(order: PurchaseOrder) { return updateServerTableRecord('pedidos_saas', order); }
export async function deletePurchaseOrder(id: string) { return deleteServerTableRecord('pedidos_saas', id); }

export async function insertAuditLog(log: {
  companyId?: string;
  company_id?: string;
  userId?: string;
  user_id?: string;
  userName?: string;
  user_name?: string;
  action: string;
  resource: string;
  details?: string;
}) {
  const cid = log.companyId || log.company_id || 'global';
  const uid = log.userId || log.user_id || 'usr_current';
  const uname = log.userName || log.user_name || 'Usuário';

  return insertServerTable('audit_logs', {
    id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    company_id: cid,
    user_id: uid,
    user_name: uname,
    action: log.action,
    resource: log.resource,
    details: log.details || '',
    created_at: new Date().toISOString()
  });
}



