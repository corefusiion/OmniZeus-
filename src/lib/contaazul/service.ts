import { fetchWithAutoRefresh, getContaAzulTokens } from "./store";
import { supabase } from "@/lib/db/supabaseClient";
import { 
  ContaAzulClient, 
  ContaAzulSupplier, 
  ContaAzulEntry, 
  ContaAzulCategory 
} from "./types";

/**
 * Retorna todos os clientes do banco do Supabase
 */
export async function listClients(): Promise<ContaAzulClient[]> {
  const { data } = await supabase.from('contaazul_clients').select('*');
  return data || [];
}

/**
 * Retorna todos os fornecedores do banco do Supabase
 */
export async function listSuppliers(): Promise<ContaAzulSupplier[]> {
  const { data } = await supabase.from('contaazul_suppliers').select('*');
  return data || [];
}

/**
 * Retorna todos os eventos financeiros do banco do Supabase
 */
export async function listEntries(): Promise<ContaAzulEntry[]> {
  const { data } = await supabase.from('contaazul_entries').select('*');
  return data || [];
}

/**
 * Retorna todas as categorias (plano de contas) do banco do Supabase
 */
export async function listCategories(): Promise<ContaAzulCategory[]> {
  const { data } = await supabase.from('contaazul_categories').select('*');
  return data || [];
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
 * Busca textual nas tabelas do Supabase
 */
export async function searchAll(query: string) {
  const q = `%${query}%`;
  
  const [clientsRes, suppliersRes, entriesRes] = await Promise.all([
    supabase.from('contaazul_clients').select('*').or(`nome.ilike.${q},documento.ilike.${q}`),
    supabase.from('contaazul_suppliers').select('*').or(`nome.ilike.${q},documento.ilike.${q}`),
    supabase.from('contaazul_entries').select('*').ilike('descricao', q)
  ]);
  
  return { 
    clients: clientsRes.data || [], 
    suppliers: suppliersRes.data || [], 
    entries: entriesRes.data || [] 
  };
}

/**
 * Dispara a sincronização de todos os dados
 */
export async function syncAll() {
  const tokens = await getContaAzulTokens();
  let baseUrl = "http://localhost:3000";
  try {
    if (typeof process !== "undefined" && process.env && process.env.NEXT_PUBLIC_APP_URL) {
      baseUrl = process.env.NEXT_PUBLIC_APP_URL;
    }
  } catch {}
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
  const tokens = await getContaAzulTokens();
  return {
    isConnected: !!(tokens.accessToken && tokens.refreshToken),
    updatedAt: tokens.updatedAt
  };
}


