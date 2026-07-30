import fs from "fs";
import path from "path";
import { AuditLogEntry } from "./types";

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

function saveLocalDb(db: any) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf-8");
  } catch (e) {}
}

/**
 * Registra uma entrada de log de auditoria da IA
 */
export function recordAudit(entry: AuditLogEntry): boolean {
  try {
    const db = getLocalDb();
    if (!db.contaazul_ia_audit_logs) {
      db.contaazul_ia_audit_logs = [];
    }
    db.contaazul_ia_audit_logs.push(entry);
    saveLocalDb(db);
    return true;
  } catch (err) {
    console.error("Erro ao registrar auditoria:", err);
    return false;
  }
}

/**
 * Retorna os logs de auditoria aplicando filtros opcionais
 */
export function getAuditLogs(filters?: { companyId?: string; userId?: string }): AuditLogEntry[] {
  const db = getLocalDb();
  let logs: AuditLogEntry[] = db.contaazul_ia_audit_logs || [];
  
  if (filters) {
    if (filters.companyId) logs = logs.filter((l: AuditLogEntry) => l.companyId === filters.companyId);
    if (filters.userId) logs = logs.filter((l: AuditLogEntry) => l.userId === filters.userId);
  }
  
  return logs.sort((a: AuditLogEntry, b: AuditLogEntry) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

/**
 * Retorna estatísticas de uso sumarizadas
 */
export function getAuditStats() {
  const logs = getAuditLogs();
  
  return {
    total: logs.length,
    successCount: logs.filter((l: AuditLogEntry) => l.result === "SUCCESS").length,
    errorCount: logs.filter((l: AuditLogEntry) => l.result === "ERROR").length,
    totalTokens: logs.reduce((acc: number, l: AuditLogEntry) => acc + (l.tokensUsed || 0), 0)
  };
}
