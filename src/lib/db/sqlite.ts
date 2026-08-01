import {
  fetchServerTable,
  insertServerTable,
  updateServerTableRecord,
  deleteServerTableRecord
} from "./serverDb";

export interface DbSchema {
  conversations: {
    id: string;
    title: string;
    model: string;
    persona: string;
    created_at: string;
    updated_at: string;
  }[];
  messages: {
    id: string;
    conversation_id: string;
    sender: 'user' | 'ai';
    text: string;
    model?: string;
    created_at: string;
  }[];
  tasks: {
    id: string;
    title: string;
    client: string;
    assignee: string;
    priority: 'alta' | 'media' | 'baixa';
    status: 'pendente' | 'em_andamento' | 'concluido';
    time_spent_sec: number;
    gemini_suggestion?: string;
    created_at: string;
  }[];
  whatsapp_logs: {
    id: string;
    chat_id: string;
    sender: string;
    message: string;
    direction: 'inbound' | 'outbound';
    created_at: string;
  }[];
  coin_transactions: {
    id: string;
    action: string;
    coins: number;
    type: 'usage' | 'recharge';
    created_at: string;
  }[];
}

const defaultSeedDb: DbSchema = {
  conversations: [],
  messages: [],
  tasks: [], // No mock data — tasks come exclusively from the server DB
  whatsapp_logs: [],
  coin_transactions: []
};

let inMemoryDb: DbSchema = { ...defaultSeedDb };
let dbFetched = false;

// Limpa o espelho local SQL ao trocar de tenant (impede vazamento de chats/tarefas entre empresas)
export function resetSqliteDb(): void {
  inMemoryDb = { ...defaultSeedDb };
  dbFetched = false;
}

export async function syncSqlDbWithServer(): Promise<DbSchema> {
  try {
    const tasks = await fetchServerTable<any>('tasks');
    // Always replace from DB — even if DB is empty (fixes stale-mock bug)
    if (Array.isArray(tasks)) {
      inMemoryDb.tasks = tasks.map((r: any) => ({
        id: r.id,
        title: r.title || '',
        client: r.client || '',
        assignee: r.assignee || r.assignee_name || '',
        priority: r.priority || 'media',
        status: r.status || 'pendente',
        time_spent_sec: r.time_spent_sec !== undefined ? r.time_spent_sec : (r.timeSpentSec || 0),
        gemini_suggestion: r.gemini_suggestion || r.geminiSuggestion || '',
        created_at: r.created_at || new Date().toISOString()
      }));
    }
    const conversations = await fetchServerTable<any>('conversations');
    if (Array.isArray(conversations)) {
      inMemoryDb.conversations = conversations;
    }
    const messages = await fetchServerTable<any>('messages');
    if (Array.isArray(messages)) {
      inMemoryDb.messages = messages;
    }
    dbFetched = true;
  } catch (err) {
    console.error("Error syncing local SQL DB with server:", err);
  }
  return inMemoryDb;
}

export function getLocalSqlDb(): DbSchema {
  if (typeof window !== 'undefined' && !dbFetched) {
    dbFetched = true;
    syncSqlDbWithServer().then(() => {
      window.dispatchEvent(new Event('omnizeus_sql_db_change'));
    }).catch(() => {});
  }
  return inMemoryDb;
}

export function saveLocalSqlDb(db: DbSchema): void {
  inMemoryDb = db;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('omnizeus_sql_db_change'));
  }
}

// SQL Query helper abstractions
export const sqlDb = {
  select: <T extends keyof DbSchema>(table: T): DbSchema[T] => {
    const db = getLocalSqlDb();
    return db[table];
  },
  insert: <T extends keyof DbSchema>(table: T, record: DbSchema[T][number]) => {
    const db = getLocalSqlDb();
    (db[table] as any[]).push(record);
    saveLocalSqlDb(db);
    insertServerTable(table as string, record).catch(() => {});
    return record;
  },
  deleteConversation: (id: string) => {
    const db = getLocalSqlDb();
    db.conversations = db.conversations.filter(c => c.id !== id);
    db.messages = db.messages.filter(m => m.conversation_id !== id);
    saveLocalSqlDb(db);
    deleteServerTableRecord('conversations', id).catch(() => {});
  },
  updateConversationTitle: (id: string, newTitle: string) => {
    const db = getLocalSqlDb();
    db.conversations = db.conversations.map(c => c.id === id ? { ...c, title: newTitle, updated_at: new Date().toISOString() } : c);
    saveLocalSqlDb(db);
    updateServerTableRecord('conversations', { id, title: newTitle, updated_at: new Date().toISOString() }).catch(() => {});
  },
  updateTask: (id: string, updates: Partial<DbSchema['tasks'][number]>) => {
    const db = getLocalSqlDb();
    db.tasks = db.tasks.map(t => t.id === id ? { ...t, ...updates } : t);
    saveLocalSqlDb(db);
    const target = db.tasks.find(t => t.id === id);
    if (target) {
      updateServerTableRecord('tasks', target).catch(() => {});
    }
  },
  deleteTask: (id: string) => {
    const db = getLocalSqlDb();
    db.tasks = db.tasks.filter(t => t.id !== id);
    saveLocalSqlDb(db);
    deleteServerTableRecord('tasks', id).catch(() => {});
  }
};

