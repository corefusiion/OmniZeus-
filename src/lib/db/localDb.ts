import { supabase } from "@/lib/db/supabaseClient";

/**
 * Legacy wrapper.
 * As rotas devem preferir usar `supabase` diretamente em vez de carregar todo o banco na memória.
 */
export async function readDb(): Promise<any> {
  const [
    settings,
    companies,
    employees,
    orders,
    conversations,
    messages
  ] = await Promise.all([
    supabase.from('settings').select('*'),
    supabase.from('companies').select('*'),
    supabase.from('employees').select('*'),
    supabase.from('orders').select('*'),
    supabase.from('conversations').select('*'),
    supabase.from('messages').select('*')
  ]);

  return {
    settings: settings.data || [],
    companies: companies.data || [],
    employees: employees.data || [],
    orders: orders.data || [],
    conversations: conversations.data || [],
    messages: messages.data || []
  };
}

/**
 * Legacy wrapper. Do NOT use writeDb anymore since it attempts to write the entire object.
 * As rotas devem atualizar apenas as tabelas específicas.
 */
export async function writeDb(db: any): Promise<void> {
  console.warn("WARNING: writeDb called but it is deprecated. It will not write the entire DB to Supabase.");
}
