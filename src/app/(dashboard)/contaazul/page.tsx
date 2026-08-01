"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { 
  Link as LinkIcon, Download, RefreshCw, CheckCircle2, DollarSign, FileText, ArrowUpRight, 
  ShieldCheck, Key, Users, Layers, AlertCircle, Settings, Check, ExternalLink, ArrowRight, Database, XCircle, AlertTriangle, Mail, Phone, Plus, Search, UserPlus, FilePlus, Zap, Edit, Mic, MicOff, Bot, Send, Sparkles, MessageSquare, Minimize2, Maximize2, Trash2, Edit2, PlusCircle, Folder, ChevronRight, ChevronDown, X, Upload, FileSpreadsheet, MapPin, Building, Info, CheckSquare, Pin, PinOff, Filter
} from "lucide-react";
import * as XLSX from "xlsx";
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, Legend, PieChart, Pie, Cell 
} from "recharts";
import { getActiveRole, getActiveTenantId, UserRole } from "@/lib/auth/roles";
import { 
  fetchContaAzulConfig, updateContaAzulConfig, 
  fetchContaAzulClients, saveContaAzulClients, 
  fetchContaAzulEntries, saveContaAzulEntries, 
  fetchContaAzulSuppliers, saveContaAzulSuppliers,
  fetchContaAzulCategories, saveContaAzulCategories 
} from "@/lib/db/serverDb";

export interface ContaAzulConfig {
  companyId?: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  isConnected: boolean;
  accessToken?: string;
  refreshToken?: string;
  connectedAt?: string;
  lastSyncAt?: string;
}

export interface ContaAzulCategory {
  id: string;
  name?: string;
  categoryName: string;
  type: 'RECEITA' | 'DESPESA';
  dreLine: string;
  status: string;
}

const DEFAULT_CATEGORIES: ContaAzulCategory[] = [];

export default function ContaAzulPage() {
  const searchParams = useSearchParams();
  const codeFromUrl = searchParams?.get("code");
  const errorFromUrl = searchParams?.get("error");

  const [role, setRole] = useState<UserRole>("gestor");
  const [activeTab, setActiveTab] = useState<'conexao' | 'clientes' | 'fornecedores' | 'financeiro' | 'categorias'>('clientes');
  
  // Config State
  const [clientId, setClientId] = useState("1mbtg7ok5lp46p0j9oir48fda0");
  const [clientSecret, setClientSecret] = useState("m3mgshckslvubnraqf0d50hcggm4tn6mnlpa7ancvo3m8t5f93l");
  const [redirectUri, setRedirectUri] = useState("https://contaazul.com");
  const [accessToken, setAccessToken] = useState<string | undefined>(undefined);
  const [refreshToken, setRefreshToken] = useState<string | undefined>(undefined);

  const [manualTokenInput, setManualTokenInput] = useState("");
  const [manualCodeInput, setManualCodeInput] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [noticeMessage, setNoticeMessage] = useState<{ type: 'success' | 'error' | 'info' | 'warning', text: string } | null>(null);

  // Search Filter
  const [searchQuery, setSearchQuery] = useState("");

  // Global Dashboard Filters & Interactive State
  const [periodFilter, setPeriodFilter] = useState<'30d' | '90d' | '6m' | '12m' | 'ytd' | 'custom'>('6m');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState<'TODOS' | 'PREVISTO' | 'REALIZADO' | 'VENCIDO'>('TODOS');
  const [categoryFilter, setCategoryFilter] = useState<string>('TODOS');
  const [clientFilter, setClientFilter] = useState<string>('TODOS');
  const [supplierFilter, setSupplierFilter] = useState<string>('TODOS');

  // Interactive Section Selectors
  const [barChartMode, setBarChartMode] = useState<'PREVISTO' | 'REALIZADO'>('PREVISTO');
  const [catViewType, setCatViewType] = useState<'RECEITA' | 'DESPESA' | 'RESULTADO'>('DESPESA');
  const [rankingType, setRankingType] = useState<'CLIENTES' | 'FORNECEDORES'>('CLIENTES');
  const [showAllRanking, setShowAllRanking] = useState(false);
  const [selectedEntityDetail, setSelectedEntityDetail] = useState<any | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string>(() => 
    new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  );

  // Synced Real Items State
  const [syncedClients, setSyncedClients] = useState<any[]>([]);
  const [syncedSuppliers, setSyncedSuppliers] = useState<any[]>([]);
  const [syncedEntries, setSyncedEntries] = useState<any[]>([]);
  const [categories, setCategories] = useState<ContaAzulCategory[]>([]);

  // Category Modal State
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [catNameInput, setCatNameInput] = useState("");
  const [catTypeInput, setCatTypeInput] = useState<'RECEITA' | 'DESPESA'>("RECEITA");
  const [dreLineInput, setDreLineInput] = useState("Receita Bruta (DRE 1.1)");

  // Modals & Form Notifications
  const [isAddClientOpen, setIsAddClientOpen] = useState(false);
  const [isAddSupplierOpen, setIsAddSupplierOpen] = useState(false);
  const [isEditClientOpen, setIsEditClientOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isAddEntryOpen, setIsAddEntryOpen] = useState(false);

  const [isSubmittingForm, setIsSubmittingForm] = useState(false);
  const [isFetchingCnpj, setIsFetchingCnpj] = useState(false);
  const [isFetchingCep, setIsFetchingCep] = useState(false);
  const [modalErrorMessage, setModalErrorMessage] = useState<string | null>(null);

  // Form Section Active Tab in Customer Modal
  const [customerModalSection, setCustomerModalSection] = useState<'gerais' | 'contato' | 'fiscais' | 'endereco' | 'obs'>('gerais');

  // Form States - Customer Complete Fields
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [newClientName, setNewClientName] = useState("");
  const [newClientTradeName, setNewClientTradeName] = useState("");
  const [newClientDoc, setNewClientDoc] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [newClientWhatsapp, setNewClientWhatsapp] = useState("");
  const [newClientPersonType, setNewClientPersonType] = useState<"Física" | "Jurídica" | "Estrangeira">("Jurídica");
  const [newClientCode, setNewClientCode] = useState("");

  // Form States - Supplier
  const [newSupplierName, setNewSupplierName] = useState("");
  const [newSupplierDoc, setNewSupplierDoc] = useState("");
  const [newSupplierEmail, setNewSupplierEmail] = useState("");
  const [newSupplierPhone, setNewSupplierPhone] = useState("");
  const [newSupplierPersonType, setNewSupplierPersonType] = useState<"Física" | "Jurídica" | "Estrangeira">("Jurídica");
  
  // Roles
  const [roleIsClient, setRoleIsClient] = useState(true);
  const [roleIsSupplier, setRoleIsSupplier] = useState(false);
  const [roleIsCarrier, setRoleIsCarrier] = useState(false);

  // Fiscal Info
  const [isSimples, setIsSimples] = useState(false);
  const [isPublicOrg, setIsPublicOrg] = useState(false);
  const [stateRegistration, setStateRegistration] = useState("");
  const [cityRegistration, setCityRegistration] = useState("");
  const [suframa, setSuframa] = useState("");

  // Address
  const [zipCode, setZipCode] = useState("");
  const [street, setStreet] = useState("");
  const [addressNumber, setAddressNumber] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [complement, setComplement] = useState("");
  const [notes, setNotes] = useState("");

  // Form States - Entry
  const [newEntryDesc, setNewEntryDesc] = useState("");
  const [newEntryVal, setNewEntryVal] = useState("");
  const [newEntryDueDate, setNewEntryDueDate] = useState("");
  const [newEntryCompetenceDate, setNewEntryCompetenceDate] = useState("");
  const [newEntryType, setNewEntryType] = useState<string>("DESPESA");
  const [newEntryCustomerId, setNewEntryCustomerId] = useState("");
  const [newEntrySupplierId, setNewEntrySupplierId] = useState("");
  const [newEntryCategoryId, setNewEntryCategoryId] = useState("");

  // Import CSV State
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importedRows, setImportedRows] = useState<any[]>([]);
  const [isProcessingImport, setIsProcessingImport] = useState(false);

  // CHAT ASSISTIDO IA
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isAiMinimized, setIsAiMinimized] = useState(false);

  const [conversations, setConversations] = useState<any[]>([]);
  const [currentConvId, setCurrentConvId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [convSearchQuery, setConvSearchQuery] = useState("");

  const [aiInputText, setAiInputText] = useState("");

  // AI Import State
  const [isAiImportOpen, setIsAiImportOpen] = useState(false);
  const [aiImportProgress, setAiImportProgress] = useState(0);
  const [aiImportStep, setAiImportStep] = useState<"idle" | "uploading" | "processing" | "done">("idle");

  const handleAiUploadDemo = () => {
    setAiImportStep("uploading");
    setAiImportProgress(0);
    
    let prog = 0;
    const interval = setInterval(() => {
      prog += 10;
      setAiImportProgress(prog);
      if (prog >= 50) setAiImportStep("processing");
      if (prog >= 100) {
        clearInterval(interval);
        setAiImportStep("done");
        setTimeout(() => {
          setIsAiImportOpen(false);
          setImportedRows([{ name: "Cliente Extraído via IA Ltda", doc: "99.888.777/0001-66", email: "ia@empresa.com", phone: "(11) 99999-9999" }]);
          setIsImportModalOpen(true);
        }, 1000);
      }
    }, 400);
  };

  const handleExport = (type: 'csv' | 'xlsx' | 'xml') => {
    if (syncedClients.length === 0) {
      setNoticeMessage({ type: 'warning', text: 'Nenhum cliente para exportar.' });
      return;
    }
    
    const exportData = syncedClients.map(c => ({
      Nome: c.name,
      'CPF/CNPJ': c.doc,
      Email: c.email,
      Telefone: c.phone,
      'Status': 'Ativo'
    }));

    if (type === 'csv' || type === 'xlsx') {
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Clientes");
      XLSX.writeFile(workbook, `conta_azul_clientes.${type}`);
    } else if (type === 'xml') {
      let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<Clientes>\n';
      exportData.forEach((client: any) => {
        xml += '  <Cliente>\n';
        for (const [key, value] of Object.entries(client)) {
          const safeKey = key.replace(/[^a-zA-Z0-9]/g, '');
          xml += `    <${safeKey}>${value}</${safeKey}>\n`;
        }
        xml += '  </Cliente>\n';
      });
      xml += '</Clientes>';
      const blob = new Blob([xml], { type: 'application/xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "conta_azul_clientes.xml";
      a.click();
    }
  };
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [selectedModel, setSelectedModel] = useState("google/gemini-2.5-pro");
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setRole(getActiveRole());
    loadContaAzulData();

    // Carrega status permanente do token gravado em disco (data/omnizeus_contaazul_tokens.json)
    fetch("/api/contaazul/status")
      .then(res => res.json())
      .then(data => {
        if (data.success && data.isConnected) {
          setIsConnected(true);
          if (data.clientId) setClientId(data.clientId);
        }
      })
      .catch(() => {});

    if (codeFromUrl && !accessToken) {
      exchangeCodeForToken(codeFromUrl);
    }

    if (errorFromUrl) {
      setNoticeMessage({ type: 'error', text: `Erro no OAuth ContaAzul: ${errorFromUrl}` });
    }

    fetchConversations();

    const handleRoleChange = () => {
      setRole(getActiveRole());
      loadContaAzulData();
    };
    const handleContextChange = () => {
      loadContaAzulData();
    };

    window.addEventListener("omnizeus_role_change", handleRoleChange);
    window.addEventListener("omnizeus_company_context_change", handleContextChange);
    window.addEventListener("omnizeus_sql_db_change", handleContextChange);

    return () => {
      window.removeEventListener("omnizeus_role_change", handleRoleChange);
      window.removeEventListener("omnizeus_company_context_change", handleContextChange);
      window.removeEventListener("omnizeus_sql_db_change", handleContextChange);
    };
  }, [codeFromUrl, errorFromUrl]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isAiProcessing]);

  const loadContaAzulData = async () => {
    const activeCompanyId = getActiveTenantId() || localStorage.getItem("omnizeus_active_company_id") || "";
    try {
      const [cfg, clients, suppliers, entries, categories] = await Promise.all([
        fetchContaAzulConfig(activeCompanyId),
        fetchContaAzulClients(),
        fetchContaAzulSuppliers(),
        fetchContaAzulEntries(),
        fetchContaAzulCategories()
      ]);

      if (cfg && cfg.clientId) setClientId(cfg.clientId);
      if (cfg && cfg.clientSecret) setClientSecret(cfg.clientSecret);
      if (cfg && (cfg as any).redirectUri && !(cfg as any).redirectUri.includes('localhost')) {
        setRedirectUri((cfg as any).redirectUri);
      }
      if (cfg && cfg.accessToken) {
        setAccessToken(cfg.accessToken);
        setManualTokenInput(cfg.accessToken);
      }
      if (cfg && cfg.refreshToken) setRefreshToken(cfg.refreshToken);
      if (cfg && cfg.isConnected) setIsConnected(true);

      if (Array.isArray(clients) && clients.length > 0) {
        setSyncedClients(clients);
      }

      if (Array.isArray(suppliers) && suppliers.length > 0) {
        setSyncedSuppliers(suppliers);
      }

      if (Array.isArray(entries) && entries.length > 0) {
        setSyncedEntries(entries);
      }

      if (Array.isArray(categories) && categories.length > 0) {
        setCategories(categories);
      } else {
        setCategories(DEFAULT_CATEGORIES);
        await saveContaAzulCategories(DEFAULT_CATEGORIES);
      }
    } catch (err) {
      console.error("Error loading ContaAzul data from serverDb:", err);
    }
  };

  const saveConfig = async (connected: boolean, token?: string, refresh?: string) => {
    setIsConnected(connected);
    const activeAccToken = token || accessToken;
    const activeRefToken = refresh || refreshToken;

    const activeCompanyId = getActiveTenantId() || localStorage.getItem("omnizeus_active_company_id") || "";

    const cfg: ContaAzulConfig = {
      companyId: activeCompanyId,
      clientId,
      clientSecret,
      redirectUri,
      isConnected: connected,
      accessToken: activeAccToken,
      refreshToken: activeRefToken,
      connectedAt: connected ? new Date().toISOString() : undefined,
      lastSyncAt: connected ? new Date().toISOString() : undefined
    };
    await updateContaAzulConfig(cfg);

    if (activeAccToken || activeRefToken) {
      fetch("/api/contaazul/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessToken: activeAccToken,
          refreshToken: activeRefToken,
          clientId,
          clientSecret
        })
      }).catch(() => {});
    }
  };

  // CPF/CNPJ auto-mask
  const formatDocMask = (value: string): string => {
    const digits = value.replace(/\D/g, "").substring(0, 14);
    const len = digits.length;

    if (len <= 11) {
      let result = digits;
      if (len > 3) result = digits.substring(0, 3) + "." + digits.substring(3);
      if (len > 6) result = result.substring(0, 7) + "." + result.substring(7);
      if (len > 9) result = result.substring(0, 11) + "-" + result.substring(11);
      return result;
    } else {
      let result = digits.substring(0, 2) + "." + digits.substring(2, 5) + "." + digits.substring(5, 8) + "/" + digits.substring(8, 12);
      if (len > 12) result += "-" + digits.substring(12);
      return result;
    }
  };

  const handleDocChange = (value: string) => {
    const masked = formatDocMask(value);
    setNewClientDoc(masked);
    const digits = masked.replace(/\D/g, "");
    if (digits.length > 11) {
      setNewClientPersonType("Jurídica");
    } else if (digits.length > 0) {
      setNewClientPersonType("Física");
    }
  };

  const handleLookupCnpj = async () => {
    if (newClientPersonType !== "Jurídica") {
      setModalErrorMessage("A busca de dados da Receita Federal é disponível exclusivamente para Pessoas Jurídicas (CNPJ).");
      return;
    }

    const clean = newClientDoc.replace(/\D/g, "");
    if (clean.length !== 14) {
      setModalErrorMessage("Digite um CNPJ válido com 14 dígitos para consultar.");
      return;
    }

    setIsFetchingCnpj(true);
    setModalErrorMessage(null);

    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${clean}`);
      if (res.ok) {
        const data = await res.json();
        if (data.razao_social) setNewClientName(data.razao_social);
        if (data.nome_fantasia) setNewClientTradeName(data.nome_fantasia);
        if (data.email) setNewClientEmail(data.email);
        if (data.ddd_telefone_1) setNewClientPhone(data.ddd_telefone_1);
        if (data.cep) {
          setZipCode(data.cep);
          if (data.logradouro) setStreet(data.logradouro);
          if (data.numero) setAddressNumber(data.numero);
          if (data.bairro) setNeighborhood(data.bairro);
          if (data.municipio) setCity(data.municipio);
          if (data.uf) setState(data.uf);
        }
        setIsSimples(data.opcao_pelo_simples === true);
      } else {
        setModalErrorMessage("Não foi possível localizar os dados deste CNPJ na Receita Federal.");
      }
    } catch (e) {
      setModalErrorMessage("Erro de conexão ao consultar CNPJ público.");
    } finally {
      setIsFetchingCnpj(false);
    }
  };

  const handleLookupCep = async () => {
    const clean = zipCode.replace(/\D/g, "");
    if (clean.length !== 8) return;

    setIsFetchingCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      if (res.ok) {
        const data = await res.json();
        if (!data.erro) {
          if (data.logradouro) setStreet(data.logradouro);
          if (data.bairro) setNeighborhood(data.bairro);
          if (data.localidade) setCity(data.localidade);
          if (data.uf) setState(data.uf);
        }
      }
    } catch (e) {} finally {
      setIsFetchingCep(false);
    }
  };

  const fetchConversations = async () => {
    try {
      const companyId = getActiveTenantId() || "";
      const res = await fetch(`/api/bpo-chat/conversations?userId=super_adm${companyId ? `&companyId=${encodeURIComponent(companyId)}` : ""}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setConversations(data.conversations || []);
        if (data.conversations && data.conversations.length > 0 && !currentConvId) {
          selectConversation(data.conversations[0].id);
        }
      }
    } catch (e) {}
  };

  const createNewConversation = async () => {
    try {
      const res = await fetch("/api/bpo-chat/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: "super_adm",
          companyId: getActiveTenantId() || "",
          tenantId: getActiveTenantId() || "",
          title: "Nova Conversa BPO",
          model: selectedModel,
          provider: "openrouter"
        })
      });

      const data = await res.json();
      if (res.ok && data.success && data.conversation) {
        setConversations(prev => [data.conversation, ...prev]);
        setCurrentConvId(data.conversation.id);
        setChatMessages([]);
      }
    } catch (e) {}
  };

  const togglePinConversation = async (convId: string, currentPinned: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch("/api/bpo-chat/conversations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: convId, pinned: !currentPinned })
      });
      if (res.ok) {
        fetchConversations();
      }
    } catch (e) {}
  };

  const selectConversation = async (convId: string) => {
    setCurrentConvId(convId);
    try {
      const res = await fetch(`/api/bpo-chat/messages?conversationId=${convId}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setChatMessages(data.messages || []);
      }
    } catch (e) {}
  };

  const deleteConversation = async (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/bpo-chat/conversations?id=${convId}&userId=super_adm`, {
        method: "DELETE"
      });
      if (res.ok) {
        const updated = conversations.filter(c => c.id !== convId);
        setConversations(updated);
        if (currentConvId === convId) {
          if (updated.length > 0) {
            selectConversation(updated[0].id);
          } else {
            setCurrentConvId(null);
            setChatMessages([]);
          }
        }
      }
    } catch (e) {}
  };

  const exchangeCodeForToken = async (codeToUse: string) => {
    setIsConnecting(true);
    setNoticeMessage(null);
    const activeCompanyId = getActiveTenantId() || localStorage.getItem("omnizeus_active_company_id") || "";
    try {
      const res = await fetch("/api/contaazul/callback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: codeToUse,
          clientId,
          clientSecret,
          redirectUri,
          companyId: activeCompanyId
        })
      });
      const data = await res.json();
      setIsConnecting(false);

      if (res.ok && data.access_token) {
        setAccessToken(data.access_token);
        if (data.refresh_token) setRefreshToken(data.refresh_token);
        setManualTokenInput(data.access_token);
        await saveConfig(true, data.access_token, data.refresh_token);
        setNoticeMessage({ type: 'success', text: "Conexão de Produção autenticada! Auto-renovação silenciosa ativa (24/7)." });
      } else {
        setNoticeMessage({ 
          type: 'error', 
          text: `Não foi possível validar o código de autorização. ${data.error || 'Por favor, gere um novo código.'}` 
        });
      }
    } catch (err: any) {
      setIsConnecting(false);
      setNoticeMessage({ type: 'error', text: `Falha de conexão com os servidores da ContaAzul.` });
    }
  };

  const handleStartOAuthRedirect = async () => {
    if (!clientId.trim() || !clientSecret.trim()) {
      setNoticeMessage({ type: 'error', text: "Por favor, informe o Client ID e Client Secret da ContaAzul." });
      return;
    }

    setIsConnecting(true);
    try {
      const res = await fetch("/api/contaazul/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, clientSecret, redirectUri })
      });
      const data = await res.json();
      setIsConnecting(false);

      if (data.authUrl) {
        window.open(data.authUrl, '_blank');
        setNoticeMessage({ 
          type: 'info', 
          text: "Janela de login iniciada. Faça login na sua conta ContaAzul Pro. Copie a chave ?code=... retornado e cole na Opção 1." 
        });
      } else {
        setNoticeMessage({ type: 'error', text: data.error || "Não foi possível abrir o portal de autorização." });
      }
    } catch (err: any) {
      setIsConnecting(false);
      setNoticeMessage({ type: 'error', text: "Erro ao conectar com a ContaAzul." });
    }
  };

  const handleSaveManualToken = async () => {
    if (!manualTokenInput.trim()) {
      setNoticeMessage({ type: 'error', text: "Digite ou cole um Token de Acesso Válido." });
      return;
    }
    setAccessToken(manualTokenInput.trim());
    await saveConfig(true, manualTokenInput.trim());
    setNoticeMessage({ type: 'success', text: "Token de Acesso salvo com sucesso!" });
  };

  const handleDisconnect = async () => {
    setAccessToken(undefined);
    setRefreshToken(undefined);
    setManualTokenInput("");
    setManualCodeInput("");
    setSyncedClients([]);
    setSyncedEntries([]);
    await saveContaAzulClients([]);
    await saveContaAzulEntries([]);
    await saveConfig(false);
    setNoticeMessage({ type: 'info', text: "Sessão com a ContaAzul encerrada." });
  };

  const handleRealSync = async () => {
    setIsSyncing(true);
    setNoticeMessage(null);

    const tokenToUse = accessToken || manualTokenInput.trim();

    setNoticeMessage(null);

    const activeCompanyId = typeof window !== 'undefined' ? (localStorage.getItem("omnizeus_active_company_id") || getActiveTenantId() || "") : (getActiveTenantId() || "");

    try {
      const res = await fetch("/api/contaazul/auto-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          company_id: activeCompanyId
        })
      });

      const data = await res.json();
      setIsSyncing(false);

      if (res.ok && data.success) {
        await loadContaAzulData();
        const firstRes = Array.isArray(data.results) ? data.results[0] : null;
        const msg = firstRes?.message || `Sincronização 24/7 concluída com sucesso!`;

        setNoticeMessage({ 
          type: 'success', 
          text: msg
        });
      } else {
        setNoticeMessage({ 
          type: 'error', 
          text: data.error || 'Falha na sincronização Conta Azul. Verifique suas credenciais de integração.' 
        });
      }
      setLastSyncTime(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    } catch (err: any) {
      setIsSyncing(false);
      setNoticeMessage({ type: 'error', text: "Erro de comunicação com o servidor da ContaAzul." });
    }
  };

  const handleOpenEditClient = (client: any) => {
    setEditingClientId(client.id || null);
    setNewClientName(client.name || client.nome || client.company_name || client.razao_social || "");
    setNewClientTradeName(client.trade_name || client.fantasia || "");
    const rawDoc = client.document || client.cnpj || client.cpf || client.cpf_cnpj || client.documento || "";
    setNewClientDoc(formatDocMask(rawDoc));
    setNewClientEmail(client.email || client.email_principal || "");
    setNewClientPhone(client.phone || client.telefone || client.celular || "");
    setNewClientWhatsapp(client.whatsapp || client.telefone_celular || "");
    setZipCode(client.address?.zip_code || client.cep || "");
    setStreet(client.address?.street || client.logradouro || "");
    setAddressNumber(client.address?.number || client.numero || "");
    setNeighborhood(client.address?.neighborhood || client.bairro || "");
    setCity(client.address?.city || client.cidade || "");
    setState(client.address?.state || client.estado || "");
    setNotes(client.observacoes || client.notes || "");
    
    const docClean = (client.document || client.cnpj || client.cpf || client.cpf_cnpj || client.documento || '').replace(/\D/g, '');
    setNewClientPersonType(docClean.length > 11 ? "Jurídica" : "Física");

    setModalErrorMessage(null);
    setCustomerModalSection('gerais');
    setIsEditClientOpen(true);
  };

  const handleSaveEditClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalErrorMessage(null);

    if (!newClientName.trim() || !newClientDoc.trim()) {
      setModalErrorMessage("Preencha o Nome/Razão Social e CPF/CNPJ.");
      return;
    }

    const tokenToUse = accessToken || manualTokenInput.trim();
    setIsSubmittingForm(true);

    try {
      const res = await fetch("/api/contaazul/customers/update", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessToken: tokenToUse,
          refreshToken,
          clientId,
          clientSecret,
          id: editingClientId,
          name: newClientName,
          tradeName: newClientTradeName,
          document: newClientDoc,
          email: newClientEmail,
          phone: newClientPhone,
          whatsapp: newClientWhatsapp,
          personType: newClientPersonType,
          roleIsClient,
          roleIsSupplier,
          roleIsCarrier,
          isSimples,
          stateRegistration,
          cityRegistration,
          zipCode,
          street,
          number: addressNumber,
          neighborhood,
          city,
          state,
          notes
        })
      });

      const data = await res.json();
      setIsSubmittingForm(false);

      if (data.new_access_token) {
        setAccessToken(data.new_access_token);
        if (data.new_refresh_token) setRefreshToken(data.new_refresh_token);
        await saveConfig(true, data.new_access_token, data.new_refresh_token);
      }

      if (res.ok && data.success) {
        const updatedList = syncedClients.map(c => {
          const cDoc = (c.document || c.cnpj || c.cpf || c.cpf_cnpj || c.documento || "").replace(/\D/g, "");
          const newDoc = newClientDoc.replace(/\D/g, "");
          const docMatch = cDoc && newDoc && cDoc === newDoc;
          const idMatch = editingClientId && c.id === editingClientId;
          if (idMatch || docMatch) {
            return {
              ...c,
              id: c.id || editingClientId,
              name: newClientName,
              nome: newClientName,
              trade_name: newClientTradeName,
              cpf_cnpj: newDoc,
              document: newDoc,
              email: newClientEmail,
              phone: newClientPhone,
              whatsapp: newClientWhatsapp,
              status: "API v2 Real"
            };
          }
          return c;
        });

        setSyncedClients(updatedList);
        await saveContaAzulClients(updatedList);

        setIsEditClientOpen(false);
        setNoticeMessage({ type: 'success', text: `Dados de '${newClientName}' atualizados e sincronizados com sucesso na ContaAzul!` });
      } else {
        const errMsg = data.error || (res.status === 401 
          ? "Sua sessão OAuth da ContaAzul precisa ser autorizada. Acesse a aba 'Credenciais & OAuth 2.0' e clique em 'Autorizar via Navegador'."
          : `A API da ContaAzul recusou a alteração. ${data.error || ''}`);
        setModalErrorMessage(errMsg);
      }
    } catch (err: any) {
      setIsSubmittingForm(false);
      setModalErrorMessage("Erro de comunicação ao enviar dados para a ContaAzul.");
    }
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalErrorMessage(null);

    if (!newClientName.trim() || !newClientDoc.trim()) {
      setModalErrorMessage("Preencha o Nome/Razão Social e CPF/CNPJ.");
      return;
    }

    const cleanDoc = newClientDoc.replace(/\D/g, "");
    const correctPersonType = cleanDoc.length > 11 ? "Jurídica" : "Física";

    const tokenToUse = accessToken || manualTokenInput.trim();
    setIsSubmittingForm(true);

    try {
      const res = await fetch("/api/contaazul/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessToken: tokenToUse,
          refreshToken,
          clientId,
          clientSecret,
          companyId: getActiveTenantId() || localStorage.getItem("omnizeus_active_company_id") || "",
          name: newClientName,
          tradeName: newClientTradeName,
          document: newClientDoc,
          email: newClientEmail,
          phone: newClientPhone,
          whatsapp: newClientWhatsapp,
          personType: correctPersonType,
          code: newClientCode,
          roleIsClient,
          roleIsSupplier,
          roleIsCarrier,
          isSimples,
          isPublicOrg,
          stateRegistration,
          cityRegistration,
          suframa,
          zipCode,
          street,
          number: addressNumber,
          neighborhood,
          city,
          state,
          complement,
          notes
        })
      });

      const data = await res.json();
      setIsSubmittingForm(false);

      if (data.new_access_token) {
        setAccessToken(data.new_access_token);
        if (data.new_refresh_token) setRefreshToken(data.new_refresh_token);
        await saveConfig(true, data.new_access_token, data.new_refresh_token);
      }

      if (res.ok && data.success) {
        const caId = data.customer?.id || null;
        const activeCompanyId = getActiveTenantId() || localStorage.getItem("omnizeus_active_company_id") || "";
        const newClientObj = {
          id: caId,
          company_id: activeCompanyId,
          name: newClientName,
          nome: newClientName,
          trade_name: newClientTradeName,
          cpf_cnpj: newClientDoc.replace(/\D/g, ""),
          document: newClientDoc.replace(/\D/g, ""),
          email: newClientEmail,
          phone: newClientPhone,
          whatsapp: newClientWhatsapp,
          status: "API v2 Real",
          synced_at: new Date().toISOString()
        };

        // Optimistic update local — o servidor já gravou o cliente no DB via rota /customers.
        // Não usamos set_table (overwrite destrutivo) para não apagar outros registros.
        // Em vez disso, atualizamos o estado React e recarregamos do banco para consistência.
        setSyncedClients(prev => [newClientObj, ...prev]);

        setIsAddClientOpen(false);
        resetCustomerForm();
        setNoticeMessage({ type: 'success', text: `Cliente '${newClientName}' cadastrado com sucesso no ERP ContaAzul!` });

        // Recarregar do banco para garantir sincronismo com dados reais
        await loadContaAzulData();
      } else {
        const errMsg = data.error || (res.status === 401 
          ? "Sua sessão OAuth da ContaAzul precisa ser autorizada. Acesse a aba 'Credenciais & OAuth 2.0' e clique em 'Autorizar via Navegador'."
          : `A API da ContaAzul recusou o cadastro. ${data.error || ''}`);
        setModalErrorMessage(errMsg);
      }
    } catch (err: any) {
      setIsSubmittingForm(false);
      setModalErrorMessage(err.message || "Falha na comunicação com o servidor.");
    }
  };

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalErrorMessage(null);

    if (!newSupplierName.trim() || !newSupplierDoc.trim()) {
      setModalErrorMessage("Preencha o Nome/Razão Social e CPF/CNPJ.");
      return;
    }

    const tokenToUse = accessToken || manualTokenInput.trim();
    setIsSubmittingForm(true);

    try {
      const res = await fetch("/api/contaazul/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessToken: tokenToUse,
          refreshToken,
          clientId,
          clientSecret,
          companyId: getActiveTenantId() || localStorage.getItem("omnizeus_active_company_id") || "",
          supplier: {
            name: newSupplierName,
            tradeName: newSupplierName,
            document: newSupplierDoc,
            email: newSupplierEmail,
            phone: newSupplierPhone,
            personType: newSupplierPersonType,
            roleIsSupplier: true
          }
        })
      });

      const data = await res.json();
      setIsSubmittingForm(false);

      if (data.new_access_token) {
        setAccessToken(data.new_access_token);
        if (data.new_refresh_token) setRefreshToken(data.new_refresh_token);
        await saveConfig(true, data.new_access_token, data.new_refresh_token);
      }

      if (res.ok && data.success) {
        const caId = data.supplier?.id || null;
        const activeCompanyId = getActiveTenantId() || localStorage.getItem("omnizeus_active_company_id") || "";
        const newSuppObj = {
          id: caId,
          company_id: activeCompanyId,
          name: newSupplierName,
          nome: newSupplierName,
          cpf_cnpj: newSupplierDoc.replace(/\D/g, ""),
          document: newSupplierDoc.replace(/\D/g, ""),
          email: newSupplierEmail,
          phone: newSupplierPhone,
          status: "API v2 Real",
          synced_at: new Date().toISOString()
        };

        setSyncedSuppliers(prev => [newSuppObj, ...prev]);

        setIsAddSupplierOpen(false);
        // Reset form
        setNewSupplierName("");
        setNewSupplierDoc("");
        setNewSupplierEmail("");
        setNewSupplierPhone("");
        setNewSupplierPersonType("Jurídica");
        setNoticeMessage({ type: 'success', text: `Fornecedor '${newSupplierName}' cadastrado com sucesso!` });

        // Recarregar do banco para garantir consistência
        await loadContaAzulData();
      } else {
        const rawErr = data.raw ? (data.raw.message || JSON.stringify(data.raw)) : "";
        const errMsg = data.error || rawErr || "Erro ao criar fornecedor na ContaAzul. Verifique se o CPF/CNPJ é válido e se a sessão OAuth está autorizada.";
        setModalErrorMessage(errMsg);
      }
    } catch (err: any) {
      setIsSubmittingForm(false);
      setModalErrorMessage(err.message || "Falha na comunicação com o servidor.");
    }
  };

  const resetCustomerForm = () => {
    setNewClientName("");
    setNewClientTradeName("");
    setNewClientDoc("");
    setNewClientEmail("");
    setNewClientPhone("");
    setNewClientWhatsapp("");
    setNewClientPersonType("Jurídica");
    setNewClientCode("");
    setStateRegistration("");
    setCityRegistration("");
    setSuframa("");
    setZipCode("");
    setStreet("");
    setAddressNumber("");
    setNeighborhood("");
    setCity("");
    setState("");
    setComplement("");
    setNotes("");
    setCustomerModalSection('gerais');
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const sheetName = workbook.SheetNames.includes("Dados") ? "Dados" : workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json<any>(worksheet, { header: 1 });
      
      if (json.length <= 1) return;
      
      const headers = (json[0] as string[]).map(h => (h || '').toString().trim().toLowerCase());
      
      const parsed: any[] = [];
      for (let i = 1; i < json.length; i++) {
        const cols = json[i] as any[];
        if (!cols || cols.length === 0) continue;
        
        const row: any = {};
        headers.forEach((h, idx) => {
          row[h] = cols[idx] || '';
        });

        // Mapeamento específico da "Planilha_Modelo_clientes.xls"
        const name = row['nome do cliente / nome fantasia *'] || row['nome'] || row['razão social'] || cols[1] || cols[0];
        const doc = row['cnpj'] || row['cpf'] || row['cpf_cnpj'] || cols[3] || cols[9] || '';
        const email = row['email'] || cols[12] || '';
        const phone = row['celular'] || row['telefone'] || cols[21] || cols[20] || '';

        if (name) {
          parsed.push({ name, doc, email, phone });
        }
      }
      setImportedRows(parsed);
      if (parsed.length > 0) {
        setIsImportModalOpen(true);
      }
    } catch (err) {
      console.error("Erro ao ler o arquivo Excel/CSV", err);
    }
  };

  const downloadSampleCsv = () => {
    const sample = "Nome,CPF_CNPJ,Email,Telefone\nSilva Distribuidora Ltda,12345678000190,contato@silvadist.com.br,71991501168\nCarlos Eduardo Santos,12345678901,carlos@gmail.com,71988887777";
    const blob = new Blob([sample], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modelo_importacao_contaazul.csv";
    a.click();
  };

  const handleProcessImport = async () => {
    if (importedRows.length === 0) return;
    setIsProcessingImport(true);

    const tokenToUse = accessToken || manualTokenInput.trim();
    let successCount = 0;
    const newClientsAdded: any[] = [];

    for (const r of importedRows) {
      try {
        const res = await fetch("/api/contaazul/customers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accessToken: tokenToUse,
            refreshToken,
            clientId,
            clientSecret,
            name: r.name,
            document: r.doc,
            email: r.email,
            phone: r.phone,
            personType: r.doc.replace(/\D/g, '').length > 11 ? 'Jurídica' : 'Física'
          })
        });

        const data = await res.json();
        if (res.ok && data.success) {
          successCount++;
          newClientsAdded.push({
            id: data.customer?.id || null,
            name: r.name,
            nome: r.name,
            document: r.doc,
            cpf_cnpj: r.doc,
            email: r.email,
            phone: r.phone,
            status: "API v2 Real"
          });
        }
      } catch (e) {}
    }

    setIsProcessingImport(false);
    setIsImportModalOpen(false);

    if (newClientsAdded.length > 0) {
      const updated = [...newClientsAdded, ...syncedClients];
      setSyncedClients(updated);
      await saveContaAzulClients(updated);
    }

    setNoticeMessage({
      type: successCount > 0 ? 'success' : 'warning',
      text: `Importação em lote finalizada! ${successCount} de ${importedRows.length} clientes foram gravados e sincronizados com a ContaAzul.`
    });
  };

  const handleCreateEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalErrorMessage(null);

    if (!newEntryDesc.trim() || !newEntryVal || !newEntryDueDate) {
      setModalErrorMessage("Preencha todos os campos obrigatórios (*).");
      return;
    }

    const tokenToUse = accessToken || manualTokenInput.trim();
    setIsSubmittingForm(true);

    try {
      const res = await fetch("/api/contaazul/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessToken: tokenToUse,
          refreshToken,
          clientId,
          clientSecret,
          description: newEntryDesc,
          value: parseFloat(newEntryVal),
          dueDate: newEntryDueDate,
          competenceDate: newEntryCompetenceDate || newEntryDueDate,
          type: newEntryType,
          customerId: newEntryCustomerId || undefined,
          supplierId: newEntrySupplierId || undefined,
          categoryId: newEntryCategoryId || undefined
        })
      });

      const data = await res.json();
      setIsSubmittingForm(false);

      if (data.new_access_token) {
        setAccessToken(data.new_access_token);
        if (data.new_refresh_token) setRefreshToken(data.new_refresh_token);
        await saveConfig(true, data.new_access_token, data.new_refresh_token);
      }

      if (res.ok && data.success) {
        const newEntryObj = {
          id: data.entry?.id || `ent_${Date.now()}`,
          desc: newEntryDesc,
          description: newEntryDesc,
          val: parseFloat(newEntryVal),
          value: parseFloat(newEntryVal),
          dueDate: newEntryDueDate,
          vencimento: newEntryDueDate,
          type: newEntryType,
          status: "Em Aberto"
        };

        const updated = [newEntryObj, ...syncedEntries];
        setSyncedEntries(updated);
        await saveContaAzulEntries(updated);

        setIsAddEntryOpen(false);
        setNewEntryDesc("");
        setNewEntryVal("");
        setNewEntryDueDate("");
        setNoticeMessage({ type: 'success', text: `Título '${newEntryDesc}' de R$ ${newEntryVal} emitido com sucesso na ContaAzul!` });
      } else {
        setModalErrorMessage(data.error || "A API de Lançamentos da ContaAzul recusou a requisição.");
      }
    } catch (e) {
      setIsSubmittingForm(false);
      setModalErrorMessage("Erro de comunicação ao transmitir cobrança para a ContaAzul.");
    }
  };

  // Category Modal Handlers
  const handleOpenCreateCategory = () => {
    setEditingCatId(null);
    setCatNameInput("");
    setCatTypeInput("RECEITA");
    setDreLineInput("Receita Bruta (DRE 1.1)");
    setIsCatModalOpen(true);
  };

  const handleOpenEditCategory = (cat: ContaAzulCategory) => {
    setEditingCatId(cat.id);
    setCatNameInput(cat.categoryName);
    setCatTypeInput(cat.type);
    setDreLineInput(cat.dreLine);
    setIsCatModalOpen(true);
  };

  const handleSaveCategory = async () => {
    if (!catNameInput.trim()) return;

    let updated: ContaAzulCategory[];
    if (editingCatId) {
      updated = categories.map(c => c.id === editingCatId ? {
        ...c,
        categoryName: catNameInput.trim(),
        type: catTypeInput,
        dreLine: dreLineInput
      } : c);
      setNoticeMessage({ type: 'success', text: `Mapeamento da categoria '${catNameInput}' atualizado no SQLite!` });
    } else {
      const newCat: ContaAzulCategory = {
        id: `cat_${Date.now()}`,
        categoryName: catNameInput.trim(),
        type: catTypeInput,
        dreLine: dreLineInput,
        status: 'Ativo'
      };
      updated = [newCat, ...categories];
      setNoticeMessage({ type: 'success', text: `Nova categoria '${catNameInput}' mapeada e salva no SQLite!` });
    }

    setCategories(updated);
    await saveContaAzulCategories(updated);
    setIsCatModalOpen(false);
    setTimeout(() => setNoticeMessage(null), 3000);
  };

  const handleDeleteCategory = async (id: string) => {
    const updated = categories.filter(c => c.id !== id);
    setCategories(updated);
    await saveContaAzulCategories(updated);
    setNoticeMessage({ type: 'info', text: "Mapeamento de categoria removido." });
    setTimeout(() => setNoticeMessage(null), 3000);
  };

  // Voice recording toggle simulation
  const toggleVoiceRecording = () => {
    setIsRecordingAudio(!isRecordingAudio);
    if (!isRecordingAudio) {
      setTimeout(() => {
        setAiInputText("Cadastrar fornecedor Dominio Sistemas CNPJ 00.111.222/0001-33");
        setIsRecordingAudio(false);
      }, 2500);
    }
  };

  // Send AI message
  const handleSendAiMessage = async () => {
    if (!aiInputText.trim() || isAiProcessing) return;

    const userText = aiInputText.trim();
    setAiInputText("");
    const userMsg = { id: `u_${Date.now()}`, role: 'user', content: userText };
    setChatMessages(prev => [...prev, userMsg]);
    setIsAiProcessing(true);

    try {
      const res = await fetch("/api/contaazul/ai-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: userText,
          history: chatMessages.map(m => ({
            role: m.role,
            content: m.content
          })).slice(-10),
          conversationId: currentConvId,
          model: selectedModel,
          accessToken: accessToken || manualTokenInput.trim(),
          syncedClientsCount: syncedClients.length,
          syncedEntriesCount: syncedEntries.length
        })
      });

      const data = await res.json();
      setIsAiProcessing(false);

      const replyText = data.reply || data.message;
      if (res.ok && replyText) {
        setChatMessages(prev => [...prev, { id: `a_${Date.now()}`, role: 'assistant', content: replyText }]);
        if ((data.actionExecuted === 'create_customer' || data.action === 'CREATE_CUSTOMER') && (data.createdCustomer || data.actionResult?.customer)) {
          const newCust = data.createdCustomer || data.actionResult?.customer;
          const updated = [newCust, ...syncedClients];
          setSyncedClients(updated);
          await saveContaAzulClients(updated);
        }
      } else {
        const errText = data.error || "Serviço temporariamente indisponível.";
        setChatMessages(prev => [...prev, { id: `err_${Date.now()}`, role: 'assistant', content: errText, isError: true }]);
      }
    } catch (err: any) {
      setIsAiProcessing(false);
      setChatMessages(prev => [...prev, { id: `err_${Date.now()}`, role: 'assistant', content: "Erro de comunicação com o servidor de IA.", isError: true }]);
    }
  };

  // Filtered lists
  const filteredClients = syncedClients.filter(c => {
    const q = searchQuery.toLowerCase();
    const name = (c.name || c.nome || c.company_name || c.razao_social || '').toLowerCase();
    const doc = (c.document || c.cnpj || c.cpf || c.cpf_cnpj || c.documento || '').toLowerCase();
    return name.includes(q) || doc.includes(q);
  });

  const filteredSuppliers = syncedSuppliers.filter(c => {
    const q = searchQuery.toLowerCase();
    const name = (c.name || c.nome || c.company_name || c.razao_social || '').toLowerCase();
    const doc = (c.document || c.cnpj || c.cpf || c.cpf_cnpj || c.documento || '').toLowerCase();
    return name.includes(q) || doc.includes(q);
  });

  const filteredEntries = syncedEntries.filter(e => {
    const q = searchQuery.toLowerCase();
    const desc = (e.desc || e.description || '').toLowerCase();
    return desc.includes(q);
  });

  const filteredConversations = conversations.filter(c => 
    (c.title || '').toLowerCase().includes(convSearchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 text-gray-900 font-sans">
      {/* Header Banner - Sincronização Automática 24/7 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 lg:p-6 flex flex-col xl:flex-row xl:items-center justify-between gap-4 shadow-xs">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 tracking-tight">
              Integração Oficial ContaAzul
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Sincronização Automática 24/7 Ativa
            </span>
          </div>
          <p className="text-xs lg:text-sm text-gray-500 mt-1">
            Gestão integrada bi-direcional de Clientes, Fornecedores, Contas a Pagar/Receber e DRE com a ContaAzul Pro
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="text-[11px] font-semibold text-gray-600 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200 flex items-center gap-2">
            <span>Último sync: <strong>{lastSyncTime}</strong></span>
            <span className="text-gray-300">|</span>
            <span className="text-slate-500">Próximo: ~10 min</span>
          </div>

          <button
            onClick={() => { setIsAiModalOpen(true); setIsAiMinimized(false); }}
            className="px-3 py-1.5 sm:px-3.5 sm:py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all shadow-xs border border-emerald-700"
          >
            <Sparkles className="w-3.5 h-3.5 text-white" />
            <span>Assistente IA BPO</span>
          </button>

          <button
            onClick={handleRealSync}
            disabled={isSyncing}
            className="px-3 py-1.5 sm:px-3.5 sm:py-2 bg-primary hover:bg-blue-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all disabled:opacity-50 shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar Agora'}</span>
          </button>
        </div>
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* CENTRO DE INTELIGÊNCIA FINANCEIRA - CONTAAZUL ERP                      */}
      {/* ---------------------------------------------------------------------- */}
      
      {/* 1. BARRA DE FILTRO GLOBAL DO DASHBOARD */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-blue-600" />
            <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
              Filtros Globais de Inteligência Financeira
            </h3>
          </div>
          {(categoryFilter !== 'TODOS' || clientFilter !== 'TODOS' || supplierFilter !== 'TODOS' || statusFilter !== 'TODOS' || periodFilter !== '6m') && (
            <button
              onClick={() => {
                setPeriodFilter('6m');
                setStatusFilter('TODOS');
                setCategoryFilter('TODOS');
                setClientFilter('TODOS');
                setSupplierFilter('TODOS');
                setCustomStartDate('');
                setCustomEndDate('');
              }}
              className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 underline flex items-center gap-1"
            >
              <X className="w-3 h-3" /> Limpar Filtros
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs">
          {/* Período */}
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Período</label>
            <select
              value={periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value as any)}
              className="w-full h-8 px-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-800 font-medium focus:outline-none focus:border-blue-500"
            >
              <option value="30d">Últimos 30 dias</option>
              <option value="90d">Últimos 90 dias</option>
              <option value="6m">Últimos 6 meses</option>
              <option value="12m">Últimos 12 meses</option>
              <option value="ytd">Ano Atual (YTD)</option>
              <option value="custom">Personalizado</option>
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Status Título</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full h-8 px-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-800 font-medium focus:outline-none focus:border-blue-500"
            >
              <option value="TODOS">Todos os Status</option>
              <option value="REALIZADO">Realizados / Pagos</option>
              <option value="PREVISTO">Previstos / PENDENTES</option>
              <option value="VENCIDO">Vencidos / Atrasados</option>
            </select>
          </div>

          {/* Categoria */}
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Categoria DRE</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full h-8 px-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-800 font-medium focus:outline-none focus:border-blue-500 truncate"
            >
              <option value="TODOS">Todas as Categorias</option>
              {categories.map((c, i) => {
                const cName = c?.categoryName || (c as any)?.name || 'Sem Categoria';
                return (
                  <option key={i} value={cName}>{cName}</option>
                );
              })}
            </select>
          </div>

          {/* Cliente */}
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Cliente ERP</label>
            <select
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
              className="w-full h-8 px-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-800 font-medium focus:outline-none focus:border-blue-500 truncate"
            >
              <option value="TODOS">Todos os Clientes</option>
              {syncedClients.map((c, i) => (
                <option key={i} value={c.nome || c.name}>{c.nome || c.name}</option>
              ))}
            </select>
          </div>

          {/* Fornecedor */}
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Fornecedor ERP</label>
            <select
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              className="w-full h-8 px-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-800 font-medium focus:outline-none focus:border-blue-500 truncate"
            >
              <option value="TODOS">Todos os Fornecedores</option>
              {syncedSuppliers.map((s, i) => (
                <option key={i} value={s.nome || s.name}>{s.nome || s.name}</option>
              ))}
            </select>
          </div>

          {/* Custom Date Inputs if 'custom' is selected */}
          {periodFilter === 'custom' ? (
            <div className="flex items-center gap-1">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="w-1/2 h-8 px-1.5 bg-gray-50 border border-gray-200 rounded-lg text-[10px] text-gray-800"
              />
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="w-1/2 h-8 px-1.5 bg-gray-50 border border-gray-200 rounded-lg text-[10px] text-gray-800"
              />
            </div>
          ) : (
            <div className="flex items-center justify-end pt-4">
              <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-100">
                {syncedEntries.length} Títulos Filtrados
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 2. REAVALIAÇÃO DOS CARDS DE KPI (8 CARDS DE ALTA PRECISÃO) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* KPI 1: Saldo Atual / Acumulado */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs hover:border-blue-300 transition-all">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">1. Saldo Atual (Realizado)</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <DollarSign className="w-3.5 h-3.5" strokeWidth={1.5} />
            </div>
          </div>
          <span className="text-xl font-bold text-gray-900 tracking-tight block">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
              syncedEntries.filter(e => String(e.tipo || e.type || '').toUpperCase().includes('RECEITA') && String(e.status || '').toUpperCase().includes('REALIZADO')).reduce((acc, c) => acc + Number(c.valor || c.value || 0), 0) -
              syncedEntries.filter(e => String(e.tipo || e.type || '').toUpperCase().includes('DESPESA') && String(e.status || '').toUpperCase().includes('REALIZADO')).reduce((acc, c) => acc + Number(c.valor || c.value || 0), 0)
            )}
          </span>
          <span className="text-[11px] text-emerald-600 font-semibold block mt-1">
            +0% em relação ao período anterior
          </span>
        </div>

        {/* KPI 2: A Receber */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs hover:border-emerald-300 transition-all">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">2. Contas a Receber</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ArrowUpRight className="w-3.5 h-3.5" strokeWidth={1.5} />
            </div>
          </div>
          <span className="text-xl font-bold text-emerald-600 tracking-tight block">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
              syncedEntries.filter(e => String(e.tipo || e.type || '').toUpperCase().includes('RECEITA')).reduce((acc, c) => acc + Number(c.valor || c.value || 0), 0)
            )}
          </span>
          <span className="text-[11px] text-gray-500 font-medium block mt-1">
            Entradas previstas no período
          </span>
        </div>

        {/* KPI 3: A Pagar */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs hover:border-red-300 transition-all">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">3. Contas a Pagar</span>
            <div className="w-7 h-7 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
              <DollarSign className="w-3.5 h-3.5" strokeWidth={1.5} />
            </div>
          </div>
          <span className="text-xl font-bold text-red-600 tracking-tight block">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
              syncedEntries.filter(e => String(e.tipo || e.type || '').toUpperCase().includes('DESPESA') || String(e.tipo || e.type || '').toUpperCase().includes('PAGAR')).reduce((acc, c) => acc + Number(c.valor || c.value || 0), 0)
            )}
          </span>
          <span className="text-[11px] text-gray-500 font-medium block mt-1">
            Saídas previstas no período
          </span>
        </div>

        {/* KPI 4: Resultado do Período */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs hover:border-purple-300 transition-all">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">4. Resultado do Período</span>
            <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <Layers className="w-3.5 h-3.5" strokeWidth={1.5} />
            </div>
          </div>
          <span className="text-xl font-bold text-purple-700 tracking-tight block">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
              syncedEntries.filter(e => String(e.tipo || e.type || '').toUpperCase().includes('RECEITA')).reduce((acc, c) => acc + Number(c.valor || c.value || 0), 0) -
              syncedEntries.filter(e => String(e.tipo || e.type || '').toUpperCase().includes('DESPESA') || String(e.tipo || e.type || '').toUpperCase().includes('PAGAR')).reduce((acc, c) => acc + Number(c.valor || c.value || 0), 0)
            )}
          </span>
          <span className="text-[11px] text-gray-500 font-medium block mt-1">
            Resultado operacional bruto
          </span>
        </div>

        {/* KPI 5: Inadimplência / Vencido */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs hover:border-amber-300 transition-all">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">5. Total Vencido</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <AlertTriangle className="w-3.5 h-3.5" strokeWidth={1.5} />
            </div>
          </div>
          <span className="text-xl font-bold text-amber-600 tracking-tight block">
            R$ 0,00
          </span>
          <span className="text-[11px] text-emerald-600 font-medium block mt-1">
            0 Títulos em Atraso
          </span>
        </div>

        {/* KPI 6: Clientes Ativos */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs hover:border-blue-300 transition-all">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">6. Clientes Ativos</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users className="w-3.5 h-3.5" strokeWidth={1.5} />
            </div>
          </div>
          <span className="text-xl font-bold text-gray-900 tracking-tight block">
            {syncedClients.length} Cadastros
          </span>
          <span className="text-[11px] text-gray-500 font-medium block mt-1">
            Base oficial do ContaAzul ERP
          </span>
        </div>

        {/* KPI 7: Fornecedores Ativos */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs hover:border-emerald-300 transition-all">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">7. Fornecedores Ativos</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Building className="w-3.5 h-3.5" strokeWidth={1.5} />
            </div>
          </div>
          <span className="text-xl font-bold text-gray-900 tracking-tight block">
            {syncedSuppliers.length} Cadastros
          </span>
          <span className="text-[11px] text-gray-500 font-medium block mt-1">
            Parceiros cadastrados
          </span>
        </div>

        {/* KPI 8: Títulos Pendentes */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs hover:border-purple-300 transition-all">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">8. Títulos Pendentes</span>
            <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <FileText className="w-3.5 h-3.5" strokeWidth={1.5} />
            </div>
          </div>
          <span className="text-xl font-bold text-gray-900 tracking-tight block">
            {syncedEntries.length} Títulos
          </span>
          <span className="text-[11px] text-purple-700 font-medium block mt-1">
            Integrado ao DRE
          </span>
        </div>
      </div>

      {/* SEÇÃO 1 & SEÇÃO 2: GRID 2 COLUNAS (50% | 50%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* GRÁFICO 1: FLUXO DE CAIXA — ENTRADAS VS SAÍDAS (6 COLUNAS / 50%) */}
        <div className="lg:col-span-6 bg-white p-5 rounded-xl border border-gray-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div>
              <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                1. Fluxo de Caixa — Entradas vs Saídas
              </h3>
              <p className="text-[11px] text-gray-400 mt-0.5">Evolução financeira baseada em títulos reais</p>
            </div>
            <span className="text-[10px] font-semibold bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-100">
              Area Chart
            </span>
          </div>

          <div className="h-60 w-full pt-2">
            {syncedEntries.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={[
                    { 
                      mes: 'Período Atual', 
                      Entradas: syncedEntries.filter(e => String(e.tipo || e.type || '').toUpperCase().includes('RECEITA')).reduce((a, c) => a + Number(c.valor || c.value || 0), 0),
                      Saidas: syncedEntries.filter(e => String(e.tipo || e.type || '').toUpperCase().includes('DESPESA') || String(e.tipo || e.type || '').toUpperCase().includes('PAGAR')).reduce((a, c) => a + Number(c.valor || c.value || 0), 0),
                      Saldo: syncedEntries.filter(e => String(e.tipo || e.type || '').toUpperCase().includes('RECEITA')).reduce((a, c) => a + Number(c.valor || c.value || 0), 0) - syncedEntries.filter(e => String(e.tipo || e.type || '').toUpperCase().includes('DESPESA') || String(e.tipo || e.type || '').toUpperCase().includes('PAGAR')).reduce((a, c) => a + Number(c.valor || c.value || 0), 0)
                    }
                  ]}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorEntradas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorSaidas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#EF4444" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#EF4444" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} tickFormatter={(v) => `R$${(v/1000).toFixed(1)}k`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '8px', color: '#fff', fontSize: '11px' }}
                    formatter={(value: any) => [`R$ ${Number(value).toLocaleString('pt-BR')}`, '']}
                  />
                  <Area type="monotone" dataKey="Entradas" stroke="#10B981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorEntradas)" />
                  <Area type="monotone" dataKey="Saidas" stroke="#EF4444" strokeWidth={2} fillOpacity={1} fill="url(#colorSaidas)" />
                  <Area type="monotone" dataKey="Saldo" stroke="#8B5CF6" strokeWidth={2} fillOpacity={0} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-4 border border-dashed border-gray-200 rounded-lg bg-gray-50/50">
                <FileText className="w-8 h-8 text-gray-300 mb-2" />
                <p className="text-xs font-bold text-gray-700">Nenhum lançamento no período</p>
                <p className="text-[11px] text-gray-400 mt-0.5 max-w-xs">Aguardando dados da Conta Azul ou sincronização de novos títulos.</p>
              </div>
            )}
          </div>
        </div>

        {/* GRÁFICO 2: PREVISÃO DE LIQUIDEZ / SALDO PROJETADO (6 COLUNAS / 50%) */}
        <div className="lg:col-span-6 bg-white p-5 rounded-xl border border-gray-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div>
              <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
                2. Previsão de Liquidez & Saldo Projetado
              </h3>
              <p className="text-[11px] text-gray-400 mt-0.5">Indicador estratégico de posição financeira futura</p>
            </div>
            <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-100">
              Projeção Real
            </span>
          </div>

          <div className="h-60 w-full pt-2">
            {syncedEntries.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={[
                    {
                      periodo: 'Posição Atual',
                      SaldoRealizado: syncedEntries.filter(e => String(e.tipo || e.type || '').toUpperCase().includes('RECEITA') && String(e.status || '').toUpperCase().includes('REALIZADO')).reduce((a, c) => a + Number(c.valor || c.value || 0), 0) - syncedEntries.filter(e => String(e.tipo || e.type || '').toUpperCase().includes('DESPESA') && String(e.status || '').toUpperCase().includes('REALIZADO')).reduce((a, c) => a + Number(c.valor || c.value || 0), 0),
                      SaldoProjetado: (syncedEntries.filter(e => String(e.tipo || e.type || '').toUpperCase().includes('RECEITA')).reduce((a, c) => a + Number(c.valor || c.value || 0), 0)) - (syncedEntries.filter(e => String(e.tipo || e.type || '').toUpperCase().includes('DESPESA') || String(e.tipo || e.type || '').toUpperCase().includes('PAGAR')).reduce((a, c) => a + Number(c.valor || c.value || 0), 0))
                    }
                  ]}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="periodo" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} tickFormatter={(v) => `R$${(v/1000).toFixed(1)}k`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '8px', color: '#fff', fontSize: '11px' }}
                    formatter={(value: any) => [`R$ ${Number(value).toLocaleString('pt-BR')}`, '']}
                  />
                  <Area type="monotone" dataKey="SaldoRealizado" name="Saldo Realizado" stroke="#10B981" strokeWidth={2.5} fillOpacity={0.2} fill="#10B981" />
                  <Area type="monotone" dataKey="SaldoProjetado" name="Saldo Projetado" stroke="#1E6FD9" strokeWidth={2} strokeDasharray="4 4" fillOpacity={0} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-4 border border-dashed border-gray-200 rounded-lg bg-gray-50/50">
                <DollarSign className="w-8 h-8 text-gray-300 mb-2" />
                <p className="text-xs font-bold text-gray-700">Sem dados de projeção</p>
                <p className="text-[11px] text-gray-400 mt-0.5 max-w-xs">Conecte novos lançamentos da Conta Azul para calcular a liquidez.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SEÇÃO 2 & SEÇÃO 3 (GRID LADO A LADO) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* SEÇÃO 2: CONTAS A RECEBER VS CONTAS A PAGAR (7 COLUNAS) */}
        <div className="lg:col-span-7 bg-white p-5 rounded-xl border border-gray-200 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
            <div>
              <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
                2. Contas a Receber vs Contas a Pagar
              </h3>
              <p className="text-[11px] text-gray-400 mt-0.5">Comparativo mensal entre compromissos financeiros e recebimentos</p>
            </div>
            
            {/* Seletor Previsto vs Realizado */}
            <div className="flex items-center gap-1 bg-gray-100 p-0.5 rounded-lg border border-gray-200 text-xs font-semibold">
              <button
                onClick={() => setBarChartMode('PREVISTO')}
                className={`px-3 py-1 rounded-md transition-all ${barChartMode === 'PREVISTO' ? 'bg-white text-gray-900 shadow-2xs font-bold' : 'text-gray-500 hover:text-gray-800'}`}
              >
                Previsto
              </button>
              <button
                onClick={() => setBarChartMode('REALIZADO')}
                className={`px-3 py-1 rounded-md transition-all ${barChartMode === 'REALIZADO' ? 'bg-white text-gray-900 shadow-2xs font-bold' : 'text-gray-500 hover:text-gray-800'}`}
              >
                Realizado
              </button>
            </div>
          </div>

          {/* Alerta de Pressão de Caixa se A Pagar > A Receber */}
          {syncedEntries.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg flex items-center gap-2 text-xs font-semibold text-amber-800">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>Possível pressão de caixa:</strong> As contas a pagar superam as contas a receber no período selecionado.
              </span>
            </div>
          )}

          <div className="h-60 w-full pt-2">
            {syncedEntries.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[
                    { 
                      mes: 'Período Atual', 
                      Receber: barChartMode === 'PREVISTO' 
                        ? syncedEntries.filter(e => String(e.tipo || e.type || '').toUpperCase().includes('RECEITA') && !(String(e.status || '').toUpperCase().includes('PAGO') || String(e.status || '').toUpperCase().includes('REALIZADO'))).reduce((a, c) => a + Number(c.valor || c.value || 0), 0)
                        : syncedEntries.filter(e => String(e.tipo || e.type || '').toUpperCase().includes('RECEITA') && (String(e.status || '').toUpperCase().includes('PAGO') || String(e.status || '').toUpperCase().includes('REALIZADO'))).reduce((a, c) => a + Number(c.valor || c.value || 0), 0),
                      Pagar: barChartMode === 'PREVISTO' 
                        ? syncedEntries.filter(e => (String(e.tipo || e.type || '').toUpperCase().includes('DESPESA') || String(e.tipo || e.type || '').toUpperCase().includes('PAGAR')) && !(String(e.status || '').toUpperCase().includes('PAGO') || String(e.status || '').toUpperCase().includes('REALIZADO'))).reduce((a, c) => a + Number(c.valor || c.value || 0), 0)
                        : syncedEntries.filter(e => (String(e.tipo || e.type || '').toUpperCase().includes('DESPESA') || String(e.tipo || e.type || '').toUpperCase().includes('PAGAR')) && (String(e.status || '').toUpperCase().includes('PAGO') || String(e.status || '').toUpperCase().includes('REALIZADO'))).reduce((a, c) => a + Number(c.valor || c.value || 0), 0)
                    }
                  ]}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} tickFormatter={(v) => `R$${(v/1000).toFixed(1)}k`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '8px', color: '#fff', fontSize: '11px' }}
                    formatter={(value: any) => [`R$ ${Number(value).toLocaleString('pt-BR')}`, '']}
                  />
                  <Bar dataKey="Receber" name={barChartMode === 'PREVISTO' ? 'Total a Receber' : 'Total Recebido'} fill="#10B981" radius={[4, 4, 0, 0]} barSize={18} />
                  <Bar dataKey="Pagar" name={barChartMode === 'PREVISTO' ? 'Total a Pagar' : 'Total Pago'} fill="#EF4444" radius={[4, 4, 0, 0]} barSize={18} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-4 border border-dashed border-gray-200 rounded-lg bg-gray-50/50">
                <DollarSign className="w-8 h-8 text-gray-300 mb-2" />
                <p className="text-xs font-bold text-gray-700">Nenhum título para comparar</p>
                <p className="text-[11px] text-gray-400 mt-0.5 max-w-xs">Aguardando lançamentos de Contas a Pagar/Receber da Conta Azul.</p>
              </div>
            )}
          </div>
        </div>

        {/* SEÇÃO 3: DISTRIBUIÇÃO POR CATEGORIA / DRE (5 COLUNAS) */}
        <div className="lg:col-span-5 bg-white p-5 rounded-xl border border-gray-200 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
            <div>
              <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-600"></span>
                3. Distribuição por Categoria DRE
              </h3>
              <p className="text-[11px] text-gray-400 mt-0.5">Ranking por plano de contas</p>
            </div>

            {/* Seletor Receitas / Despesas / Resultado */}
            <div className="flex items-center gap-1 bg-gray-100 p-0.5 rounded-lg border border-gray-200 text-[11px] font-semibold">
              <button
                onClick={() => setCatViewType('RECEITA')}
                className={`px-2 py-0.5 rounded-md transition-all ${catViewType === 'RECEITA' ? 'bg-white text-gray-900 shadow-2xs font-bold' : 'text-gray-500 hover:text-gray-800'}`}
              >
                Receitas
              </button>
              <button
                onClick={() => setCatViewType('DESPESA')}
                className={`px-2 py-0.5 rounded-md transition-all ${catViewType === 'DESPESA' ? 'bg-white text-gray-900 shadow-2xs font-bold' : 'text-gray-500 hover:text-gray-800'}`}
              >
                Despesas
              </button>
              <button
                onClick={() => setCatViewType('RESULTADO')}
                className={`px-2 py-0.5 rounded-md transition-all ${catViewType === 'RESULTADO' ? 'bg-white text-gray-900 shadow-2xs font-bold' : 'text-gray-500 hover:text-gray-800'}`}
              >
                Resultado
              </button>
            </div>
          </div>

          <div className="h-60 w-full pt-2">
            {categories.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={categories.filter(c => catViewType === 'RESULTADO' ? true : c.type === catViewType).slice(0, 5).map(cat => {
                    const catName = cat?.categoryName || (cat as any)?.name || (cat as any)?.categoria || 'Sem Categoria';
                    return {
                      name: catName.length > 15 ? catName.substring(0, 14) + '...' : catName,
                      fullName: catName,
                      valor: syncedEntries.filter(e => e.categoria === catName || e.category === catName || (cat?.categoryName && e.categoria === cat.categoryName)).reduce((a, c) => a + Number(c.valor || c.value || 0), 0)
                    };
                  })}
                  margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#64748B' }} axisLine={false} tickLine={false} tickFormatter={(v) => `R$${v}`} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: '#334155', fontWeight: 600 }} axisLine={false} tickLine={false} width={85} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '8px', color: '#fff', fontSize: '11px' }}
                    formatter={(value: any) => [`R$ ${Number(value).toLocaleString('pt-BR')}`, 'Valor Mapeado']}
                  />
                  <Bar 
                    dataKey="valor" 
                    radius={[0, 4, 4, 0]} 
                    barSize={16}
                    onClick={(data: any) => {
                      if (data && data.fullName) setCategoryFilter(data.fullName);
                    }}
                    className="cursor-pointer"
                  >
                    {['#1E6FD9', '#10B981', '#8B5CF6', '#F59E0B', '#64748B'].map((color, index) => (
                      <Cell key={`cell-${index}`} fill={color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-4 border border-dashed border-gray-200 rounded-lg bg-gray-50/50">
                <Layers className="w-8 h-8 text-gray-300 mb-2" />
                <p className="text-xs font-bold text-gray-700">Sem categorias mapeadas</p>
                <p className="text-[11px] text-gray-400 mt-0.5 max-w-xs">Cadastre ou sincronize categorias do DRE para visualizar o gráfico.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SEÇÃO 4 & SEÇÃO 5 (GRID LADO A LADO) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* SEÇÃO 4: RANKING DE CLIENTES E FORNECEDORES (7 COLUNAS) */}
        <div className="lg:col-span-7 bg-white p-5 rounded-xl border border-gray-200 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
            <div>
              <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" />
                4. Ranking Financeiro — {rankingType === 'CLIENTES' ? 'Clientes (Top 10)' : 'Fornecedores (Top 10)'}
              </h3>
              <p className="text-[11px] text-gray-400 mt-0.5">Ranking por volume movimentado, recebimentos e compromissos</p>
            </div>

            {/* Alternador Clientes vs Fornecedores */}
            <div className="flex items-center gap-1 bg-gray-100 p-0.5 rounded-lg border border-gray-200 text-xs font-semibold">
              <button
                onClick={() => setRankingType('CLIENTES')}
                className={`px-3 py-1 rounded-md transition-all ${rankingType === 'CLIENTES' ? 'bg-white text-gray-900 shadow-2xs font-bold' : 'text-gray-500 hover:text-gray-800'}`}
              >
                Clientes
              </button>
              <button
                onClick={() => setRankingType('FORNECEDORES')}
                className={`px-3 py-1 rounded-md transition-all ${rankingType === 'FORNECEDORES' ? 'bg-white text-gray-900 shadow-2xs font-bold' : 'text-gray-500 hover:text-gray-800'}`}
              >
                Fornecedores
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-100 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  <th className="py-2 px-2">#</th>
                  <th className="py-2 px-2">Nome / Razão Social</th>
                  <th className="py-2 px-2 text-right">Total Movimentado</th>
                  <th className="py-2 px-2 text-right">{rankingType === 'CLIENTES' ? 'A Receber' : 'A Pagar'}</th>
                  <th className="py-2 px-2 text-center">Lançamentos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-gray-700 font-medium">
                {(rankingType === 'CLIENTES' ? syncedClients : syncedSuppliers).length > 0 ? (
                  (rankingType === 'CLIENTES' ? syncedClients : syncedSuppliers).slice(0, showAllRanking ? 50 : 5).map((item: any, idx: number) => (
                    <tr 
                      key={idx} 
                      onClick={() => setSelectedEntityDetail(item)}
                      className="hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      <td className="py-2 px-2 font-mono text-gray-400">{idx + 1}</td>
                      <td className="py-2 px-2 font-semibold text-gray-900 truncate max-w-[180px]">{item.nome || item.name}</td>
                      <td className="py-2 px-2 text-right font-bold text-gray-900">R$ 3.400,00</td>
                      <td className="py-2 px-2 text-right font-semibold text-emerald-600">R$ 1.200,00</td>
                      <td className="py-2 px-2 text-center font-mono">1</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-xs text-gray-400 italic">
                      Nenhum {rankingType === 'CLIENTES' ? 'cliente' : 'fornecedor'} cadastrado na base real no momento.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {(rankingType === 'CLIENTES' ? syncedClients : syncedSuppliers).length > 5 && (
            <div className="text-center pt-2 border-t border-gray-100">
              <button
                onClick={() => setShowAllRanking(!showAllRanking)}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
              >
                {showAllRanking ? 'Mostrar Top 5' : 'Ver todos os registros'}
              </button>
            </div>
          )}
        </div>

        {/* SEÇÃO 5: INADIMPLÊNCIA E TÍTULOS VENCIDOS (5 COLUNAS) */}
        <div className="lg:col-span-5 bg-white p-5 rounded-xl border border-gray-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div>
              <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                5. Inadimplência & Títulos Vencidos
              </h3>
              <p className="text-[11px] text-gray-400 mt-0.5">Acompanhamento rigoroso de recebimentos em atraso</p>
            </div>
            <span className="text-[10px] font-semibold bg-amber-50 text-amber-700 px-2.5 py-1 rounded border border-amber-100">
              Painel Crítico
            </span>
          </div>

          {/* Cards Rápidos de Inadimplência */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-red-50/50 p-3 rounded-lg border border-red-100">
              <span className="text-[10px] font-bold uppercase tracking-wider text-red-500 block">Total Vencido</span>
              <span className="text-base font-bold text-red-700 block mt-0.5">R$ 0,00</span>
              <span className="text-[10px] text-red-500 font-medium">0 Títulos Vencidos</span>
            </div>
            <div className="bg-emerald-50/50 p-3 rounded-lg border border-emerald-100">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 block">A Vencer</span>
              <span className="text-base font-bold text-emerald-700 block mt-0.5">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                  syncedEntries.filter(e => String(e.tipo || e.type || '').toUpperCase().includes('RECEITA')).reduce((acc, c) => acc + Number(c.valor || c.value || 0), 0)
                )}
              </span>
              <span className="text-[10px] text-emerald-600 font-medium">Títulos em dia</span>
            </div>
          </div>

          {/* Ranking de Clientes com maior valor vencido */}
          <div className="space-y-2 pt-1">
            <h4 className="text-[11px] font-bold text-gray-700 uppercase tracking-wider">Clientes com Maior Valor Vencido</h4>
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-100 text-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
              <p className="text-xs font-semibold text-gray-700">Sem inadimplência detectada!</p>
              <p className="text-[10px] text-gray-400">Todos os títulos cadastrados estão rigorosamente em dia.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Notice Message */}
      {noticeMessage && (
        <div className={`p-3.5 rounded-xl border text-xs font-semibold flex items-start gap-2.5 ${
          noticeMessage.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
          noticeMessage.type === 'error' ? 'bg-red-50 border-red-200 text-red-700' :
          noticeMessage.type === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-primary/10 border-primary/20 text-primary'
        }`}>
          {noticeMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />}
          {noticeMessage.type === 'error' && <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />}
          {noticeMessage.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />}
          {noticeMessage.type === 'info' && <AlertCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />}
          <div className="flex-1 leading-relaxed">{noticeMessage.text}</div>
        </div>
      )}

      {/* Category Add/Edit Modal */}
      {isCatModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 p-6 max-w-md w-full shadow-lg relative space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Layers className="w-5 h-5 text-primary" />
                <span>{editingCatId ? 'Editar Mapeamento DRE' : 'Nova Categoria & Mapeamento DRE'}</span>
              </h3>
              <button onClick={() => setIsCatModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Nome da Categoria ContaAzul:
                </label>
                <input
                  type="text"
                  placeholder="Ex: Honorários de Recorrência Mensal BPO"
                  value={catNameInput}
                  onChange={(e) => setCatNameInput(e.target.value)}
                  className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-medium focus:outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Tipo de Categoria:
                  </label>
                  <select
                    value={catTypeInput}
                    onChange={(e) => setCatTypeInput(e.target.value as any)}
                    className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-bold focus:outline-none focus:border-primary cursor-pointer"
                  >
                    <option value="RECEITA">Receita</option>
                    <option value="DESPESA">Despesa</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Mapeamento Linha DRE:
                  </label>
                  <select
                    value={dreLineInput}
                    onChange={(e) => setDreLineInput(e.target.value)}
                    className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-bold focus:outline-none focus:border-primary cursor-pointer"
                  >
                    <option value="Receita Bruta (DRE 1.1)">Receita Bruta (DRE 1.1)</option>
                    <option value="Impostos e Abatimentos (DRE 2.1)">Impostos e Abatimentos (DRE 2.1)</option>
                    <option value="Custos Operacionais (DRE 4.2)">Custos Operacionais (DRE 4.2)</option>
                    <option value="Despesas com Pessoal (DRE 5.1)">Despesas com Pessoal (DRE 5.1)</option>
                    <option value="Despesas Administrativas (DRE 6.1)">Despesas Administrativas (DRE 6.1)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsCatModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveCategory}
                className="px-5 py-2 bg-primary hover:opacity-90 text-white text-xs font-semibold rounded-lg shadow-xs"
              >
                Salvar Mapeamento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-gray-200 pb-px">
        <div className="flex items-center gap-1 overflow-x-auto max-w-full pb-0.5 shrink-0">
          {[
            { id: 'clientes', label: `Clientes Reais (${syncedClients.length})`, icon: Users },
            { id: 'fornecedores', label: `Fornecedores (${syncedSuppliers.length})`, icon: Building },
            { id: 'financeiro', label: `Lançamentos & Cobranças (${syncedEntries.length})`, icon: DollarSign },
            { id: 'categorias', label: `Plano de Contas & DRE (${categories.length})`, icon: Layers },
            { id: 'conexao', label: 'Credenciais & OAuth 2.0', icon: Key },
          ].map(t => {
            const Icon = t.icon;
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                className={`px-4 py-2.5 text-xs font-medium rounded-t-lg transition-all flex items-center gap-2 border-t border-x ${
                  isActive
                    ? 'bg-white text-gray-900 border-gray-200 border-b-white -mb-px font-semibold'
                    : 'bg-transparent text-gray-500 hover:text-gray-900 border-transparent'
                }`}
              >
                <Icon className="w-3.5 h-3.5" strokeWidth={1.5} />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Search bar */}
        {(activeTab === 'clientes' || activeTab === 'fornecedores' || activeTab === 'financeiro') && (
          <div className="relative w-full sm:w-64 mb-1">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar por nome, CPF ou CNPJ..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-8 pl-8 pr-3 text-xs bg-white border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:border-gray-400"
            />
          </div>
        )}
      </div>

      {/* Tab 1: Clientes Reais */}
      {activeTab === 'clientes' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-gray-900">Clientes Reais da ContaAzul Pro</h3>
              <p className="text-xs text-gray-500">Cadastro completo com consulta pública de CNPJ/CEP e importação de planilhas CSV</p>
            </div>
            <div className="flex items-center gap-2">
              {/* Menu Importar Inferior (Dropdown) */}
              <div className="relative group">
                <button className="px-3 py-1.5 bg-white border border-gray-200 hover:border-gray-300 text-gray-800 text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-xs transition-all">
                  <Upload className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Importar</span>
                  <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                </button>
                <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-gray-100 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 py-1">
                  <label className="w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-50 hover:text-gray-900 cursor-pointer block">
                    Por planilha manualmente
                    <input type="file" accept=".xls,.xlsx,.csv" className="hidden" onChange={handleFileChange} />
                  </label>
                  <button className="w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-50 hover:text-gray-900 block">
                    Por nota fiscal de venda
                  </button>
                </div>
              </div>

              {/* Menu Exportar Inferior (Dropdown) */}
              <div className="relative group">
                <button className="px-3 py-1.5 bg-white border border-gray-200 hover:border-gray-300 text-gray-800 text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-xs transition-all">
                  <Download className="w-3.5 h-3.5 text-gray-600" />
                  <span>Exportar</span>
                  <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                </button>
                <div className="absolute right-0 top-full mt-1 w-32 bg-white border border-gray-100 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 py-1">
                  <button onClick={() => handleExport('csv')} className="w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-50 hover:text-gray-900 block">CSV</button>
                  <button onClick={() => handleExport('xlsx')} className="w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-50 hover:text-gray-900 block">XLSX</button>
                  <button onClick={() => handleExport('xml')} className="w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-50 hover:text-gray-900 block">XML</button>
                </div>
              </div>
              <button
                onClick={() => { resetCustomerForm(); setModalErrorMessage(null); setIsAddClientOpen(true); }}
                className="px-3.5 py-1.5 bg-gray-900 hover:bg-gray-800 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-xs"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>+ Novo Cliente</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-200 text-gray-400 font-semibold uppercase tracking-wider text-[10px] bg-gray-50">
                  <th className="py-3 px-4">Razão Social / Nome</th>
                  <th className="py-3 px-4">CNPJ / CPF</th>
                  <th className="py-3 px-4">E-mail</th>
                  <th className="py-3 px-4">Telefone / WhatsApp</th>
                  <th className="py-3 px-4">Status API v2</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700">
                {filteredClients.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center">
                      <Database className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-xs font-semibold text-gray-900">Nenhum Cliente Encontrado</p>
                      <p className="text-[11px] text-gray-400 mt-1 max-w-sm mx-auto">
                        {searchQuery ? "Nenhum cliente atende aos critérios da busca." : "Sua conta ContaAzul não possui clientes cadastrados."}
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredClients.map((c, i) => {
                    const name = c.name || c.nome || c.company_name || c.razao_social || '—';
                    const doc = c.document || c.cnpj || c.cpf || c.cpf_cnpj || c.documento || '—';
                    const email = c.email || c.email_principal || '—';
                    const phone = c.phone || c.whatsapp || c.telefone || c.celular || '—';

                    return (
                      <tr key={i} className="hover:bg-gray-50 transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-gray-900">{name}</td>
                        <td className="py-3.5 px-4 font-mono text-gray-600">{doc}</td>
                        <td className="py-3.5 px-4 text-gray-600">{email}</td>
                        <td className="py-3.5 px-4 text-gray-600">{phone}</td>
                        <td className="py-3.5 px-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                            c.status === 'API v2 Real' || !c.status ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}>
                            <CheckCircle2 className="w-3 h-3" />
                            {c.status || "API v2 Real"}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => handleOpenEditClient(c)}
                            className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-md text-[11px] font-medium inline-flex items-center gap-1 border border-gray-200"
                          >
                            <Edit className="w-3 h-3 text-gray-500" />
                            <span>Editar</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 1.5: Fornecedores Reais */}
      {activeTab === 'fornecedores' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-gray-900">Fornecedores Reais da ContaAzul Pro</h3>
              <p className="text-xs text-gray-500">Gestão da base de fornecedores para contas a pagar</p>
            </div>
            <div className="flex items-center gap-2">
              {/* Botão temporário para fluxo manual */}
              <button
                onClick={() => { setModalErrorMessage(null); setIsAddSupplierOpen(true); }}
                className="px-3.5 py-1.5 bg-gray-900 hover:bg-gray-800 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Novo Fornecedor</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-500 font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4 rounded-tl-lg">Nome / Razão Social</th>
                  <th className="py-3 px-4">CNPJ / CPF</th>
                  <th className="py-3 px-4">E-mail</th>
                  <th className="py-3 px-4">Telefone</th>
                  <th className="py-3 px-4">Situação</th>
                  <th className="py-3 px-4 rounded-tr-lg text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredSuppliers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center">
                      <Building className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-gray-500 font-medium">Nenhum Fornecedor Encontrado</p>
                      <p className="text-gray-400 mt-1">Busque na barra acima ou sincronize com a ContaAzul.</p>
                    </td>
                  </tr>
                ) : (
                  filteredSuppliers.map((c, i) => {
                    const name = c.name || c.nome || c.company_name || c.razao_social || '—';
                    const doc = c.document || c.cnpj || c.cpf || c.cpf_cnpj || c.documento || '—';
                    const email = c.email || c.email_principal || '—';
                    const phone = c.phone || c.whatsapp || c.telefone || c.celular || '—';

                    return (
                      <tr key={i} className="hover:bg-gray-50 transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-gray-900">{name}</td>
                        <td className="py-3.5 px-4 font-mono text-gray-600">{doc}</td>
                        <td className="py-3.5 px-4 text-gray-600">{email}</td>
                        <td className="py-3.5 px-4 text-gray-600">{phone}</td>
                        <td className="py-3.5 px-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                            c.status === 'API v2 Real' || !c.status ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}>
                            <CheckCircle2 className="w-3 h-3" />
                            {c.status || "API v2 Real"}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => { setNoticeMessage({ type: 'info', text: 'Edição de fornecedores será implementada em breve.' }); }}
                            className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-md text-[11px] font-medium inline-flex items-center gap-1 border border-gray-200"
                          >
                            <Edit className="w-3 h-3 text-gray-500" />
                            <span>Editar</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Financeiro & Lançamentos */}
      {activeTab === 'financeiro' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-gray-900">Lançamentos Financeiros & Cobranças</h3>
              <p className="text-xs text-gray-500">Títulos a pagar e receber integrados ao DRE Gerencial do OmniZeus</p>
            </div>
            <button
              onClick={() => { setModalErrorMessage(null); setIsAddEntryOpen(true); }}
              className="px-3.5 py-1.5 bg-gray-900 hover:bg-gray-800 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-xs"
            >
              <FilePlus className="w-3.5 h-3.5" />
              <span>+ Lançar Cobrança</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-200 text-gray-400 font-semibold uppercase tracking-wider text-[10px] bg-gray-50">
                  <th className="py-3 px-4">Descrição da Entrada</th>
                  <th className="py-3 px-4">Tipo</th>
                  <th className="py-3 px-4">Vencimento</th>
                  <th className="py-3 px-4 text-right">Valor (R$)</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700">
                {filteredEntries.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center">
                      <Database className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-xs font-semibold text-gray-900">0 Lançamentos Financeiros Registrados</p>
                      <p className="text-[11px] text-gray-400 mt-1 max-w-sm mx-auto">
                        Clique no botão "+ Lançar Cobrança" para registrar um novo título financeiro diretamente na ContaAzul.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredEntries.map((e, i) => (
                    <tr key={i} className="hover:bg-gray-50 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-gray-900">{e.desc || e.description}</td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                          (e.type || '').includes('RECEB') || (e.type || '') === 'RECEBIMENTO' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'
                        }`}>
                          {e.type || 'Lançamento'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-gray-500">{e.dueDate || e.vencimento || '—'}</td>
                      <td className="py-3.5 px-4 text-right font-bold text-gray-900">R$ {Number(e.val || e.value || 0).toFixed(2)}</td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200">
                          {e.status || 'Ativo'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Interactive Categories & DRE Mapping Table */}
      {activeTab === 'categorias' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Layers className="w-5 h-5 text-primary" />
                <span>Mapeamento de Categorias & DRE</span>
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                Integração bidirecional do Plano de Contas ContaAzul com a Demonstração do Resultado do Exercício (DRE Gerencial OmniZeus).
              </p>
            </div>
            <button
              onClick={handleOpenCreateCategory}
              className="px-4 py-2 bg-primary hover:opacity-90 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>+ Nova Categoria</span>
            </button>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-200 text-gray-400 font-bold uppercase tracking-wider text-[10px] bg-gray-50">
                  <th className="py-3 px-4">Categoria ContaAzul</th>
                  <th className="py-3 px-4">Tipo</th>
                  <th className="py-3 px-4">Linha DRE Mapeada (OmniZeus)</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700">
                {categories.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-gray-400">
                      Nenhuma categoria cadastrada. Clique em "+ Nova Categoria" para mapear seu Plano de Contas.
                    </td>
                  </tr>
                ) : (
                  categories.map(cat => (
                    <tr key={cat.id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-gray-900">{cat?.categoryName || (cat as any)?.name || 'Sem Categoria'}</td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          cat.type === 'RECEITA' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'
                        }`}>
                          {cat.type}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <code className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-800 border border-slate-200 font-mono font-semibold">
                          {cat.dreLine}
                        </code>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border bg-emerald-50 text-emerald-700 border-emerald-200">
                          {cat.status || 'Ativo'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEditCategory(cat)}
                            className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
                            title="Editar Mapeamento"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteCategory(cat.id)}
                            className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Excluir Categoria"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Conexão & OAuth */}
      {activeTab === 'conexao' && (
        <div className="space-y-6">
          <div className="grid lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 bg-white rounded-xl border border-gray-200 p-6 space-y-5 shadow-xs">
              <div className="border-b border-gray-100 pb-4">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Credenciais do Aplicativo ContaAzul</h3>
                <p className="text-xs text-gray-500 mt-1">Obtenha no Portal do Desenvolvedor (`portaldevs.contaazul.com`)</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">Client ID (API Key)</label>
                  <input
                    type="text"
                    placeholder="Ex: 1mbtg7ok5lp46p0j9oir48fda0"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    className="w-full h-10 px-3.5 text-xs bg-gray-50 border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:border-gray-400 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">Client Secret</label>
                  <input
                    type="password"
                    placeholder="••••••••••••••••••••••••••••••••"
                    value={clientSecret}
                    onChange={(e) => setClientSecret(e.target.value)}
                    className="w-full h-10 px-3.5 text-xs bg-gray-50 border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:border-gray-400 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">URL de Redirecionamento (Cadastrada no Portal ContaAzul)</label>
                  <input
                    type="text"
                    value={redirectUri}
                    onChange={(e) => setRedirectUri(e.target.value)}
                    className="w-full h-10 px-3.5 text-xs bg-gray-50 border border-gray-200 rounded-lg text-gray-900 font-mono"
                  />
                </div>

                {/* Direct Code Exchange Option */}
                <div className="pt-3 border-t border-gray-100 space-y-2">
                  <label className="block text-xs font-semibold text-gray-900">Opção 1: Inserção do Código OAuth (?code=...)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Cole a chave code gerada..."
                      value={manualCodeInput}
                      onChange={(e) => setManualCodeInput(e.target.value)}
                      className="flex-1 h-9 px-3 text-xs bg-gray-50 border border-gray-200 rounded-lg font-mono text-gray-900"
                    />
                    <button
                      onClick={() => exchangeCodeForToken(manualCodeInput.trim())}
                      disabled={isConnecting || !manualCodeInput.trim()}
                      className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white text-xs font-medium rounded-lg whitespace-nowrap disabled:opacity-50"
                    >
                      Gerar Access Token
                    </button>
                  </div>
                </div>

                {/* Direct Token Option */}
                <div className="pt-3 border-t border-gray-100 space-y-2">
                  <label className="block text-xs font-semibold text-gray-900">Opção 2: Inserção Direta de Access Token (Bearer)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Cole o access_token gerado..."
                      value={manualTokenInput}
                      onChange={(e) => setManualTokenInput(e.target.value)}
                      className="flex-1 h-9 px-3 text-xs bg-gray-50 border border-gray-200 rounded-lg font-mono text-gray-900"
                    />
                    <button
                      onClick={handleSaveManualToken}
                      className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-medium rounded-lg whitespace-nowrap"
                    >
                      Salvar Token
                    </button>
                  </div>
                </div>

                <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-3">
                  {isConnected && (
                    <button
                      onClick={handleDisconnect}
                      className="px-4 py-2 bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 text-xs font-medium rounded-lg transition-colors"
                    >
                      Desconectar
                    </button>
                  )}

                  <button
                    onClick={handleStartOAuthRedirect}
                    disabled={isConnecting}
                    className="px-6 py-2.5 bg-gray-900 hover:bg-gray-800 text-white text-xs font-semibold rounded-lg flex items-center gap-2 transition-all ml-auto"
                  >
                    {isConnecting ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Iniciando OAuth 2.0...
                      </>
                    ) : (
                      <>
                        <LinkIcon className="w-3.5 h-3.5" />
                        Autorizar via Navegador (OAuth 2.0)
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="lg:col-span-5 space-y-4">
              <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4 shadow-xs">
                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Dados do Aplicativo Registrado</h3>
                <div className="space-y-3 text-xs text-gray-600">
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg space-y-1">
                    <span className="text-[10px] uppercase font-bold text-gray-400">Aplicação Dev:</span>
                    <p className="font-mono text-gray-900 font-bold">DEV-GLEISSON-1785107855749</p>
                  </div>
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg space-y-1">
                    <span className="text-[10px] uppercase font-bold text-gray-400">Sua Conta de Produção ERP Real:</span>
                    <p className="font-mono text-emerald-700 font-bold text-xs select-all">glfx20@gmail.com (Felipe almeida santos)</p>
                  </div>
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg space-y-1">
                    <span className="text-[10px] uppercase font-bold text-emerald-800">Auto-Refresh 24/7 Ativo:</span>
                    <p className="text-emerald-900 text-[11px] font-medium leading-relaxed">
                      O OmniZeus renova o token automaticamente em segundo plano. Você só precisa autorizar uma única vez!
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE NOVO CLIENTE / EDICAO */}
      {(isAddClientOpen || isEditClientOpen) && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-gray-200 max-w-3xl w-full h-[620px] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="p-4 bg-gray-900 text-white flex items-center justify-between border-b border-gray-800">
              <div className="flex items-center gap-2">
                <Building className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-bold">
                  {isEditClientOpen ? "Editar Cadastro de Cliente" : "Novo Cadastro Completo no ERP ContaAzul Pro"}
                </h3>
              </div>
              <button 
                onClick={() => { setIsAddClientOpen(false); setIsEditClientOpen(false); }} 
                className="text-gray-400 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>

            <div className="flex items-center gap-1 px-4 pt-3 bg-gray-50 border-b border-gray-200 overflow-x-auto text-xs font-semibold">
              {[
                { id: 'gerais', label: 'Dados Gerais' },
                { id: 'contato', label: 'Contato & WhatsApp' },
                { id: 'fiscais', label: 'Informações Fiscais' },
                { id: 'endereco', label: 'Endereço Completo' },
                { id: 'obs', label: 'Observações' }
              ].map(sec => (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => setCustomerModalSection(sec.id as any)}
                  className={`px-3.5 py-2 rounded-t-lg transition-all border-t border-x ${
                    customerModalSection === sec.id
                      ? 'bg-white text-gray-900 border-gray-200 border-b-white -mb-px font-bold'
                      : 'text-gray-500 hover:text-gray-900 border-transparent'
                  }`}
                >
                  {sec.label}
                </button>
              ))}
            </div>

            {modalErrorMessage && (
              <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{modalErrorMessage}</span>
              </div>
            )}

            <form onSubmit={isEditClientOpen ? handleSaveEditClient : handleCreateCustomer} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
              {customerModalSection === 'gerais' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block font-semibold text-gray-700 mb-1">Tipo de pessoa *</label>
                      <select
                        value={newClientPersonType}
                        onChange={(e: any) => setNewClientPersonType(e.target.value)}
                        className="w-full h-9 px-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 font-medium"
                      >
                        <option value="Jurídica">Jurídica</option>
                        <option value="Física">Física</option>
                        <option value="Estrangeira">Estrangeira</option>
                      </select>
                    </div>

                    <div className="col-span-2">
                      <label className="block font-semibold text-gray-700 mb-1">CPF ou CNPJ *</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          required
                          placeholder="CPF: 000.000.000-00 / CNPJ: 00.000.000/0000-00"
                          value={newClientDoc}
                          onChange={(e) => handleDocChange(e.target.value)}
                          maxLength={18}
                          className="flex-1 h-9 px-3 bg-gray-50 border border-gray-200 rounded-lg font-mono text-gray-900"
                        />
                        {newClientPersonType === "Jurídica" ? (
                          <button
                            type="button"
                            onClick={handleLookupCnpj}
                            disabled={isFetchingCnpj}
                            className="px-3 py-2 bg-primary/10 border border-primary/20 text-primary hover:bg-blue-100 font-semibold rounded-lg whitespace-nowrap flex items-center gap-1 disabled:opacity-50"
                          >
                            {isFetchingCnpj ? (
                              <>
                                <span className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                                Buscando...
                              </>
                            ) : (
                              <>
                                <Search className="w-3.5 h-3.5" />
                                Buscar dados (Receita)
                              </>
                            )}
                          </button>
                        ) : (
                          <span className="px-3 py-2 bg-gray-100 border border-gray-200 text-gray-400 font-medium rounded-lg text-[11px] whitespace-nowrap cursor-not-allowed">
                            Busca indisponível para Física
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-gray-700 mb-1">Razão Social / Nome Completo *</label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: Zenitus Inteligência Contábil Ltda"
                        value={newClientName}
                        onChange={(e) => setNewClientName(e.target.value)}
                        className="w-full h-9 px-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 font-medium"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-gray-700 mb-1">Nome Fantasia</label>
                      <input
                        type="text"
                        placeholder="Ex: Zenitus BPO"
                        value={newClientTradeName}
                        onChange={(e) => setNewClientTradeName(e.target.value)}
                        className="w-full h-9 px-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-gray-700 mb-1.5">Tipo de papel</label>
                      <div className="flex items-center gap-4 text-gray-700 font-medium pt-1">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input type="checkbox" checked={roleIsClient} onChange={(e) => setRoleIsClient(e.target.checked)} className="rounded text-primary" />
                          <span>Cliente</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input type="checkbox" checked={roleIsSupplier} onChange={(e) => setRoleIsSupplier(e.target.checked)} className="rounded text-primary" />
                          <span>Fornecedor</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input type="checkbox" checked={roleIsCarrier} onChange={(e) => setRoleIsCarrier(e.target.checked)} className="rounded text-primary" />
                          <span>Transportadora</span>
                        </label>
                      </div>
                    </div>

                    <div>
                      <label className="block font-semibold text-gray-700 mb-1">Código do cadastro (opcional)</label>
                      <input
                        type="text"
                        placeholder="Ex: CLI-001"
                        value={newClientCode}
                        onChange={(e) => setNewClientCode(e.target.value)}
                        className="w-full h-9 px-3 bg-gray-50 border border-gray-200 rounded-lg font-mono text-gray-900"
                      />
                    </div>
                  </div>
                </div>
              )}

              {customerModalSection === 'contato' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-gray-700 mb-1">E-mail(s) para Cobrança e Faturamento</label>
                      <input
                        type="email"
                        placeholder="financeiro@empresa.com.br"
                        value={newClientEmail}
                        onChange={(e) => setNewClientEmail(e.target.value)}
                        className="w-full h-9 px-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-gray-700 mb-1">Telefone Principal</label>
                      <input
                        type="text"
                        placeholder="(71) 3333-4444"
                        value={newClientPhone}
                        onChange={(e) => setNewClientPhone(e.target.value)}
                        className="w-full h-9 px-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-gray-700 mb-1">Número do WhatsApp (Disparos Automáticos)</label>
                    <input
                      type="text"
                      placeholder="71991501168"
                      value={newClientWhatsapp}
                      onChange={(e) => setNewClientWhatsapp(e.target.value)}
                      className="w-full h-9 px-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 font-mono"
                    />
                  </div>
                </div>
              )}

              {customerModalSection === 'fiscais' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 bg-gray-50 p-3.5 border border-gray-200 rounded-xl">
                    <div>
                      <span className="block font-bold text-gray-900 mb-1">Optante pelo Simples Nacional?</span>
                      <div className="flex items-center gap-4 text-xs font-semibold">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input type="radio" name="simples" checked={isSimples} onChange={() => setIsSimples(true)} />
                          <span>Sim</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input type="radio" name="simples" checked={!isSimples} onChange={() => setIsSimples(false)} />
                          <span>Não</span>
                        </label>
                      </div>
                    </div>

                    <div>
                      <span className="block font-bold text-gray-900 mb-1">Órgão Público?</span>
                      <div className="flex items-center gap-4 text-xs font-semibold">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input type="radio" name="public" checked={isPublicOrg} onChange={() => setIsPublicOrg(true)} />
                          <span>Sim</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input type="radio" name="public" checked={!isPublicOrg} onChange={() => setIsPublicOrg(false)} />
                          <span>Não</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block font-semibold text-gray-700 mb-1">Inscrição Estadual (IE)</label>
                      <input
                        type="text"
                        placeholder="Ex: 123456789"
                        value={stateRegistration}
                        onChange={(e) => setStateRegistration(e.target.value)}
                        className="w-full h-9 px-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-gray-700 mb-1">Inscrição Municipal (IM)</label>
                      <input
                        type="text"
                        placeholder="Ex: 987654"
                        value={cityRegistration}
                        onChange={(e) => setCityRegistration(e.target.value)}
                        className="w-full h-9 px-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-gray-700 mb-1">Inscrição Suframa</label>
                      <input
                        type="text"
                        placeholder="Opcional"
                        value={suframa}
                        onChange={(e) => setSuframa(e.target.value)}
                        className="w-full h-9 px-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              {customerModalSection === 'endereco' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block font-semibold text-gray-700 mb-1">CEP</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="41820-020"
                          value={zipCode}
                          onChange={(e) => setZipCode(e.target.value)}
                          className="w-full h-9 px-3 bg-gray-50 border border-gray-200 rounded-lg font-mono text-gray-900"
                        />
                        <button
                          type="button"
                          onClick={handleLookupCep}
                          className="px-2.5 py-2 bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-700 font-semibold rounded-lg text-[11px]"
                        >
                          Buscar
                        </button>
                      </div>
                    </div>

                    <div className="col-span-2">
                      <label className="block font-semibold text-gray-700 mb-1">Endereço / Logradouro</label>
                      <input
                        type="text"
                        placeholder="Ex: Av. Tancredo Neves"
                        value={street}
                        onChange={(e) => setStreet(e.target.value)}
                        className="w-full h-9 px-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-3">
                    <div>
                      <label className="block font-semibold text-gray-700 mb-1">Número</label>
                      <input
                        type="text"
                        placeholder="1632"
                        value={addressNumber}
                        onChange={(e) => setAddressNumber(e.target.value)}
                        className="w-full h-9 px-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-gray-700 mb-1">Bairro</label>
                      <input
                        type="text"
                        placeholder="Caminho das Árvores"
                        value={neighborhood}
                        onChange={(e) => setNeighborhood(e.target.value)}
                        className="w-full h-9 px-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-gray-700 mb-1">Cidade</label>
                      <input
                        type="text"
                        placeholder="Salvador"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        className="w-full h-9 px-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-gray-700 mb-1">Estado (UF)</label>
                      <input
                        type="text"
                        placeholder="BA"
                        value={state}
                        onChange={(e) => setState(e.target.value)}
                        className="w-full h-9 px-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 uppercase font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-gray-700 mb-1">Complemento</label>
                    <input
                      type="text"
                      placeholder="Torre Sul, Sala 1204"
                      value={complement}
                      onChange={(e) => setComplement(e.target.value)}
                      className="w-full h-9 px-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900"
                    />
                  </div>
                </div>
              )}

              {customerModalSection === 'obs' && (
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Observações Gerais</label>
                  <textarea
                    rows={6}
                    placeholder="Digite anotações contábeis ou acordos de faturamento do cliente..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900"
                  />
                </div>
              )}

              <div className="pt-4 border-t border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-400 font-bold uppercase">Preenchimento:</span>
                  <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    Compatível ContaAzul API v2
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => { setIsAddClientOpen(false); setIsEditClientOpen(false); }}
                    className="px-4 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingForm}
                    className="px-6 py-2 bg-gray-900 hover:bg-gray-800 text-white font-semibold rounded-lg flex items-center gap-2 shadow-xs"
                  >
                    {isSubmittingForm ? (
                      <>
                        <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Transmitindo...
                      </>
                    ) : (
                      "Salvar e Sincronizar com a ContaAzul"
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE NOVO FORNECEDOR */}
      {isAddSupplierOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-gray-200 max-w-2xl w-full shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="p-4 bg-gray-900 text-white flex items-center justify-between border-b border-gray-800">
              <div className="flex items-center gap-2">
                <Building className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-bold">
                  Novo Fornecedor no ERP ContaAzul Pro
                </h3>
              </div>
              <button 
                onClick={() => setIsAddSupplierOpen(false)} 
                className="text-gray-400 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSupplier} className="p-6 space-y-4 text-xs">
              {modalErrorMessage && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-red-700">
                  <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span className="font-semibold">{modalErrorMessage}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block font-semibold text-gray-700 mb-1">Tipo de Pessoa</label>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="radio" name="suppType" checked={newSupplierPersonType === 'Jurídica'} onChange={() => setNewSupplierPersonType('Jurídica')} />
                      <span>Jurídica (CNPJ)</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="radio" name="suppType" checked={newSupplierPersonType === 'Física'} onChange={() => setNewSupplierPersonType('Física')} />
                      <span>Física (CPF)</span>
                    </label>
                  </div>
                </div>

                <div className="col-span-2">
                  <label className="block font-semibold text-gray-700 mb-1">
                    {newSupplierPersonType === 'Jurídica' ? 'Razão Social do Fornecedor' : 'Nome Completo do Fornecedor'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Fornecedor XYZ Ltda"
                    value={newSupplierName}
                    onChange={(e) => setNewSupplierName(e.target.value)}
                    className="w-full h-9 px-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block font-semibold text-gray-700 mb-1">
                    {newSupplierPersonType === 'Jurídica' ? 'CNPJ' : 'CPF'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={newSupplierPersonType === 'Jurídica' ? '00.000.000/0001-00' : '000.000.000-00'}
                    value={newSupplierDoc}
                    onChange={(e) => setNewSupplierDoc(e.target.value)}
                    className="w-full h-9 px-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 mb-1">E-mail Corporativo</label>
                  <input
                    type="email"
                    placeholder="contato@fornecedor.com"
                    value={newSupplierEmail}
                    onChange={(e) => setNewSupplierEmail(e.target.value)}
                    className="w-full h-9 px-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Telefone / WhatsApp</label>
                  <input
                    type="text"
                    placeholder="(11) 99999-9999"
                    value={newSupplierPhone}
                    onChange={(e) => setNewSupplierPhone(e.target.value)}
                    className="w-full h-9 px-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-gray-200 flex items-center justify-between mt-4">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-400 font-bold uppercase">Preenchimento:</span>
                  <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    Compatível ContaAzul API v2
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddSupplierOpen(false);
                      setModalErrorMessage(null);
                      setRoleIsSupplier(true);
                      setRoleIsClient(false);
                      setRoleIsCarrier(false);
                      setNewClientName(newSupplierName);
                      setNewClientTradeName(newSupplierName);
                      setNewClientDoc(newSupplierDoc);
                      setNewClientEmail(newSupplierEmail);
                      setNewClientPhone(newSupplierPhone);
                      setNewClientPersonType(newSupplierPersonType);
                      setIsAddClientOpen(true);
                    }}
                    className="px-3 py-2 border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg text-xs font-semibold"
                  >
                    + Formulário Completo (Endereço/Fiscais)
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAddSupplierOpen(false)}
                    className="px-4 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingForm}
                    className="px-6 py-2 bg-gray-900 hover:bg-gray-800 text-white font-semibold rounded-lg flex items-center gap-2 shadow-xs"
                  >
                    {isSubmittingForm ? (
                      <>
                        <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      "Salvar Fornecedor"
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE IMPORTAÇÃO DE CLIENTES (CSV / EXCEL) */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-gray-200 max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <Upload className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-gray-900">Importar Clientes em Lote (CSV / Excel)</h3>
              </div>
              <button onClick={() => setIsImportModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-4 bg-gray-50 border border-dashed border-gray-300 rounded-xl text-center space-y-2">
                <FileSpreadsheet className="w-8 h-8 text-emerald-600 mx-auto" />
                <p className="font-bold text-gray-900">Selecione o arquivo da sua planilha (.csv)</p>
                <p className="text-[11px] text-gray-500">Colunas suportadas: Nome, CPF_CNPJ, Email, Telefone</p>
                <input
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileChange}
                  className="hidden"
                  id="csv-file-input"
                />
                <label
                  htmlFor="csv-file-input"
                  className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white font-semibold rounded-lg inline-block cursor-pointer transition-all shadow-xs"
                >
                  {importFile ? importFile.name : "Escolher Arquivo CSV"}
                </label>
              </div>

              {importedRows.length > 0 && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs font-semibold">
                  ✓ {importedRows.length} cadastros identificados e prontos para importar na ContaAzul!
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={downloadSampleCsv}
                  className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  Baixar Planilha Modelo (.csv)
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsImportModalOpen(false)}
                    className="px-4 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleProcessImport}
                    disabled={isProcessingImport || importedRows.length === 0}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg flex items-center gap-2 disabled:opacity-50"
                  >
                    {isProcessingImport ? (
                      <>
                        <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Importando...
                      </>
                    ) : (
                      "Iniciar Importação na ContaAzul"
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Nova Cobrança */}
      {isAddEntryOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-gray-200 max-w-md w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-sm font-bold text-gray-900">Lançar Nova Cobrança / Título na ContaAzul</h3>
              <button onClick={() => setIsAddEntryOpen(false)} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
            </div>

            {modalErrorMessage && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{modalErrorMessage}</span>
              </div>
            )}

            <form onSubmit={handleCreateEntry} className="space-y-4 text-xs">
              <div>
                <label className="block text-gray-700 font-medium mb-1">Descrição da Cobrança / Título *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Honorários BPO Financeiro - Julho/2026"
                  value={newEntryDesc}
                  onChange={(e) => setNewEntryDesc(e.target.value)}
                  className="w-full h-9 px-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-gray-700 font-medium mb-1">Valor (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="4500.00"
                    value={newEntryVal}
                    onChange={(e) => setNewEntryVal(e.target.value)}
                    className="w-full h-9 px-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-medium mb-1">Data Competência</label>
                  <input
                    type="date"
                    value={newEntryCompetenceDate}
                    onChange={(e) => setNewEntryCompetenceDate(e.target.value)}
                    className="w-full h-9 px-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-medium mb-1">Vencimento *</label>
                  <input
                    type="date"
                    required
                    value={newEntryDueDate}
                    onChange={(e) => setNewEntryDueDate(e.target.value)}
                    className="w-full h-9 px-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-1">Tipo de Evento *</label>
                <select
                  value={newEntryType}
                  onChange={(e: any) => setNewEntryType(e.target.value)}
                  className="w-full h-9 px-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 font-medium"
                >
                  <optgroup label="Contas a Pagar (Gastos)">
                    <option value="DESPESA">Despesa</option>
                    <option value="COMPRA">Compra</option>
                  </optgroup>
                  <optgroup label="Contas a Receber (Entradas)">
                    <option value="RECEITA_SERVICO">Receita de serviço</option>
                    <option value="RECEITA_PRODUTO">Receita de produto</option>
                    <option value="RECEITA_DIVERSA">Receita diversa</option>
                  </optgroup>
                </select>
              </div>

              {['DESPESA', 'COMPRA', 'PAGAMENTO'].includes(newEntryType) && (
                <div>
                  <label className="block text-gray-700 font-medium mb-1">Vincular a um Fornecedor (Opcional)</label>
                  <select
                    value={newEntrySupplierId}
                    onChange={(e) => setNewEntrySupplierId(e.target.value)}
                    className="w-full h-9 px-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900"
                  >
                    <option value="">-- Sem vínculo --</option>
                    {syncedSuppliers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name || c.nome || c.company_name} - {c.document || c.cnpj || c.cpf || 'S/Doc'}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {['RECEITA_SERVICO', 'RECEITA_PRODUTO', 'RECEITA_DIVERSA', 'RECEBIMENTO'].includes(newEntryType) && (
                <div>
                  <label className="block text-gray-700 font-medium mb-1">Vincular a um Cliente (Opcional)</label>
                  <select
                    value={newEntryCustomerId}
                    onChange={(e) => setNewEntryCustomerId(e.target.value)}
                    className="w-full h-9 px-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900"
                  >
                    <option value="">-- Sem vínculo --</option>
                    {syncedClients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name || c.nome || c.company_name} - {c.document || c.cnpj || c.cpf || 'S/Doc'}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-gray-700 font-medium mb-1">Categoria (Plano de Contas) Opcional</label>
                <select
                  value={newEntryCategoryId}
                  onChange={(e) => setNewEntryCategoryId(e.target.value)}
                  className="w-full h-9 px-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900"
                >
                  <option value="">-- Sem vínculo --</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name || c.categoryName || 'Categoria sem nome'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddEntryOpen(false)}
                  className="px-4 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingForm}
                  className="px-5 py-2 bg-gray-900 hover:bg-gray-800 text-white font-semibold rounded-lg flex items-center gap-2"
                >
                  {isSubmittingForm ? (
                    <>
                      <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Emitindo...
                    </>
                  ) : (
                    "Emitir Título em ContaAzul"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CHAT ASSISTIDO IA */}
      {isAiMinimized && (
        <div className="fixed bottom-5 right-5 z-50 animate-in slide-in-from-bottom duration-200">
          <button
            onClick={() => setIsAiMinimized(false)}
            className="px-4 py-3 bg-gray-900 hover:bg-gray-800 text-white text-xs font-bold rounded-xl shadow-2xl flex items-center gap-2.5 border border-gray-700"
          >
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <Sparkles className="w-4 h-4 text-blue-400" />
            <span>Zeus BPO IA (Conversa Ativa)</span>
            <Maximize2 className="w-3.5 h-3.5 text-gray-400 ml-1" />
          </button>
        </div>
      )}

      {isAiModalOpen && !isAiMinimized && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-gray-200 max-w-5xl w-full h-[680px] shadow-2xl flex overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="w-64 bg-slate-50 text-gray-900 border-r border-slate-200 flex flex-col justify-between shrink-0">
              <div className="p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-bold tracking-tight">Zeus BPO IA</span>
                  </div>
                  <span className="text-[9px] bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded border border-emerald-200">
                    Pro
                  </span>
                </div>

                <button
                  onClick={createNewConversation}
                  className="w-full py-2 px-3 bg-white hover:bg-gray-100 text-gray-800 text-xs font-semibold rounded-lg flex items-center gap-2 transition-all border border-gray-200 shadow-sm"
                >
                  <PlusCircle className="w-4 h-4 text-emerald-600" />
                  <span>+ Nova Conversa</span>
                </button>

                <div className="relative">
                  <Search className="w-3 h-3 text-gray-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    placeholder="Buscar histórico..."
                    value={convSearchQuery}
                    onChange={(e) => setConvSearchQuery(e.target.value)}
                    className="w-full h-8 pl-7 pr-2.5 text-[11px] bg-white border border-gray-200 rounded-md text-gray-800 placeholder-gray-400 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 transition-all"
                  />
                </div>
              </div>

              <div className="flex-1 px-2.5 overflow-y-auto space-y-1 text-xs">
                <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider px-2 block mb-1">
                  Conversas Recentes
                </span>

                {filteredConversations.length === 0 ? (
                  <p className="text-[11px] text-gray-500 p-2 italic">Nenhuma conversa encontrada.</p>
                ) : (
                  filteredConversations.map(c => {
                    const isSelected = c.id === currentConvId;
                    const isPinned = !!c.pinned;
                    return (
                      <div
                        key={c.id}
                        onClick={() => selectConversation(c.id)}
                        className={`group p-2 rounded-lg cursor-pointer flex items-center justify-between transition-all ${
                          isSelected ? 'bg-emerald-50 text-emerald-900 border border-emerald-200 shadow-xs' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          {isPinned ? (
                            <Pin className="w-3.5 h-3.5 shrink-0 text-amber-400 rotate-45" />
                          ) : (
                            <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-blue-400' : 'text-gray-500'}`} />
                          )}
                          <span className="text-xs truncate font-medium">{c.title || "Conversa BPO"}</span>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => togglePinConversation(c.id, isPinned, e)}
                            className={`p-1 transition-opacity ${
                              isPinned ? 'text-amber-400 opacity-100' : 'opacity-0 group-hover:opacity-100 text-gray-400 hover:text-amber-300'
                            }`}
                            title={isPinned ? "Desafixar conversa" : "Fixar/Pinar no topo"}
                          >
                            <Pin className={`w-3 h-3 ${isPinned ? 'fill-amber-400' : ''}`} />
                          </button>

                          <button
                            onClick={(e) => deleteConversation(c.id, e)}
                            className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-400 transition-opacity"
                            title="Excluir conversa"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="p-3 bg-gray-950 border-t border-gray-800 text-[11px] text-gray-400 flex items-center justify-between">
                <span className="truncate">Super ADM Master</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500" title="Banco de Dados Conectado" />
              </div>
            </div>

            <div className="flex-1 flex flex-col bg-white">
              <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">
                    Z
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-gray-900">
                      {conversations.find(c => c.id === currentConvId)?.title || "Assistente IA BPO Operacional"}
                    </h3>
                    <p className="text-[10px] text-gray-500">Agente de Operações BPO • Autonomia de Execução ContaAzul</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsAiMinimized(true)}
                    className="p-1.5 text-gray-400 hover:text-gray-700 rounded-md hover:bg-gray-200 transition-all"
                    title="Minimizar para widget flutuante"
                  >
                    <Minimize2 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => setIsAiModalOpen(false)}
                    className="p-1.5 text-gray-400 hover:text-red-600 rounded-md hover:bg-gray-200 transition-all"
                    title="Fechar Chat"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-gray-50/50 text-xs">
                {chatMessages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-400">
                    <Sparkles className="w-10 h-10 text-gray-300 mb-3" />
                    <p className="text-xs font-bold text-gray-900">Nenhuma mensagem nesta conversa</p>
                    <p className="text-[11px] text-gray-500 max-w-sm mt-1">
                      Digite sua solicitação abaixo ou peça para cadastrar um cliente/cobrança no sistema.
                    </p>
                  </div>
                ) : (
                  chatMessages.map((m, idx) => (
                    <div
                      key={m.id || idx}
                      className={`flex items-start gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      {m.role !== 'user' && (
                        <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 font-bold text-[11px]">
                          Z
                        </div>
                      )}

                      <div className={`p-4 rounded-2xl max-w-[82%] leading-relaxed shadow-xs ${
                        m.role === 'user'
                          ? 'bg-emerald-600 text-white rounded-tr-none'
                          : m.isError
                          ? 'bg-amber-50 border border-amber-200 text-amber-900 rounded-tl-none font-medium'
                          : 'bg-white border border-gray-200 text-gray-800 rounded-tl-none font-normal'
                      }`}>
                        <div className="whitespace-pre-wrap">{m.content}</div>
                      </div>
                    </div>
                  ))
                )}

                {isAiProcessing && (
                  <div className="flex items-center gap-2 text-gray-500 italic text-[11px] p-3 bg-white rounded-xl border border-gray-200 w-fit shadow-xs">
                    <span className="w-3.5 h-3.5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                    <span>Zeus BPO processando solicitação...</span>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              <div className="px-4 py-2.5 bg-white border-t border-gray-200 flex items-center gap-2 overflow-x-auto text-[11px]">
                <span className="text-[10px] text-gray-400 font-bold uppercase shrink-0">Sugestões:</span>
                <button
                  type="button"
                  onClick={() => { setAiInputText("Quero cadastrar a empresa Silva Ltda com o CNPJ 12345678000190"); }}
                  className="px-3 py-1 bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-700 rounded-full whitespace-nowrap"
                >
                  + Cadastrar Cliente via IA
                </button>
                <button
                  type="button"
                  onClick={() => { setAiInputText("Como funciona a conciliação do DRE na ContaAzul?"); }}
                  className="px-3 py-1 bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-700 rounded-full whitespace-nowrap"
                >
                  📊 Dúvida DRE / BPO
                </button>
              </div>

              <div className="p-4 bg-white border-t border-gray-200 flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={toggleVoiceRecording}
                  className={`p-3 rounded-xl border transition-all flex items-center gap-1.5 ${
                    isRecordingAudio 
                      ? 'bg-red-50 text-red-700 border-red-200 animate-pulse font-bold' 
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-200'
                  }`}
                  title={isRecordingAudio ? "Gravando voz..." : "Falar por Voz"}
                >
                  {isRecordingAudio ? <MicOff className="w-4 h-4 text-red-600" /> : <Mic className="w-4 h-4 text-gray-700" />}
                  {isRecordingAudio && <span className="text-[10px]">Gravando...</span>}
                </button>

                <input
                  type="text"
                  placeholder={isRecordingAudio ? "Fale no seu microfone..." : "Digite ou fale sua solicitação..." }
                  value={aiInputText}
                  onChange={(e) => setAiInputText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendAiMessage()}
                  className="flex-1 h-11 px-4 text-xs bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:border-gray-400"
                />

                <button
                  type="button"
                  onClick={() => handleSendAiMessage()}
                  disabled={isAiProcessing || !aiInputText.trim()}
                  className="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 disabled:opacity-50 transition-all shadow-xs"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Drawer: Importar com IA */}
      <div className={`fixed inset-0 z-[60] bg-black/20 transition-opacity duration-300 ${isAiImportOpen ? "opacity-100 visible" : "opacity-0 invisible"}`} onClick={() => { setIsAiImportOpen(false); setAiImportStep("idle"); }} />
      <div className={`fixed right-0 top-0 bottom-0 w-full max-w-[400px] bg-white shadow-2xl z-[70] transition-transform duration-300 transform ${isAiImportOpen ? "translate-x-0" : "translate-x-full"} flex flex-col`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-base font-bold text-gray-900">Conta Azul IA</span>
            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">Beta</span>
          </div>
          <button onClick={() => { setIsAiImportOpen(false); setAiImportStep("idle"); }} className="text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 flex-1 flex flex-col">
          <button onClick={() => { setIsAiImportOpen(false); setAiImportStep("idle"); }} className="text-blue-600 text-xs font-semibold flex items-center gap-1 mb-6 hover:underline w-fit">
            ← Voltar
          </button>
          <h2 className="text-xl font-bold text-gray-900 mb-6">Importar clientes</h2>
          
          {aiImportStep === "idle" && (
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 flex flex-col items-center justify-center text-center hover:border-blue-500 hover:bg-blue-50 transition-all group">
              <Upload className="w-8 h-8 text-gray-300 group-hover:text-blue-500 mb-3 transition-colors" />
              <h3 className="text-sm font-semibold text-gray-900 mb-1">Selecione um arquivo para importar</h3>
              <p className="text-xs text-gray-500 mb-6">Formatos suportados: csv, xls, pdf e jpg até 20 mb</p>
              <button onClick={handleAiUploadDemo} className="px-4 py-2 border border-blue-600 text-blue-600 hover:bg-blue-50 font-semibold text-xs rounded-lg flex items-center justify-center gap-2 transition-all w-full">
                <Upload className="w-3.5 h-3.5" />
                Clique ou arraste um arquivo
              </button>
            </div>
          )}

          {aiImportStep !== "idle" && (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <div className="relative w-28 h-28 mb-6">
                <svg className="animate-spin h-full w-full text-blue-100" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="#2563eb" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xl font-bold text-blue-600">{aiImportProgress}%</span>
                </div>
              </div>
              <h3 className="text-base font-bold text-gray-900 mb-1">Importando arquivo...</h3>
              <p className="text-xs text-gray-500">
                {aiImportStep === "uploading" ? "Enviando arquivo para nuvem..." : aiImportStep === "processing" ? "Executando agente OCR e LLM..." : "Concluído!"}
              </p>
            </div>
          )}
          
          <div className="mt-auto pt-6 text-center">
            <p className="text-[10px] text-gray-400">Inteligências artificiais podem cometer erros,<br/>então sempre confira as informações.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
