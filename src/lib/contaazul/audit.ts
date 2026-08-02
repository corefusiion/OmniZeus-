import { supabase } from "@/lib/db/supabaseClient";
import { AuditLogEntry } from "./types";

/**
 * Registra uma entrada de log de auditoria da IA
 */
export async function recordAudit(entry: AuditLogEntry): Promise<boolean> {
  try {
    const { error } = await supabase.from('contaazul_ia_audit_logs').insert([entry]);
    if (error) throw error;
    return true;
  } catch (err) {
    console.error("Erro ao registrar auditoria:", err);
    return false;
  }
}

/**
 * Retorna os logs de auditoria aplicando filtros opcionais
 */
export async function getAuditLogs(filters?: { companyId?: string; userId?: string }): Promise<AuditLogEntry[]> {
  let query = supabase.from('contaazul_ia_audit_logs').select('*');
  
  if (filters?.companyId) {
    query = query.eq('companyId', filters.companyId);
  }
  if (filters?.userId) {
    query = query.eq('userId', filters.userId);
  }
  
  const { data, error } = await query.order('timestamp', { ascending: false });
  if (error) {
    console.error("Erro ao buscar auditoria:", error);
    return [];
  }
  
  return data || [];
}

/**
 * Retorna estatísticas de uso sumarizadas
 */
export async function getAuditStats() {
  const logs = await getAuditLogs();
  
  return {
    total: logs.length,
    successCount: logs.filter((l: AuditLogEntry) => l.result === "SUCCESS").length,
    errorCount: logs.filter((l: AuditLogEntry) => l.result === "ERROR").length,
    totalTokens: logs.reduce((acc: number, l: AuditLogEntry) => acc + (l.tokensUsed || 0), 0)
  };
}


