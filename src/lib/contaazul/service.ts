import fs from "fs";
import path from "path";
import { fetchWithAutoRefresh, getContaAzulTokens } from "./store";
import { 
  ContaAzulClient, 
  ContaAzulSupplier, 
  ContaAzulEntry, 
  ContaAzulCategory 
} from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "omnizeus_local_sql_database.json");

function getLocalDb() {
  try {
    const raw = fs.readFileSync(DB_FILE, "utf-8");
    return JSON.parse(raw);
  } catch (e) {
    return {};
  }
}

/**
 * Retorna todos os clientes do banco local
 */
export async function listClients(): Promise<ContaAzulClient[]> {
  const db = getLocalDb();
  if (db.contaazul_clients && db.contaazul_clients.length > 0) {
    return db.contaazul_clients;
  }
  return [];
}

/**
 * Retorna todos os fornecedores do banco local
 */
export async function listSuppliers(): Promise<ContaAzulSupplier[]> {
  const db = getLocalDb();
  if (db.contaazul_suppliers && db.contaazul_suppliers.length > 0) {
    return db.contaazul_suppliers;
  }
  return [];
}

/**
 * Retorna todos os eventos financeiros do banco local
 */
export async function listEntries(): Promise<ContaAzulEntry[]> {
  const db = getLocalDb();
  if (db.contaazul_entries && db.contaazul_entries.length > 0) {
    return db.contaazul_entries;
  }
  return [];
}

/**
 * Retorna todas as categorias (plano de contas) do banco local
 */
export async function listCategories(): Promise<ContaAzulCategory[]> {
  const db = getLocalDb();
  if (db.contaazul_categories && db.contaazul_categories.length > 0) {
    return db.contaazul_categories;
  }
  return [];
}

/**
 * Cria um novo cliente via API
 */
export async function createClient(data: Partial<ContaAzulClient>): Promise<ContaAzulClient | null> {
  const res = await fetchWithAutoRefresh("https://api-v2.contaazul.com/v1/pessoas", {
    method: "POST",
    body: JSON.stringify(data)
  });
  if (res.res.ok) {
    return await res.res.json();
  }
  return null;
}

/**
 * Atualiza um cliente via API
 */
export async function updateClient(id: string, data: Partial<ContaAzulClient>): Promise<ContaAzulClient | null> {
  const res = await fetchWithAutoRefresh(`https://api-v2.contaazul.com/v1/pessoas/${id}`, {
    method: "PUT",
    body: JSON.stringify(data)
  });
  if (res.res.ok) {
    return await res.res.json();
  }
  return null;
}

/**
 * Cria um novo fornecedor via API
 */
export async function createSupplier(data: Partial<ContaAzulSupplier>): Promise<ContaAzulSupplier | null> {
  const res = await fetchWithAutoRefresh("https://api.contaazul.com/v1/fornecedores", {
    method: "POST",
    body: JSON.stringify(data)
  });
  if (res.res.ok) {
    return await res.res.json();
  }
  return null;
}

/**
 * Cria um novo lançamento financeiro via API
 */
export async function createEntry(data: Partial<ContaAzulEntry>): Promise<ContaAzulEntry | null> {
  const res = await fetchWithAutoRefresh("https://api.contaazul.com/v1/financeiro/eventos-financeiros", {
    method: "POST",
    body: JSON.stringify(data)
  });
  if (res.res.ok) {
    return await res.res.json();
  }
  return null;
}

/**
 * Busca textual em todas as tabelas locais
 */
export async function searchAll(query: string) {
  const db = getLocalDb();
  const q = query.toLowerCase();
  
  const clients = (db.contaazul_clients || []).filter((c: any) => c.nome?.toLowerCase().includes(q) || c.documento?.includes(q));
  const suppliers = (db.contaazul_suppliers || []).filter((s: any) => s.nome?.toLowerCase().includes(q) || s.documento?.includes(q));
  const entries = (db.contaazul_entries || []).filter((e: any) => e.descricao?.toLowerCase().includes(q));
  
  return { clients, suppliers, entries };
}

/**
 * Dispara a sincronização de todos os dados
 */
export async function syncAll() {
  const tokens = getContaAzulTokens();
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const res = await fetch(`${baseUrl}/api/contaazul/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(tokens)
  });
  return await res.json();
}

/**
 * Verifica o status da conexão da integração
 */
export async function getConnectionStatus() {
  const tokens = getContaAzulTokens();
  return {
    isConnected: !!(tokens.accessToken && tokens.refreshToken),
    updatedAt: tokens.updatedAt
  };
}
