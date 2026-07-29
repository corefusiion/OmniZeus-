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
  custom_ai_enabled?: boolean;
  custom_ai_url?: string;
  custom_ai_key?: string;
  custom_ai_model?: string;
  coins_balance?: number;
  custom_job_roles?: string[];
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

export async function fetchServerTable<T = any>(table: string): Promise<T[]> {
  try {
    const res = await fetch(`/api/db?table=${table}`, { cache: "no-store" });
    if (res.ok) {
      const json = await res.json();
      return Array.isArray(json.data) ? json.data : [];
    }
  } catch (err) {
    console.error(`Error fetching table ${table} from local SQL DB:`, err);
  }
  return [];
}

export async function insertServerTable<T = any>(table: string, record: T): Promise<boolean> {
  try {
    const res = await fetch("/api/db", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "insert",
        table,
        record
      })
    });
    return res.ok;
  } catch (err) {
    console.error(`Error inserting into ${table} in local SQL DB:`, err);
    return false;
  }
}

export async function updateServerTableRecord<T = any>(table: string, record: T): Promise<boolean> {
  try {
    const res = await fetch("/api/db", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update",
        table,
        record
      })
    });
    return res.ok;
  } catch (err) {
    console.error(`Error updating ${table} in local SQL DB:`, err);
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

export async function fetchContaAzulConfig() {
  try {
    const res = await fetch("/api/db?table=contaazul_config", { cache: "no-store" });
    if (res.ok) {
      const json = await res.json();
      return json.data || {};
    }
  } catch (err) {
    console.error("Error fetching contaazul_config:", err);
  }
  return {};
}

export async function updateContaAzulConfig(config: any) {
  try {
    const res = await fetch("/api/db", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update_contaazul_config",
        contaazul_config: config
      })
    });
    return res.ok;
  } catch (err) {
    console.error("Error updating contaazul_config:", err);
    return false;
  }
}

export async function fetchContaAzulCustomers() { return fetchServerTable('contaazul_customers'); }
export async function insertContaAzulCustomer(customer: any) { return insertServerTable('contaazul_customers', customer); }

export async function fetchContaAzulClients() { return fetchServerTable('contaazul_clients'); }
export async function saveContaAzulClients(clients: any[]) { return setServerTable('contaazul_clients', clients); }

export async function fetchContaAzulEntries() { return fetchServerTable('contaazul_entries'); }
export async function saveContaAzulEntries(entries: any[]) { return setServerTable('contaazul_entries', entries); }

export async function fetchContaAzulCategories() { return fetchServerTable('contaazul_categories'); }
export async function insertContaAzulCategory(cat: any) { return insertServerTable('contaazul_categories', cat); }
export async function updateContaAzulCategory(cat: any) { return updateServerTableRecord('contaazul_categories', cat); }
export async function saveContaAzulCategories(cats: any[]) { return setServerTable('contaazul_categories', cats); }

export async function fetchCustomJobRoles(): Promise<string[]> {
  try {
    const res = await fetch("/api/db?table=custom_job_roles", { cache: "no-store" });
    if (res.ok) {
      const json = await res.json();
      return Array.isArray(json.data) ? json.data : [];
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

export async function fetchAIStressTestLogs() { return fetchServerTable('ai_stress_test_logs'); }
export async function insertAIStressTestLog(log: any) { return insertServerTable('ai_stress_test_logs', log); }

export async function fetchAIUsageMetrics() { return fetchServerTable('ai_usage_metrics'); }
export async function insertAIUsageMetric(metric: any) { return insertServerTable('ai_usage_metrics', metric); }

