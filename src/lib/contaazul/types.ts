export interface ContaAzulClient {
  id: string;
  nome: string;
  fantasia?: string;
  documento?: string;
  email?: string;
  telefone?: string;
  ativo?: boolean;
  perfis?: string[];
  tipo_pessoa?: 'Física' | 'Jurídica';
  data_criacao?: string;
  data_alteracao?: string;
}

export interface ContaAzulSupplier {
  id: string;
  nome: string;
  fantasia?: string;
  documento?: string;
  email?: string;
  telefone?: string;
  ativo?: boolean;
  perfis?: string[];
  tipo_pessoa?: 'Física' | 'Jurídica';
  data_criacao?: string;
  data_alteracao?: string;
}

export interface ContaAzulEntry {
  id: string;
  data: string;
  vencimento?: string;
  valor: number;
  tipo: 'RECEITA' | 'DESPESA';
  categoria_id?: string;
  cliente_id?: string;
  fornecedor_id?: string;
  descricao?: string;
  status?: string;
}

export interface ContaAzulCategory {
  id: string;
  nome?: string;
  name?: string;
  categoryName?: string;
  type?: string;
  tipo?: string;
  dreLine?: string;
}

// AI Workspace types
export interface AIWorkspaceMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  table?: AITableSchema | null;
  actions?: AIAction[];
  attachments?: string[];
}

export interface AITableSchema {
  columns: AITableColumn[];
  rows: Record<string, any>[];
  totalRows: number;
  exportable: boolean;
}

export interface AITableColumn {
  key: string;
  label: string;
  sortable?: boolean;
  type?: 'text' | 'currency' | 'date' | 'status' | 'badge';
}

export interface AIAction {
  id: string;
  type: 'CREATE_CLIENT' | 'CREATE_SUPPLIER' | 'CREATE_ENTRY' | 'UPDATE_CLIENT' | 'UPDATE_SUPPLIER' | 'DELETE' | 'EXPORT' | 'SYNC' | 'CUSTOM';
  label: string;
  description: string;
  data: Record<string, any>;
  requiresConfirmation: boolean;
  status: 'pending' | 'confirmed' | 'executing' | 'success' | 'error' | 'cancelled';
}

export interface AIImportResult {
  fileName: string;
  fileType: string;
  extractedRows: Record<string, any>[];
  columns: string[];
  warnings: string[];
  errors: string[];
  status: 'preview' | 'confirmed' | 'processing' | 'complete' | 'error';
}

export interface AuditLogEntry {
  id: string;
  userId: string;
  companyId: string;
  timestamp: string;
  prompt: string;
  documentsAttached: string[];
  actionsExecuted: AIAction[];
  provider: 'MCP' | 'API_V2' | 'API_V1' | 'LOCAL';
  result: 'SUCCESS' | 'ERROR' | 'CANCELLED';
  responseTimeMs: number;
  model: string;
  tokensUsed?: number;
}

export interface IAWorkspaceConversation {
  id: string;
  title: string;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}
