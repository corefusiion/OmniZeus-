"use client";

import { useState, useEffect, useMemo } from "react";
import { 
  Shield, Key, TrendingUp, AlertTriangle, Save, CheckCircle2, Crown, 
  CreditCard, Cpu, DollarSign, Users, Building2, Plus, Link as LinkIcon, MessageSquare, Trash2, Bot, Sparkles, RefreshCw, Check, X,
  Briefcase, ShieldCheck, UserPlus, Globe, Server, Coins, Activity, BarChart2, Layers, FileText, Zap, Play, Calculator, AlertCircle, ArrowUpDown,
  KeyRound, Copy
} from "lucide-react";
import { 
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, 
  CartesianGrid, Tooltip, PieChart, Pie, Cell 
} from "recharts";
import { getActiveRole, getCurrentUser, UserRole } from "@/lib/auth/roles";
import { 
  getCompanies, saveCompany, CompanyProfile, 
  getEmployees, saveEmployee, EmployeeUser, ALL_SYSTEM_MODULES 
} from "@/lib/company/store";
import { fetchServerSettings, updateServerSettings, fetchServerTable, fetchCustomJobRoles, saveCustomJobRoles } from "@/lib/db/serverDb";
import { generateTemporaryPassword, hashPassword } from "@/lib/auth/passwordUtils";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import BatchUserUpload from "@/components/employees/BatchUserUpload";

const DEFAULT_JOB_ROLES = [
  "Diretoria Contábil",
  "Gestor de Escritório",
  "Analista Fiscal Sênior",
  "Analista Contábil Pleno",
  "Assistente de Departamento Pessoal",
  "Auxiliar Administrativo & BPO",
  "Consultor Tributário & SPED",
  "Auditor de Compliance Fiscal"
];

export default function SuperADMPage() {
  const [role, setRole] = useState<UserRole | null>(null);
  const [activeTab, setActiveTab] = useState<'economia_ia' | 'infraestrutura' | 'pedidos_compra'>('pedidos_compra');
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [provisioningOrderId, setProvisioningOrderId] = useState<string | null>(null);
  const [provisionResult, setProvisionResult] = useState<{ success: boolean; message: string; credentials?: any } | null>(null);
  const [selectedOrderForView, setSelectedOrderForView] = useState<any | null>(null);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<any | null>(null);
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Purchase Orders Filter & Search State
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>("ALL");
  const [orderOriginFilter, setOrderOriginFilter] = useState<string>("ALL");
  const [orderDatePeriod, setOrderDatePeriod] = useState<string>("ALL");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");
  const [orderSearchQuery, setOrderSearchQuery] = useState<string>("");

  const filteredPurchaseOrders = useMemo(() => {
    return purchaseOrders.filter((order) => {
      // 0. Origin Filter
      if (orderOriginFilter !== "ALL") {
        const source = order.origin_source || "landing_page";
        if (orderOriginFilter !== source) return false;
      }

      // 1. Status Filter
      if (orderStatusFilter !== "ALL") {
        if (orderStatusFilter === "PENDENTE_PAGAMENTO" && order.status !== "PENDENTE_PAGAMENTO") return false;
        if (orderStatusFilter === "PAGAMENTO_CONFIRMADO" && order.status !== "PAGAMENTO_CONFIRMADO") return false;
        if (orderStatusFilter === "PROVISIONADO" && order.status !== "PROVISIONADO") return false;
        if (orderStatusFilter === "CANCELADO" && order.status !== "CANCELADO") return false;
        if (orderStatusFilter === "EXPIRADO" && order.status !== "EXPIRADO") return false;
      }

      // 2. Date Period Filter
      if (orderDatePeriod !== "ALL" && order.created_at) {
        const orderDate = new Date(order.created_at);
        const now = new Date();
        if (orderDatePeriod === "TODAY") {
          const isToday =
            orderDate.getDate() === now.getDate() &&
            orderDate.getMonth() === now.getMonth() &&
            orderDate.getFullYear() === now.getFullYear();
          if (!isToday) return false;
        } else if (orderDatePeriod === "LAST_7_DAYS") {
          const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          if (orderDate < sevenDaysAgo) return false;
        } else if (orderDatePeriod === "LAST_30_DAYS") {
          const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          if (orderDate < thirtyDaysAgo) return false;
        } else if (orderDatePeriod === "CUSTOM") {
          if (customStartDate) {
            const start = new Date(customStartDate);
            if (orderDate < start) return false;
          }
          if (customEndDate) {
            const end = new Date(customEndDate);
            end.setHours(23, 59, 59, 999);
            if (orderDate > end) return false;
          }
        }
      }

      // 3. Search Query Filter (Tolerant & case-insensitive)
      if (orderSearchQuery.trim()) {
        const q = orderSearchQuery.trim().toLowerCase();
        const idMatch = (order.id || "").toLowerCase().includes(q);
        const numMatch = (order.order_number || "").toLowerCase().includes(q);
        const compMatch = (order.empresa_nome || "").toLowerCase().includes(q);
        const cnpjMatch = (order.empresa_cnpj || "").toLowerCase().includes(q);
        const respMatch = (order.responsavel_nome || "").toLowerCase().includes(q);
        const emailMatch = (order.responsavel_email || "").toLowerCase().includes(q);

        if (!idMatch && !numMatch && !compMatch && !cnpjMatch && !respMatch && !emailMatch) {
          return false;
        }
      }

      return true;
    });
  }, [purchaseOrders, orderStatusFilter, orderDatePeriod, customStartDate, customEndDate, orderSearchQuery]);

  // Usage Calculator State (Simulação de Uso)
  const [simEmployees, setSimEmployees] = useState<number>(15);
  const [simQueriesPerDay, setSimQueriesPerDay] = useState<number>(3);
  const simWorkingDays = 22;

  // 100-Call Test Suite State
  const [isTesting100Calls, setIsTesting100Calls] = useState(false);
  const [test100Result, setTest100Result] = useState<any | null>(null);
  
  // Master API Keys State (SQL DB Backed)
  const [stripeSecretKey, setStripeSecretKey] = useState("sk_live_51M********************************");
  const [stripePublishableKey, setStripePublishableKey] = useState("pk_live_51M********************************");
  const [stripeWebhookSecret, setStripeWebhookSecret] = useState("");
  const [openRouterMasterKey, setOpenRouterMasterKey] = useState("");
  const [openRouterEnabled, setOpenRouterEnabled] = useState(true);
  const [evolutionUrl, setEvolutionUrl] = useState("https://api.whatsapp.zenitus.com.br");
  const [evolutionApiKey, setEvolutionApiKey] = useState("evo_key_master_998877");

  // LobeHub / Lobe AI Integration State
  const [lobeHubEnabled, setLobeHubEnabled] = useState(true);
  const [lobeHubServerUrl, setLobeHubServerUrl] = useState("https://lobe.ai/api/v1");
  const [lobeHubApiKey, setLobeHubApiKey] = useState("sk-lobe-ai-master-998811");
  const [lobeDefaultModel, setLobeDefaultModel] = useState("lobe-gpt-4o-mini");
  
  // Custom AI Endpoint State
  const [customAiEnabled, setCustomAiEnabled] = useState(true);
  const [customAiUrl, setCustomAiUrl] = useState("http://localhost:20128/v1");
  const [customAiKey, setCustomAiKey] = useState("sk-641103a4808c7841-1424a6-87f45f0d");
  const [customAiModel, setCustomAiModel] = useState("auto");

  // OpenRouter Connection Test State
  const [isTestingOpenRouter, setIsTestingOpenRouter] = useState(false);
  const [openRouterTestResult, setOpenRouterTestResult] = useState<{ success: boolean; message: string; modelsCount?: number } | null>(null);

  // Individual Saving Loading States
  const [savingOpenRouter, setSavingOpenRouter] = useState(false);
  const [savingCustomAi, setSavingCustomAi] = useState(false);
  const [savingLobeHub, setSavingLobeHub] = useState(false);
  const [savingEvolution, setSavingEvolution] = useState(false);
  const [savingStripe, setSavingStripe] = useState(false);
  const [savingCompany, setSavingCompany] = useState(false);
  const [savingUser, setSavingUser] = useState(false);

  // Individual Success Notices
  const [lobeSuccess, setLobeSuccess] = useState(false);
  const [openRouterSuccess, setOpenRouterSuccess] = useState(false);
  const [evolutionSuccess, setEvolutionSuccess] = useState(false);
  const [stripeSuccess, setStripeSuccess] = useState(false);
  const [customAiSuccess, setCustomAiSuccess] = useState(false);
  const [companySuccess, setCompanySuccess] = useState(false);
  const [createdUserTempPassModal, setCreatedUserTempPassModal] = useState<{ password: string; name: string; email: string } | null>(null);
  const [copyPassSuccess, setCopyPassSuccess] = useState(false);

  // Multi-Tenant Company Creation State
  const [companies, setCompanies] = useState<CompanyProfile[]>([]);
  const [newCorpName, setNewCorpName] = useState("");
  const [newCnpj, setNewCnpj] = useState("");
  const [newCity, setNewCity] = useState("Salvador");
  const [newState, setNewState] = useState("BA");
  const [newPlan, setNewPlan] = useState<'Profissional' | 'Premium' | 'Business'>('Premium');
  const [newCoins, setNewCoins] = useState(15000);

  // Job Roles & Custom Role Creation Modal State
  const [jobRoles, setJobRoles] = useState<string[]>(DEFAULT_JOB_ROLES);
  const [showAddRoleModal, setShowAddRoleModal] = useState(false);
  const [newRoleInput, setNewRoleInput] = useState("");

  // Rich User Creation for Company State
  const [allEmployees, setAllEmployees] = useState<EmployeeUser[]>([]);
  const [targetCompanyId, setTargetCompanyId] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserBirthDate, setNewUserBirthDate] = useState("");
  const [newUserRole, setNewUserRole] = useState<'gestor' | 'funcionario'>('gestor');
  const [newUserDept, setNewUserDept] = useState("Diretoria Contábil");
  const [selectedUserModules, setSelectedUserModules] = useState<string[]>(['omni-ia', 'financeiro', 'contaazul', 'tarefas', 'documentos']);
  // FinOps Real DB State & Operational Costs
  const [aiUsageLogs, setAiUsageLogs] = useState<any[]>([]);
  const [serverCost, setServerCost] = useState<number>(150);
  const [dbCost, setDbCost] = useState<number>(80);
  const [storageCost, setStorageCost] = useState<number>(40);
  const [whatsappCost, setWhatsappCost] = useState<number>(90);
  const [emailCost, setEmailCost] = useState<number>(30);
  const [monitoringCost, setMonitoringCost] = useState<number>(20);
  const [supportCost, setSupportCost] = useState<number>(100);
  const [otherCost, setOtherCost] = useState<number>(50);
  const [allocationMethod, setAllocationMethod] = useState<'fixed_per_company' | 'proportional_split'>('fixed_per_company');
  const [isOpCostConfigured, setIsOpCostConfigured] = useState<boolean>(true);
  const [savingOpCosts, setSavingOpCosts] = useState<boolean>(false);
  const [opCostSuccess, setOpCostSuccess] = useState<boolean>(false);

  // Super Admin Dedicated AI Provider Selector
  const [superAdminAiProvider, setSuperAdminAiProvider] = useState<'openrouter_master' | 'custom_endpoint'>('openrouter_master');
  const [superAdminAutoFallback, setSuperAdminAutoFallback] = useState<boolean>(false);
  const [savingSuperAdminProvider, setSavingSuperAdminProvider] = useState<boolean>(false);
  const [superAdminProviderSuccess, setSuperAdminProviderSuccess] = useState<boolean>(false);

  // Company OpenRouter Key Management Modal State
  const [selectedCompForAi, setSelectedCompForAi] = useState<CompanyProfile | null>(null);
  const [compApiKeyInput, setCompApiKeyInput] = useState<string>("");
  const [testingCompKey, setTestingCompKey] = useState<boolean>(false);
  const [savingCompKey, setSavingCompKey] = useState<boolean>(false);
  const [removingCompKey, setRemovingCompKey] = useState<boolean>(false);
  const [compKeyTestNotice, setCompKeyTestNotice] = useState<{ success: boolean; message: string } | null>(null);
  const [showRemoveCompKeyModal, setShowRemoveCompKeyModal] = useState<boolean>(false);

  // Table Sorting & Chart Period
  const [finOpsSortBy, setFinOpsSortBy] = useState<'receita' | 'custo_ia' | 'custo_plataforma' | 'lucro' | 'margem'>('lucro');
  const [finOpsSortOrder, setFinOpsSortOrder] = useState<'asc' | 'desc'>('desc');
  const [finOpsPeriod, setFinOpsPeriod] = useState<'7d' | '30d' | '90d' | '6m' | '12m'>('30d');

  const [warningMessage, setWarningMessage] = useState<string | null>(null);

  useEffect(() => {
    if (getCurrentUser().id) setRole(getActiveRole());
    const listComp = getCompanies();
    setCompanies(listComp);
    if (listComp.length > 0) setTargetCompanyId(listComp[0].id);
    setAllEmployees(getEmployees());

    fetchCustomJobRoles().then((savedRoles) => {
      if (savedRoles && savedRoles.length > 0) setJobRoles(savedRoles);
    }).catch(() => {});

    // Load master settings & usage logs directly from local SQL Database file
    async function loadSqlSettings() {
      const [s, usageLogs] = await Promise.all([
        fetchServerSettings(),
        fetchServerTable('ai_usage_logs')
      ]);

      if (Array.isArray(usageLogs)) {
        setAiUsageLogs(usageLogs);
      }

      if (s) {
        if (s.openrouter_enabled !== undefined) setOpenRouterEnabled(s.openrouter_enabled);
        if (s.openrouter_api_key) setOpenRouterMasterKey(s.openrouter_api_key);
        if (s.lobehub_url) setLobeHubServerUrl(s.lobehub_url);
        if (s.lobehub_api_key) setLobeHubApiKey(s.lobehub_api_key);
        if (s.lobehub_model) setLobeDefaultModel(s.lobehub_model);
        if (s.evolution_url) setEvolutionUrl(s.evolution_url);
        if (s.evolution_api_key) setEvolutionApiKey(s.evolution_api_key);
        if (s.stripe_pub_key) setStripePublishableKey(s.stripe_pub_key);
        if (s.stripe_secret_key) setStripeSecretKey(s.stripe_secret_key);
        if (s.stripe_webhook_secret) setStripeWebhookSecret(s.stripe_webhook_secret);
        if (s.custom_ai_enabled !== undefined) setCustomAiEnabled(s.custom_ai_enabled);
        if (s.custom_ai_url) setCustomAiUrl(s.custom_ai_url);
        if (s.custom_ai_key) setCustomAiKey(s.custom_ai_key);
        if (s.custom_ai_model) setCustomAiModel(s.custom_ai_model);
        if (s.super_admin_ai_provider) setSuperAdminAiProvider(s.super_admin_ai_provider);
        if (s.super_admin_auto_fallback !== undefined) setSuperAdminAutoFallback(s.super_admin_auto_fallback);

        if (s.platform_operational_costs) {
          setIsOpCostConfigured(true);
          const op = s.platform_operational_costs;
          if (op.allocation_method) setAllocationMethod(op.allocation_method);
          if (op.detailed_costs) {
            setServerCost(op.detailed_costs.server || 0);
            setDbCost(op.detailed_costs.db || 0);
            setStorageCost(op.detailed_costs.storage || 0);
            setWhatsappCost(op.detailed_costs.whatsapp || 0);
            setEmailCost(op.detailed_costs.email || 0);
            setMonitoringCost(op.detailed_costs.monitoring || 0);
            setSupportCost(op.detailed_costs.support || 0);
            setOtherCost(op.detailed_costs.other || 0);
          }
        }
      }
    }
    loadSqlSettings();
    loadPurchaseOrders();

    const handleRoleChange = () => setRole(getActiveRole());
    const handleCompChange = () => {
      const updated = getCompanies();
      setCompanies(updated);
      if (!targetCompanyId && updated.length > 0) setTargetCompanyId(updated[0].id);
    };
    const handleEmpChange = () => setAllEmployees(getEmployees());

    window.addEventListener("omnizeus_role_change", handleRoleChange);
    window.addEventListener("omnizeus_companies_change", handleCompChange);
    window.addEventListener("omnizeus_employees_change", handleEmpChange);

    return () => {
      window.removeEventListener("omnizeus_role_change", handleRoleChange);
      window.removeEventListener("omnizeus_companies_change", handleCompChange);
      window.removeEventListener("omnizeus_employees_change", handleEmpChange);
    };
  }, []);

  const loadPurchaseOrders = async () => {
    setLoadingOrders(true);
    try {
      const res = await fetch("/api/db?table=purchase_orders");
      if (res.ok) {
        const json = await res.json();
        setPurchaseOrders(json.data || []);
      }
    } catch (err) {
      console.error("Error loading purchase orders:", err);
    } finally {
      setLoadingOrders(false);
    }
  };

  const handleProvisionOrder = async (orderId: string) => {
    setProvisioningOrderId(orderId);
    try {
      const res = await fetch("/api/super-adm/orders/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: orderId })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setProvisionResult(data);
        await loadPurchaseOrders();
        setCompanies(getCompanies());
      } else {
        setWarningMessage(data.error || "Erro ao provisionar empresa.");
      }
    } catch (err: any) {
      setWarningMessage(err.message || "Falha na conexão de provisionamento.");
    } finally {
      setProvisioningOrderId(null);
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    setDeletingOrderId(orderId);
    try {
      const res = await fetch("/api/super-adm/orders/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: orderId })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setWarningMessage(null);
        setSuccessMessage(data.message || "Pedido excluído com sucesso.");
        setTimeout(() => setSuccessMessage(null), 4000);
        await loadPurchaseOrders();
      } else {
        setWarningMessage(data.error || "Erro ao excluir pedido.");
      }
    } catch (err: any) {
      setWarningMessage(err.message || "Falha na conexão ao excluir pedido.");
    } finally {
      setDeletingOrderId(null);
      setOrderToDelete(null);
    }
  };

  const handleCreateNewRole = () => {
    if (!newRoleInput.trim()) {
      setWarningMessage("Por favor, digite o nome do novo cargo.");
      return;
    }
    const roleTitle = newRoleInput.trim();
    if (!jobRoles.includes(roleTitle)) {
      const updated = [...jobRoles, roleTitle];
      setJobRoles(updated);
      saveCustomJobRoles(updated).catch(() => {});
      setNewUserDept(roleTitle);
    }
    setNewRoleInput("");
    setShowAddRoleModal(false);
  };

  const handleSaveLobeHub = async () => {
    setSavingLobeHub(true);
    const ok = await updateServerSettings({
      lobehub_url: lobeHubServerUrl,
      lobehub_api_key: lobeHubApiKey,
      lobehub_model: lobeDefaultModel
    });
    setSavingLobeHub(false);
    if (ok) {
      setLobeSuccess(true);
      setTimeout(() => setLobeSuccess(false), 2500);
    }
  };

  const handleSaveOpCosts = async () => {
    setSavingOpCosts(true);
    const totalDetailed = serverCost + dbCost + storageCost + whatsappCost + emailCost + monitoringCost + supportCost + otherCost;
    const ok = await updateServerSettings({
      platform_operational_costs: {
        fixed_monthly_cost_per_company: totalDetailed,
        detailed_costs: {
          server: serverCost,
          db: dbCost,
          storage: storageCost,
          whatsapp: whatsappCost,
          email: emailCost,
          monitoring: monitoringCost,
          support: supportCost,
          other: otherCost
        },
        allocation_method: allocationMethod,
        updated_at: new Date().toISOString()
      }
    });
    setSavingOpCosts(false);
    if (ok) {
      setIsOpCostConfigured(true);
      setOpCostSuccess(true);
      setTimeout(() => setOpCostSuccess(false), 2500);
    }
  };

  const handleSaveCustomAi = async () => {
    setSavingCustomAi(true);
    const ok = await updateServerSettings({
      custom_ai_enabled: customAiEnabled,
      custom_ai_url: customAiUrl.trim(),
      custom_ai_key: customAiKey.trim(),
      custom_ai_model: customAiModel.trim()
    });
    setSavingCustomAi(false);
    if (ok) {
      setCustomAiSuccess(true);
      setTimeout(() => setCustomAiSuccess(false), 2500);
    }
  };

  const handleSaveSuperAdminProvider = async () => {
    setSavingSuperAdminProvider(true);
    const ok = await updateServerSettings({
      super_admin_ai_provider: superAdminAiProvider,
      super_admin_auto_fallback: superAdminAutoFallback
    });
    setSavingSuperAdminProvider(false);
    if (ok) {
      setSuperAdminProviderSuccess(true);
      setTimeout(() => setSuperAdminProviderSuccess(false), 2500);
    }
  };

  const handleTestCompanyOpenRouterKey = async () => {
    if (!selectedCompForAi || !compApiKeyInput.trim()) {
      setCompKeyTestNotice({ success: false, message: "Por favor, digite a chave API para testar." });
      return;
    }
    setTestingCompKey(true);
    try {
      const res = await fetch("/api/openrouter/company/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: selectedCompForAi.id, apiKey: compApiKeyInput.trim() })
      });
      const data = await res.json();
      setTestingCompKey(false);
      setCompKeyTestNotice({ success: data.success, message: data.message });
    } catch (err: any) {
      setTestingCompKey(false);
      setCompKeyTestNotice({ success: false, message: `Erro ao testar: ${err.message}` });
    }
  };

  const handleSaveCompanyOpenRouterKey = async () => {
    if (!selectedCompForAi || !compApiKeyInput.trim()) return;
    setSavingCompKey(true);
    try {
      const res = await fetch("/api/openrouter/company/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: selectedCompForAi.id, apiKey: compApiKeyInput.trim() })
      });
      const data = await res.json();
      setSavingCompKey(false);
      if (data.success) {
        setCompanies(prev => prev.map(c => c.id === selectedCompForAi.id ? {
          ...c,
          openrouterApiKey: compApiKeyInput.trim(),
          openrouterKeyMasked: data.maskedKey,
          openrouterKeyStatus: 'connected'
        } : c));
        setSelectedCompForAi(prev => prev ? {
          ...prev,
          openrouterApiKey: compApiKeyInput.trim(),
          openrouterKeyMasked: data.maskedKey,
          openrouterKeyStatus: 'connected'
        } : null);
        setCompKeyTestNotice({ success: true, message: "🟢 Chave OpenRouter da empresa salva e conectada com sucesso!" });
      } else {
        setCompKeyTestNotice({ success: false, message: data.error || "Erro ao salvar chave." });
      }
    } catch (err: any) {
      setSavingCompKey(false);
      setCompKeyTestNotice({ success: false, message: `Erro técnico: ${err.message}` });
    }
  };

  const handleRemoveCompanyOpenRouterKey = async () => {
    if (!selectedCompForAi) return;
    setRemovingCompKey(true);
    try {
      const res = await fetch("/api/openrouter/company/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: selectedCompForAi.id })
      });
      const data = await res.json();
      setRemovingCompKey(false);
      setShowRemoveCompKeyModal(false);
      if (data.success) {
        setCompanies(prev => prev.map(c => c.id === selectedCompForAi.id ? {
          ...c,
          openrouterApiKey: undefined,
          openrouterKeyMasked: undefined,
          openrouterKeyStatus: 'master_fallback'
        } : c));
        setSelectedCompForAi(prev => prev ? {
          ...prev,
          openrouterApiKey: undefined,
          openrouterKeyMasked: undefined,
          openrouterKeyStatus: 'master_fallback'
        } : null);
        setCompApiKeyInput("");
        setCompKeyTestNotice({ success: true, message: "Chave removida. A empresa agora utilizará a API Master (Fallback)." });
      }
    } catch (err: any) {
      setRemovingCompKey(false);
      setShowRemoveCompKeyModal(false);
    }
  };

  const handleSaveOpenRouter = async () => {
    if (!openRouterMasterKey.trim()) {
      setWarningMessage("Por favor, informe uma chave de API válida da OpenRouter.");
      return;
    }
    setSavingOpenRouter(true);
    const ok = await updateServerSettings({
      openrouter_enabled: openRouterEnabled,
      openrouter_api_key: openRouterMasterKey.trim()
    });
    setSavingOpenRouter(false);
    if (ok) {
      setOpenRouterSuccess(true);
      setTimeout(() => setOpenRouterSuccess(false), 2500);
    }
  };

  const handleTestOpenRouterConnection = async () => {
    const keyToTest = openRouterMasterKey.trim();
    if (!keyToTest) {
      setWarningMessage("Insira uma chave da OpenRouter no campo antes de testar a conexão.");
      return;
    }

    setIsTestingOpenRouter(true);
    setOpenRouterTestResult(null);

    try {
      const res = await fetch("https://openrouter.ai/api/v1/models", {
        headers: { "Authorization": `Bearer ${keyToTest}` }
      });
      if (res.ok) {
        const data = await res.json();
        const count = data?.data?.length || 0;
        setOpenRouterTestResult({
          success: true,
          message: `Conexão estabelecida com sucesso! ${count} modelos disponíveis na OpenRouter.`,
          modelsCount: count
        });
      } else {
        const errText = await res.text();
        setOpenRouterTestResult({
          success: false,
          message: `Falha na autorização OpenRouter (${res.status}): Verifique se a chave é válida.`
        });
      }
    } catch (err: any) {
      setOpenRouterTestResult({
        success: false,
        message: `Erro de conexão: ${err.message || 'Não foi possível conectar à OpenRouter.'}`
      });
    } finally {
      setIsTestingOpenRouter(false);
    }
  };

  const handleSaveEvolution = async () => {
    setSavingEvolution(true);
    const ok = await updateServerSettings({
      evolution_url: evolutionUrl,
      evolution_api_key: evolutionApiKey
    });
    setSavingEvolution(false);
    if (ok) {
      setEvolutionSuccess(true);
      setTimeout(() => setEvolutionSuccess(false), 2500);
    }
  };

  const handleSaveStripe = async () => {
    setSavingStripe(true);
    const ok = await updateServerSettings({
      stripe_pub_key: stripePublishableKey.trim(),
      stripe_secret_key: stripeSecretKey.trim(),
      stripe_webhook_secret: stripeWebhookSecret.trim()
    });
    setSavingStripe(false);
    if (ok) {
      setStripeSuccess(true);
      setTimeout(() => setStripeSuccess(false), 2500);
    }
  };

  // FinOps Real Data Calculation Engine (Zero-Mock)
  const finOpsData = useMemo(() => {
    const totalDetailedCost = serverCost + dbCost + storageCost + whatsappCost + emailCost + monitoringCost + supportCost + otherCost;

    const perCompanyOpsCost = allocationMethod === 'fixed_per_company'
      ? totalDetailedCost
      : (totalDetailedCost / Math.max(1, companies.length));

    let globalRevenue = 0;
    let globalCustoIa = 0;
    let globalCustoPlataforma = 0;
    let globalCoinsConsumed = 0;
    let globalTotalRequests = aiUsageLogs.length;
    let globalTotalTokens = 0;

    const companyMetrics = companies.map(comp => {
      const compLogs = aiUsageLogs.filter(l => l.company_id === comp.id);
      const custoIa = compLogs.reduce((acc, l) => acc + (l.custo_openrouter_brl || 0), 0);
      const coinsConsumed = compLogs.reduce((acc, l) => acc + (l.omnicoins_consumed || 0), 0);
      const tokens = compLogs.reduce((acc, l) => acc + (l.total_tokens || 0), 0);
      const requests = compLogs.length;

      const receitaBase = comp.monthlyRevenueBrl || (comp.plan === 'Profissional' ? 490 : comp.plan === 'Premium' ? 890 : 1990);
      const receitaCoinsExtra = 0;
      const receitaTotal = receitaBase + receitaCoinsExtra;

      const custoPlataforma = isOpCostConfigured ? perCompanyOpsCost : 0;
      const custoTotal = custoIa + custoPlataforma;
      const resultado = receitaTotal - custoTotal;
      const margem = receitaTotal > 0 ? (resultado / receitaTotal) * 100 : 0;

      globalRevenue += receitaTotal;
      globalCustoIa += custoIa;
      globalCustoPlataforma += custoPlataforma;
      globalCoinsConsumed += coinsConsumed;
      globalTotalTokens += tokens;

      return {
        id: comp.id,
        name: comp.corporateName || comp.tradeName,
        tradeName: comp.tradeName,
        cnpj: comp.cnpj,
        plan: comp.plan,
        receitaTotal,
        custoIa,
        custoPlataforma,
        custoTotal,
        resultado,
        margem,
        coinsConsumed,
        requests,
        tokens
      };
    });

    // Sort company metrics
    companyMetrics.sort((a, b) => {
      let valA = a.resultado;
      let valB = b.resultado;

      if (finOpsSortBy === 'receita') { valA = a.receitaTotal; valB = b.receitaTotal; }
      if (finOpsSortBy === 'custo_ia') { valA = a.custoIa; valB = b.custoIa; }
      if (finOpsSortBy === 'custo_plataforma') { valA = a.custoPlataforma; valB = b.custoPlataforma; }
      if (finOpsSortBy === 'lucro') { valA = a.resultado; valB = b.resultado; }
      if (finOpsSortBy === 'margem') { valA = a.margem; valB = b.margem; }

      return finOpsSortOrder === 'desc' ? valB - valA : valA - valB;
    });

    const globalCustoTotal = globalCustoIa + globalCustoPlataforma;
    const globalResultado = globalRevenue - globalCustoTotal;
    const globalMargem = globalRevenue > 0 ? (globalResultado / globalRevenue) * 100 : 0;

    const criticalCompanies = companyMetrics.filter(c => c.resultado < 0);
    const topProfitable = [...companyMetrics].sort((a, b) => b.margem - a.margem);
    const topCostIa = [...companyMetrics].sort((a, b) => b.custoIa - a.custoIa);

    const opBreakdownMap: Record<string, { label: string; count: number; coins: number; tokens: number; custoIa: number }> = {
      'CHAT': { label: 'Omni IA / Chat', count: 0, coins: 0, tokens: 0, custoIa: 0 },
      'DOCUMENT_A4': { label: 'Gerador de Documentos A4', count: 0, coins: 0, tokens: 0, custoIa: 0 },
      'EXECUTIVE_PRESENTATION': { label: 'Apresentações Executivas', count: 0, coins: 0, tokens: 0, custoIa: 0 },
      'DOCUMENT_ANALYSIS': { label: 'Análises Fiscais', count: 0, coins: 0, tokens: 0, custoIa: 0 },
      'CONTAAZUL_IA': { label: 'Conta Azul IA', count: 0, coins: 0, tokens: 0, custoIa: 0 },
      'OTHER': { label: 'Outros Processamentos', count: 0, coins: 0, tokens: 0, custoIa: 0 }
    };

    aiUsageLogs.forEach(l => {
      const type = l.tipo_operacao || 'CHAT';
      const key = opBreakdownMap[type] ? type : 'OTHER';
      opBreakdownMap[key].count += 1;
      opBreakdownMap[key].coins += l.omnicoins_consumed || 5;
      opBreakdownMap[key].tokens += l.total_tokens || 0;
      opBreakdownMap[key].custoIa += l.custo_openrouter_brl || 0;
    });

    const operationBreakdown = Object.values(opBreakdownMap);

    let dataIntegrity: 'complete' | 'partial' | 'insufficient' = 'complete';
    let integrityMessage = 'Dados financeiros completos com OpenRouter e Custo Operacional configurados.';

    if (!isOpCostConfigured) {
      dataIntegrity = 'partial';
      integrityMessage = 'Receita e Consumo OpenRouter disponíveis. Custo operacional da plataforma pendente de configuração.';
    } else if (aiUsageLogs.length === 0) {
      dataIntegrity = 'insufficient';
      integrityMessage = 'Sem dados suficientes de requisições no período. Aguardando chamadas de IA.';
    }

    const ownApiCompaniesCount = companies.filter(c => c.openrouterApiKey && c.openrouterApiKey.trim().length > 5).length;
    const masterApiCompaniesCount = companies.length - ownApiCompaniesCount;

    let ownApiCostBrl = 0;
    let masterApiCostBrl = 0;

    aiUsageLogs.forEach(l => {
      if (l.credential_source === 'company_openrouter') {
        ownApiCostBrl += (l.custo_openrouter_brl || 0);
      } else {
        masterApiCostBrl += (l.custo_openrouter_brl || 0);
      }
    });

    return {
      companyMetrics,
      globalRevenue,
      globalCustoIa,
      globalCustoPlataforma,
      globalCustoTotal,
      globalResultado,
      globalMargem,
      globalCoinsConsumed,
      globalTotalRequests,
      globalTotalTokens,
      ownApiCompaniesCount,
      masterApiCompaniesCount,
      ownApiCostBrl,
      masterApiCostBrl,
      criticalCompanies,
      topProfitable,
      topCostIa,
      operationBreakdown,
      dataIntegrity,
      integrityMessage,
      totalDetailedCost
    };
  }, [companies, aiUsageLogs, serverCost, dbCost, storageCost, whatsappCost, emailCost, monitoringCost, supportCost, otherCost, allocationMethod, isOpCostConfigured, finOpsSortBy, finOpsSortOrder]);

  const [newCompanyContext, setNewCompanyContext] = useState("");
  const [newAiNotes, setNewAiNotes] = useState("");

  const handleCreateCompany = () => {
    if (!newCorpName.trim() || !newCnpj.trim()) {
      setWarningMessage("Por favor, preencha a Razão Social e o CNPJ da nova empresa contratante.");
      return;
    }
    setSavingCompany(true);
    saveCompany({
      id: `comp_${Date.now()}`,
      corporateName: newCorpName.trim(),
      tradeName: newCorpName.trim().split(" ")[0] + " Contábil",
      cnpj: newCnpj.trim(),
      city: newCity,
      state: newState,
      plan: newPlan,
      coinsFranchise: newCoins,
      activeClientsCount: 0,
      monthlyRevenueBrl: newPlan === 'Profissional' ? 490 : newPlan === 'Premium' ? 890 : 1990,
      status: 'Ativo',
      companyContext: newCompanyContext.trim(),
      aiNotes: newAiNotes.trim()
    });

    setSavingCompany(false);
    setNewCorpName("");
    setNewCnpj("");
    setNewCompanyContext("");
    setNewAiNotes("");
    setCompanySuccess(true);
    setTimeout(() => setCompanySuccess(false), 2500);
  };


  const handleCreateUserForCompany = async () => {
    if (!newUserName.trim() || !newUserEmail.trim() || !targetCompanyId) {
      setWarningMessage("Por favor, preencha a empresa destinatária, o nome e o e-mail do usuário.");
      return;
    }
    setSavingUser(true);

    const targetComp = companies.find(c => c.id === targetCompanyId);

    // Gera senha temporária aleatória, armazena o hash e exibe a senha em
    // texto puro ao Super ADM (a senha original não é recuperável depois).
    const tempPass = generateTemporaryPassword();
    const hashedPass = await hashPassword(tempPass);

    const newEmp = saveEmployee({
      companyId: targetCompanyId,
      companyName: targetComp?.tradeName || targetComp?.corporateName || targetCompanyId,
      name: newUserName.trim(),
      email: newUserEmail.trim(),
      department: newUserDept,
      role: newUserRole,
      birthDate: newUserBirthDate || undefined,
      allowedModules: selectedUserModules,
      status: 'Primeiro acesso pendente',
      passwordHash: hashedPass,
      mustChangePassword: true,
    } as any);

    setSavingUser(false);
    setNewUserName("");
    setNewUserEmail("");
    setNewUserBirthDate("");

    // Modal profissional com a senha temporária para repassar ao colaborador
    setCreatedUserTempPassModal({
      password: tempPass,
      name: newEmp.name,
      email: newEmp.email
    });
  };

  const copyPasswordToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopyPassSuccess(true);
    setTimeout(() => setCopyPassSuccess(false), 2000);
  };

  const handleRun100CallsTest = async () => {
    setIsTesting100Calls(true);
    setTest100Result(null);
    try {
      const res = await fetch("/api/test/ai-simulation", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.summary) {
        setTest100Result(data.summary);
      }
    } catch (e) {
      console.error("Erro ao executar teste de 100 chamadas:", e);
    } finally {
      setIsTesting100Calls(false);
    }
  };

  if (role === null) {
    return (
      <div className="p-12 bg-white border border-slate-200 rounded-xl text-center shadow-xs">
        <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
          <RefreshCw className="w-6 h-6 animate-spin" />
        </div>
        <h2 className="text-base font-bold text-slate-900">Carregando sessão...</h2>
        <p className="text-xs text-slate-500 mt-2 max-w-sm mx-auto leading-relaxed">
          Confirmando suas permissões de acesso à plataforma.
        </p>
      </div>
    );
  }

  if (role !== "super_adm") {
    return (
      <div className="p-12 bg-white border border-red-200/60 rounded-xl text-center shadow-xs">
        <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h2 className="text-base font-bold text-slate-900">Acesso Estritamente Negado ao Painel Master</h2>
        <p className="text-xs text-slate-500 mt-2 max-w-sm mx-auto leading-relaxed">
          Este painel é reservado exclusivamente para o perfil Super ADM Master da plataforma.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-slate-900 font-sans pb-12">
      {/* Modal for Creating New Job Role */}
      {showAddRoleModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5 max-w-md w-full shadow-lg space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-primary" />
                <span>Criar Novo Cargo / Departamento</span>
              </h3>
              <button onClick={() => setShowAddRoleModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                Nome do Novo Cargo / Função:
              </label>
              <input
                type="text"
                placeholder="Ex: Coordenador de BPO & Controladoria"
                value={newRoleInput}
                onChange={(e) => setNewRoleInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateNewRole()}
                className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-bold focus:outline-none focus:border-primary"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddRoleModal(false)}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCreateNewRole}
                className="px-4 py-1.5 bg-primary hover:opacity-90 text-white text-xs font-semibold rounded-lg shadow-xs"
              >
                Adicionar Cargo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Warning Modal */}
      <ConfirmModal
        isOpen={warningMessage !== null}
        onClose={() => setWarningMessage(null)}
        onConfirm={() => setWarningMessage(null)}
        title="Atenção — Campos Obrigatórios"
        description={warningMessage || ""}
        confirmText="Entendi"
        cancelText="Fechar"
        variant="warning"
      />

      {/* Excluir Pedido de Compra — Confirmation */}
      <ConfirmModal
        isOpen={orderToDelete !== null}
        onClose={() => setOrderToDelete(null)}
        onCancel={() => setOrderToDelete(null)}
        onConfirm={() => orderToDelete && handleDeleteOrder(orderToDelete.id)}
        title="Excluir Pedido de Compra?"
        description={`O pedido ${orderToDelete?.order_number || orderToDelete?.id || ""} (${orderToDelete?.empresa_nome || ""}) será removido permanentemente. Somente pedidos ainda não provisionados podem ser excluídos.`}
        confirmText="Excluir Pedido"
        cancelText="Cancelar"
        variant="danger"
      />

      {/* Success Message */}
      {successMessage && (
        <div className="flex items-center justify-between gap-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-lg px-4 py-3">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            {successMessage}
          </span>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-500 hover:text-emerald-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Limpo */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 lg:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <Crown className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl lg:text-2xl font-bold text-slate-900 tracking-tight">
              Painel Master Super ADM
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Persistência direta no Banco SQL Local com Supabase PostgreSQL
            </p>
          </div>
        </div>
      </div>

      {/* SELETOR DE ABAS MASTER */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('pedidos_compra')}
          className={`px-4 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'pedidos_compra'
              ? 'bg-primary text-white shadow-xs'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Pedidos de Compra SaaS</span>
          {purchaseOrders.filter(o => o.status === 'PAGAMENTO_CONFIRMADO').length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-500 text-white font-extrabold">
              {purchaseOrders.filter(o => o.status === 'PAGAMENTO_CONFIRMADO').length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('economia_ia')}
          className={`px-4 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'economia_ia'
              ? 'bg-primary text-white shadow-xs'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Coins className="w-4 h-4" />
          <span>Economia & Consumo de IA (OmniCoins)</span>
        </button>

        <button
          onClick={() => setActiveTab('infraestrutura')}
          className={`px-4 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'infraestrutura'
              ? 'bg-primary text-white shadow-xs'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Server className="w-4 h-4" />
          <span>Infraestrutura & APIs Master</span>
        </button>
      </div>

      {/* ABAS DO PAINEL MASTER */}
      {activeTab === 'pedidos_compra' && (
        <div className="space-y-6">
          {/* Header Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-bold tracking-tight text-slate-900">
                  Gestão Comercial & Provisionamento de Empresas SaaS
                </h2>
              </div>
              <p className="text-xs text-slate-500 mt-1 max-w-2xl">
                Visualize os pedidos de compra realizados via Landing Page / Stripe e realize o provisionamento seguro da empresa e credenciais do Gestor.
              </p>
            </div>

            <button
              onClick={loadPurchaseOrders}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg border border-slate-200 flex items-center gap-1.5 transition-all self-start md:self-auto"
            >
              <RefreshCw size={14} className={loadingOrders ? "animate-spin" : ""} />
              Atualizar Pedidos
            </button>
          </div>

          {/* Compact Minimalist Overview Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div
              onClick={() => setOrderStatusFilter("ALL")}
              className={`p-3 rounded-lg border transition-all cursor-pointer ${
                orderStatusFilter === "ALL"
                  ? "bg-slate-50 border-slate-900 ring-1 ring-slate-900 shadow-2xs"
                  : "bg-white border-slate-200 hover:border-slate-300 shadow-2xs"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Total de Pedidos
                </span>
                <span className="text-[10px] text-slate-400 font-mono">Todos</span>
              </div>
              <span className="text-xl font-extrabold text-slate-900 block mt-1 font-mono">
                {purchaseOrders.length}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Histórico completo</span>
            </div>

            <div
              onClick={() => setOrderStatusFilter("PENDENTE_PAGAMENTO")}
              className={`p-3 rounded-lg border transition-all cursor-pointer ${
                orderStatusFilter === "PENDENTE_PAGAMENTO"
                  ? "bg-slate-50 border-slate-900 ring-1 ring-slate-900 shadow-2xs"
                  : "bg-white border-slate-200 hover:border-slate-300 shadow-2xs"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Aguardando Pagamento
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
              </div>
              <span className="text-xl font-extrabold text-slate-900 block mt-1 font-mono">
                {purchaseOrders.filter(o => o.status === "PENDENTE_PAGAMENTO").length}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Checkout pendente</span>
            </div>

            <div
              onClick={() => setOrderStatusFilter("PAGAMENTO_CONFIRMADO")}
              className={`p-3 rounded-lg border transition-all cursor-pointer ${
                orderStatusFilter === "PAGAMENTO_CONFIRMADO"
                  ? "bg-slate-50 border-slate-900 ring-1 ring-slate-900 shadow-2xs"
                  : "bg-white border-slate-200 hover:border-slate-300 shadow-2xs"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Pagos • Para Provisionar
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
              </div>
              <span className="text-xl font-extrabold text-slate-900 block mt-1 font-mono">
                {purchaseOrders.filter(o => o.status === "PAGAMENTO_CONFIRMADO").length}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Prontos para aprovação</span>
            </div>

            <div
              onClick={() => setOrderStatusFilter("PROVISIONADO")}
              className={`p-3 rounded-lg border transition-all cursor-pointer ${
                orderStatusFilter === "PROVISIONADO"
                  ? "bg-slate-50 border-slate-900 ring-1 ring-slate-900 shadow-2xs"
                  : "bg-white border-slate-200 hover:border-slate-300 shadow-2xs"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Empresas Provisionadas
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              </div>
              <span className="text-xl font-extrabold text-slate-900 block mt-1 font-mono">
                {purchaseOrders.filter(o => o.status === "PROVISIONADO").length}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Tenants ativos</span>
            </div>
          </div>

          {/* Minimalist Filter Bar & Search */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3">
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
              {/* Status Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1 shrink-0">
                  Status:
                </span>
                {[
                  { id: "ALL", label: "Todos" },
                  { id: "PENDENTE_PAGAMENTO", label: "Aguardando Pagamento" },
                  { id: "PAGAMENTO_CONFIRMADO", label: "Pago • Para Provisionar" },
                  { id: "PROVISIONADO", label: "Provisionado" },
                  { id: "CANCELADO", label: "Cancelado" }
                ].map((st) => (
                  <button
                    key={st.id}
                    onClick={() => setOrderStatusFilter(st.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                      orderStatusFilter === st.id
                        ? "bg-slate-900 text-white shadow-xs"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>

              {/* Search Bar */}
              <div className="relative w-full lg:w-72">
                <input
                  type="text"
                  placeholder="Buscar por pedido, empresa, CNPJ, e-mail..."
                  value={orderSearchQuery}
                  onChange={(e) => setOrderSearchQuery(e.target.value)}
                  className="w-full h-9 pl-3 pr-8 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 outline-none focus:border-slate-900 focus:bg-white transition-all"
                />
                {orderSearchQuery && (
                  <button
                    onClick={() => setOrderSearchQuery("")}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 text-xs"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>

            {/* Date Period & Origin Filters */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1">
                  Período:
                </span>
                {[
                  { id: "ALL", label: "Todo o histórico" },
                  { id: "TODAY", label: "Hoje" },
                  { id: "LAST_7_DAYS", label: "Últimos 7 dias" },
                  { id: "LAST_30_DAYS", label: "Últimos 30 dias" },
                  { id: "CUSTOM", label: "Personalizado" }
                ].map((dt) => (
                  <button
                    key={dt.id}
                    onClick={() => setOrderDatePeriod(dt.id)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                      orderDatePeriod === dt.id
                        ? "bg-slate-800 text-white"
                        : "bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {dt.label}
                  </button>
                ))}

                {orderDatePeriod === "CUSTOM" && (
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="h-8 px-2 text-xs border border-slate-200 rounded-md outline-none bg-slate-50"
                    />
                    <span className="text-slate-400">até</span>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="h-8 px-2 text-xs border border-slate-200 rounded-md outline-none bg-slate-50"
                    />
                  </div>
                )}
              </div>

              {/* Origin Filter */}
              <div className="flex items-center gap-1.5 ml-auto">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1">
                  Origem:
                </span>
                {[
                  { id: "ALL", label: "Todas" },
                  { id: "landing_page", label: "🌐 Landing Page" },
                  { id: "manual_super_admin", label: "👤 Venda Manual (ADM)" }
                ].map((og) => (
                  <button
                    key={og.id}
                    onClick={() => setOrderOriginFilter(og.id)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                      orderOriginFilter === og.id
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {og.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Table of Orders */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Lista de Pedidos ({filteredPurchaseOrders.length})
              </h3>
              {(orderStatusFilter !== "ALL" || orderOriginFilter !== "ALL" || orderDatePeriod !== "ALL" || orderSearchQuery) && (
                <button
                  onClick={() => {
                    setOrderStatusFilter("ALL");
                    setOrderOriginFilter("ALL");
                    setOrderDatePeriod("ALL");
                    setOrderSearchQuery("");
                    setCustomStartDate("");
                    setCustomEndDate("");
                  }}
                  className="text-[11px] text-slate-500 hover:text-slate-900 underline font-medium"
                >
                  Limpar todos os filtros
                </button>
              )}
            </div>

            {loadingOrders ? (
              <div className="p-12 text-center text-slate-400 text-xs animate-pulse">
                Carregando pedidos de compra...
              </div>
            ) : filteredPurchaseOrders.length === 0 ? (
              <div className="p-12 text-center text-slate-500 text-xs space-y-2">
                <FileText className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="font-semibold text-slate-700">Nenhum pedido de compra encontrado.</p>
                <p className="text-slate-400 text-[11px]">
                  {purchaseOrders.length === 0
                    ? "Os pedidos iniciados na Landing Page ou via Venda Manual aparecerão aqui para validação e provisionamento."
                    : "Nenhum resultado corresponde aos filtros selecionados."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-100/70 text-slate-700 font-bold uppercase tracking-wider text-[10px]">
                      <th className="p-3.5">Pedido / Origem</th>
                      <th className="p-3.5">Empresa / CNPJ</th>
                      <th className="p-3.5">Responsável / E-mail</th>
                      <th className="p-3.5">Plano / Franquia</th>
                      <th className="p-3.5">Valor Inicial</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-800">
                    {filteredPurchaseOrders.map((ord: any) => (
                      <tr key={ord.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3.5">
                          <span className="font-mono font-bold text-slate-900 block">{ord.id}</span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] text-slate-400">
                              {new Date(ord.created_at).toLocaleDateString("pt-BR")}
                            </span>
                            {ord.origin_source === "manual_super_admin" ? (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                                👤 Venda Manual
                              </span>
                            ) : (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                🌐 Landing Page
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3.5">
                          <strong className="block text-slate-900">{ord.empresa_nome}</strong>
                          <span className="text-[10px] text-slate-400 font-mono">{ord.empresa_cnpj}</span>
                        </td>
                        <td className="p-3.5">
                          <span className="font-medium text-slate-800 block">{ord.responsavel_nome}</span>
                          <span className="text-[10px] text-slate-500 block">{ord.responsavel_email}</span>
                        </td>
                        <td className="p-3.5">
                          <span className="font-bold text-slate-900 block">{ord.plan_name}</span>
                          <span className="text-[10px] text-slate-500 font-medium">
                            {ord.coins_franchise?.toLocaleString("pt-BR")} Coins/mês
                          </span>
                        </td>
                        <td className="p-3.5">
                          <span className="font-extrabold text-slate-900 block">
                            R$ {ord.total_initial_payment?.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </span>
                          {ord.incluir_conta_azul && (
                            <span className="text-[10px] text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 inline-block mt-0.5 font-mono">
                              + Conta Azul
                            </span>
                          )}
                        </td>
                        <td className="p-3.5">
                          {ord.status === "PROVISIONADO" ? (
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Provisionado
                            </span>
                          ) : ord.status === "PAGAMENTO_CONFIRMADO" ? (
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> Pago • Para Provisionar
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Aguardando Pagamento
                            </span>
                          )}
                        </td>
                        <td className="p-3.5 text-right space-x-2">
                          <button
                            onClick={() => setSelectedOrderForView(ord)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold rounded-lg border border-slate-200 transition-all inline-flex items-center gap-1"
                          >
                            Detalhes
                          </button>

                          {ord.status === "PAGAMENTO_CONFIRMADO" && (
                            <button
                              onClick={() => handleProvisionOrder(ord.id)}
                              disabled={provisioningOrderId === ord.id}
                              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-lg shadow-xs transition-all inline-flex items-center gap-1 disabled:opacity-50"
                            >
                              {provisioningOrderId === ord.id ? (
                                "Provisionando..."
                              ) : (
                                <>
                                  <Building2 size={12} />
                                  <span>Provisionar Empresa</span>
                                </>
                              )}
                            </button>
                          )}

                          {ord.status !== "PROVISIONADO" && (
                            <button
                              onClick={() => setOrderToDelete(ord)}
                              disabled={deletingOrderId === ord.id}
                              className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-600 border border-red-100 text-[11px] font-semibold rounded-lg transition-all inline-flex items-center gap-1 disabled:opacity-50"
                              title="Excluir pedido (apenas antes do provisionamento)"
                            >
                              <Trash2 size={12} />
                              <span>{deletingOrderId === ord.id ? "Excluindo..." : "Excluir"}</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Modal Provisioning Result Credentials */}
      {provisionResult && provisionResult.credentials && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-lg w-full p-6 md:p-8 space-y-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 border-b pb-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                <Building2 size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Empresa Provisionada com Sucesso!</h3>
                <p className="text-xs text-slate-500">Credenciais geradas com alteração de senha obrigatória</p>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3 text-xs">
              <div>
                <span className="text-slate-400 uppercase text-[10px] font-bold block">Empresa</span>
                <strong className="text-slate-900 text-sm block">{provisionResult.credentials.company_name}</strong>
              </div>

              <div>
                <span className="text-slate-400 uppercase text-[10px] font-bold block">E-mail do Gestor</span>
                <strong className="text-slate-900 font-mono">{provisionResult.credentials.gestor_email}</strong>
              </div>

              <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
                <span className="text-amber-900 uppercase text-[10px] font-bold block mb-1">
                  Senha Temporária de Acesso
                </span>
                <div className="flex items-center justify-between font-mono text-sm font-bold text-slate-900 bg-white p-2.5 rounded border border-amber-300">
                  <span>{provisionResult.credentials.temporary_password}</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(provisionResult.credentials.temporary_password);
                      setCopiedPassword(true);
                      setTimeout(() => setCopiedPassword(false), 2000);
                    }}
                    className="px-2 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded text-[11px] font-sans transition-all"
                  >
                    {copiedPassword ? "Copiado!" : "Copiar"}
                  </button>
                </div>
                <span className="text-[10px] text-amber-800 block mt-1.5">
                  ✓ Regra <code className="font-bold">must_change_password: true</code> ativada. O gestor será forçado a definir uma nova senha pessoal no primeiro login.
                </span>
              </div>
            </div>

            <button
              onClick={() => setProvisionResult(null)}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all"
            >
              Fechar e Concluir
            </button>
          </div>
        </div>
      )}

      {/* Enhanced Modal View Order Details */}
      {selectedOrderForView && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400">Detalhes Completos do Pedido</span>
                <h3 className="text-lg font-bold text-slate-900 font-mono">{selectedOrderForView.id}</h3>
              </div>
              <button
                onClick={() => setSelectedOrderForView(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* General info */}
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-400 block text-[10px] font-bold uppercase">Razão Social</span>
                  <span className="font-bold text-slate-900">{selectedOrderForView.empresa_nome}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] font-bold uppercase">CNPJ</span>
                  <span className="font-mono font-bold text-slate-900">{selectedOrderForView.empresa_cnpj}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] font-bold uppercase">Responsável</span>
                  <span className="font-bold text-slate-800">{selectedOrderForView.responsavel_nome}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] font-bold uppercase">E-mail</span>
                  <span className="font-mono text-slate-800">{selectedOrderForView.responsavel_email}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] font-bold uppercase">Telefone</span>
                  <span className="font-mono text-slate-800">{selectedOrderForView.responsavel_telefone || "Não informado"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] font-bold uppercase">Segmento</span>
                  <span className="text-slate-800">{selectedOrderForView.empresa_segmento || "Contábil"}</span>
                </div>
              </div>

              {/* Financial & Plan Details */}
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-400 block text-[10px] font-bold uppercase">Plano Selecionado</span>
                  <span className="font-bold text-slate-900">{selectedOrderForView.plan_name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] font-bold uppercase">Franquia de IA</span>
                  <span className="font-bold text-emerald-700">{selectedOrderForView.coins_franchise?.toLocaleString("pt-BR")} Coins/mês</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] font-bold uppercase">Valor Inicial</span>
                  <span className="font-extrabold text-slate-900">R$ {selectedOrderForView.total_initial_payment?.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] font-bold uppercase">Setup Conta Azul</span>
                  <span className="font-medium text-slate-800">{selectedOrderForView.incluir_conta_azul ? "Sim (+ R$ 39,90)" : "Não"}</span>
                </div>
              </div>

              {/* Stripe Transaction Details */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5 font-mono text-[11px]">
                <span className="text-slate-400 uppercase text-[10px] font-bold font-sans block mb-1">
                  Metadados do Stripe Checkout
                </span>
                <div className="flex justify-between">
                  <span className="text-slate-500">Session ID:</span>
                  <span className="text-slate-900 truncate max-w-[200px]">{selectedOrderForView.stripe_session_id || "Pendente"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Payment Intent:</span>
                  <span className="text-slate-900 truncate max-w-[200px]">{selectedOrderForView.stripe_payment_intent_id || "Pendente"}</span>
                </div>
                <div className="flex justify-between font-sans">
                  <span className="text-slate-500">Data de Criação:</span>
                  <span className="text-slate-800">{new Date(selectedOrderForView.created_at).toLocaleString("pt-BR")}</span>
                </div>
                {selectedOrderForView.paid_at && (
                  <div className="flex justify-between font-sans">
                    <span className="text-slate-500">Data de Pagamento:</span>
                    <span className="text-emerald-700 font-bold">{new Date(selectedOrderForView.paid_at).toLocaleString("pt-BR")}</span>
                  </div>
                )}
                {selectedOrderForView.provisioned_at && (
                  <div className="flex justify-between font-sans">
                    <span className="text-slate-500">Data de Provisionamento:</span>
                    <span className="text-blue-700 font-bold">{new Date(selectedOrderForView.provisioned_at).toLocaleString("pt-BR")}</span>
                  </div>
                )}
              </div>

              {selectedOrderForView.empresa_observacoes && (
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-slate-400 block font-medium mb-1 text-[10px] uppercase">Observações do Cliente:</span>
                  <p className="text-slate-700 leading-relaxed">{selectedOrderForView.empresa_observacoes}</p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setSelectedOrderForView(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'economia_ia' && (
        <div className="space-y-6">
          {/* BANNER RECOMPENSA E INTEGRIDADE DOS DADOS (WHITE CLEAN THEME) */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl p-1 bg-amber-50 rounded-lg border border-amber-100">🪙</span>
                <h2 className="text-lg font-bold tracking-tight text-slate-900">Centro Master de Medição & Economia de IA</h2>
              </div>
              <p className="text-xs text-slate-500 mt-1 max-w-2xl">
                FinOps, consumo, custos e rentabilidade real por empresa (Zero Mock Data).
              </p>
            </div>

            {/* Status da Integridade dos Dados */}
            <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Status de Integridade</span>
                <span className="text-xs font-bold text-slate-900 flex items-center gap-2 justify-end mt-0.5">
                  <span className={`w-2.5 h-2.5 rounded-full ${
                    finOpsData.dataIntegrity === 'complete' ? 'bg-emerald-500' :
                    finOpsData.dataIntegrity === 'partial' ? 'bg-amber-500' : 'bg-red-500'
                  }`} />
                  <span>
                    {finOpsData.dataIntegrity === 'complete' ? 'Dados Completos' : finOpsData.dataIntegrity === 'partial' ? 'Dados Parciais' : 'Dados Insuficientes'}
                  </span>
                </span>
              </div>
            </div>
          </div>

          {/* ALERTA DE INTEGRIDADE SE CUSTOS DE PLATAFORMA NÃO CONFIGURADOS */}
          {!isOpCostConfigured && (
            <div className="p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <div>
                  <strong>Diagnóstico FinOps:</strong> {finOpsData.integrityMessage}
                </div>
              </div>
              <button 
                onClick={() => {
                  const el = document.getElementById('sec-op-costs');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
                className="px-3 py-1 bg-amber-600 text-white font-bold text-[11px] rounded-lg hover:bg-amber-700 transition-all shrink-0"
              >
                Configure os Custos da Plataforma
              </button>
            </div>
          )}

          {/* STRIP DE CARDS FINOPS TOTAIS (DADOS 100% REAIS) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            {/* Card 1: Receita no Mês */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">1. Receita no Mês</span>
              <span className="text-xl font-extrabold text-emerald-700 block">
                R$ {finOpsData.globalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-[10px] text-slate-500 font-medium block">
                {companies.length} empresa(s) ativa(s)
              </span>
            </div>

            {/* Card 2: Custo Real IA */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">2. Custo Real IA</span>
              <span className="text-xl font-extrabold text-red-600 block">
                R$ {finOpsData.globalCustoIa.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-[10px] text-slate-500 font-medium block">
                {finOpsData.globalTotalRequests} chamadas auditadas
              </span>
            </div>

            {/* Card 3: Custo Plataforma */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">3. Custo Plataforma</span>
              <span className="text-xl font-extrabold text-slate-900 block">
                {isOpCostConfigured ? `R$ ${finOpsData.globalCustoPlataforma.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'Pendente'}
              </span>
              <span className="text-[10px] text-slate-500 font-medium block">
                {isOpCostConfigured ? 'Infraestrutura real' : 'Defina os custos'}
              </span>
            </div>

            {/* Card 4: Custo Total */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">4. Custo Total</span>
              <span className="text-xl font-extrabold text-purple-700 block">
                {isOpCostConfigured ? `R$ ${finOpsData.globalCustoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `R$ ${finOpsData.globalCustoIa.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (IA)`}
              </span>
              <span className="text-[10px] text-slate-500 font-medium block">
                IA + Infraestrutura
              </span>
            </div>

            {/* Card 5: Resultado Operacional */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">5. Resultado Operacional</span>
              <span className={`text-xl font-extrabold block ${finOpsData.globalResultado >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                R$ {finOpsData.globalResultado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-[10px] text-slate-500 font-medium block">
                Lucro operacional líquido
              </span>
            </div>

            {/* Card 6: Margem % */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">6. Margem Operacional</span>
              <span className={`text-xl font-extrabold block ${finOpsData.globalMargem >= 50 ? 'text-emerald-600' : finOpsData.globalMargem >= 0 ? 'text-amber-600' : 'text-red-600'}`}>
                {isOpCostConfigured ? `${finOpsData.globalMargem.toFixed(1)}%` : 'Pendente'}
              </span>
              <span className="text-[10px] text-slate-500 font-medium block">
                {isOpCostConfigured ? 'Margem real apurada' : 'Aguardando custo'}
              </span>
            </div>
          </div>

          {/* SEÇÃO 1: CONFIGURAÇÃO DE CUSTOS OPERACIONAIS DA PLATAFORMA */}
          <div id="sec-op-costs" className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Server className="w-4 h-4 text-primary" />
                  <span>Configuração de Custos Operacionais da Plataforma</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Cadastre os custos reais de infraestrutura para apuração do Lucro Líquido Real por Empresa</p>
              </div>

              <button
                onClick={handleSaveOpCosts}
                disabled={savingOpCosts}
                className="px-4 py-2 bg-primary hover:opacity-90 text-white text-xs font-bold rounded-lg flex items-center gap-2 transition-all shadow-xs disabled:opacity-50"
              >
                {savingOpCosts ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                <span>{savingOpCosts ? 'Salvando...' : 'Salvar Custos Operacionais'}</span>
              </button>
            </div>

            {opCostSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-lg flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Custos operacionais atualizados com sucesso e salvos no Banco SQL!</span>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Servidores (Cloud/VPS):</label>
                <div className="relative">
                  <span className="absolute left-2.5 top-2 text-xs font-bold text-slate-400">R$</span>
                  <input
                    type="number"
                    value={serverCost}
                    onChange={(e) => setServerCost(Number(e.target.value))}
                    className="w-full h-8 pl-8 pr-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Banco de Dados (SQL):</label>
                <div className="relative">
                  <span className="absolute left-2.5 top-2 text-xs font-bold text-slate-400">R$</span>
                  <input
                    type="number"
                    value={dbCost}
                    onChange={(e) => setDbCost(Number(e.target.value))}
                    className="w-full h-8 pl-8 pr-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Storage & Backup:</label>
                <div className="relative">
                  <span className="absolute left-2.5 top-2 text-xs font-bold text-slate-400">R$</span>
                  <input
                    type="number"
                    value={storageCost}
                    onChange={(e) => setStorageCost(Number(e.target.value))}
                    className="w-full h-8 pl-8 pr-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">WhatsApp Evolution API:</label>
                <div className="relative">
                  <span className="absolute left-2.5 top-2 text-xs font-bold text-slate-400">R$</span>
                  <input
                    type="number"
                    value={whatsappCost}
                    onChange={(e) => setWhatsappCost(Number(e.target.value))}
                    className="w-full h-8 pl-8 pr-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">E-mail & SMTP:</label>
                <div className="relative">
                  <span className="absolute left-2.5 top-2 text-xs font-bold text-slate-400">R$</span>
                  <input
                    type="number"
                    value={emailCost}
                    onChange={(e) => setEmailCost(Number(e.target.value))}
                    className="w-full h-8 pl-8 pr-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Monitoramento & Logs:</label>
                <div className="relative">
                  <span className="absolute left-2.5 top-2 text-xs font-bold text-slate-400">R$</span>
                  <input
                    type="number"
                    value={monitoringCost}
                    onChange={(e) => setMonitoringCost(Number(e.target.value))}
                    className="w-full h-8 pl-8 pr-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Suporte Técnico:</label>
                <div className="relative">
                  <span className="absolute left-2.5 top-2 text-xs font-bold text-slate-400">R$</span>
                  <input
                    type="number"
                    value={supportCost}
                    onChange={(e) => setSupportCost(Number(e.target.value))}
                    className="w-full h-8 pl-8 pr-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Outros Custos Fixo:</label>
                <div className="relative">
                  <span className="absolute left-2.5 top-2 text-xs font-bold text-slate-400">R$</span>
                  <input
                    type="number"
                    value={otherCost}
                    onChange={(e) => setOtherCost(Number(e.target.value))}
                    className="w-full h-8 pl-8 pr-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-400 font-bold">Método de Atribuição:</span>
                <select
                  value={allocationMethod}
                  onChange={(e) => setAllocationMethod(e.target.value as any)}
                  className="h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-800"
                >
                  <option value="fixed_per_company">Custo Fixo por Empresa (R$ {finOpsData.totalDetailedCost}/empresa)</option>
                  <option value="proportional_split">Rateio Proporcional entre Empresas Ativas</option>
                </select>
              </div>

              <span className="font-extrabold text-slate-900">
                Total Operacional: <span className="text-primary">R$ {finOpsData.totalDetailedCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span> / mês
              </span>
            </div>
          </div>

          {/* SEÇÃO 2: TABELA PRINCIPAL — RENTABILIDADE POR EMPRESA */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-emerald-600" />
                  <span>Tabela de Rentabilidade por Empresa (Resultado Operacional Real)</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Apuração real de Receita, Custo IA, Custo Plataforma e Margem Operacional %</p>
              </div>

              {/* Seletor de Ordenação */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase">Ordenar por:</span>
                <select
                  value={finOpsSortBy}
                  onChange={(e) => setFinOpsSortBy(e.target.value as any)}
                  className="h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
                >
                  <option value="lucro">Maior Lucro Operacional</option>
                  <option value="margem">Maior Margem %</option>
                  <option value="receita">Maior Receita</option>
                  <option value="custo_ia">Maior Custo de IA</option>
                  <option value="custo_plataforma">Maior Custo Plataforma</option>
                </select>
                <button
                  onClick={() => setFinOpsSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                  className="h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-100 flex items-center gap-1"
                >
                  <ArrowUpDown className="w-3.5 h-3.5" />
                  <span>{finOpsSortOrder === 'desc' ? 'Decrescente' : 'Crescente'}</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-2.5 px-3">Empresa Contratante</th>
                    <th className="py-2.5 px-3">Plano SaaS</th>
                    <th className="py-2.5 px-3">Credencial IA</th>
                    <th className="py-2.5 px-3 text-right">Receita Total</th>
                    <th className="py-2.5 px-3 text-right">Custo IA (OpenRouter)</th>
                    <th className="py-2.5 px-3 text-right">Custo Plataforma</th>
                    <th className="py-2.5 px-3 text-right">Custo Total</th>
                    <th className="py-2.5 px-3 text-right">Lucro Operacional</th>
                    <th className="py-2.5 px-3 text-right">Margem %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {finOpsData.companyMetrics.length > 0 ? (
                    finOpsData.companyMetrics.map((comp) => {
                      const fullComp = companies.find(c => c.id === comp.id);
                      const hasOwnKey = fullComp?.openrouterApiKey && fullComp.openrouterApiKey.trim().length > 5;
                      return (
                        <tr key={comp.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-3">
                            <span className="font-bold text-slate-900 block">{comp.name}</span>
                            <span className="text-[10px] text-slate-400 font-mono">CNPJ: {comp.cnpj}</span>
                          </td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 text-[10px] rounded font-bold bg-slate-100 text-slate-700 border border-slate-200">
                              {comp.plan}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2">
                              {hasOwnKey ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> API Própria
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> API Master
                                </span>
                              )}
                              <button
                                onClick={() => {
                                  if (fullComp) {
                                    setSelectedCompForAi(fullComp);
                                    setCompApiKeyInput(fullComp.openrouterApiKey || "");
                                    setCompKeyTestNotice(null);
                                  }
                                }}
                                className="px-2 py-1 text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-all border border-slate-300"
                              >
                                {hasOwnKey ? 'Alterar API' : 'Configurar API'}
                              </button>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right font-extrabold text-emerald-700">
                            R$ {comp.receitaTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </td>
                        <td className="py-3 px-3 text-right font-bold text-red-600 font-mono">
                          R$ {comp.custoIa.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-3 text-right font-medium text-slate-600 font-mono">
                          {isOpCostConfigured ? `R$ ${comp.custoPlataforma.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'}
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-purple-700 font-mono">
                          R$ {comp.custoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className={`py-3 px-3 text-right font-extrabold ${comp.resultado >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          R$ {comp.resultado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-3 text-right font-bold">
                          {isOpCostConfigured ? (
                            <span className={`px-2 py-0.5 text-[10px] rounded border ${
                              comp.margem >= 50 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                              comp.margem >= 0 ? 'bg-amber-50 text-amber-700 border-amber-200' :
                              'bg-red-50 text-red-700 border-red-200'
                            }`}>
                              {comp.margem.toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400">Indisponível</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400 text-xs">
                      Nenhuma empresa cadastrada no sistema.
                    </td>
                  </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* SEÇÃO 3: RANKINGS E ALERTAS DE MARGEM CRÍTICA */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* RANKING: EMPRESAS COM MAIOR CUSTO DE IA (6 COLUNAS) */}
            <div className="lg:col-span-6 bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-red-600" />
                  <span>Empresas com Maior Custo de IA</span>
                </h3>
                <span className="text-[10px] font-semibold text-slate-400">Consumo OpenRouter</span>
              </div>

              <div className="space-y-2 pt-1">
                {finOpsData.topCostIa.length > 0 ? (
                  finOpsData.topCostIa.map((comp, idx) => (
                    <div key={comp.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-3">
                        <span className="w-5 h-5 rounded-full bg-red-100 text-red-700 font-bold flex items-center justify-center text-[10px]">
                          {idx + 1}
                        </span>
                        <div>
                          <span className="font-bold text-slate-900 block">{comp.name}</span>
                          <span className="text-[10px] text-slate-400">{comp.requests} chamadas • 🪙 {comp.coinsConsumed} Coins</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-extrabold text-red-600 block">R$ {comp.custoIa.toFixed(2)}</span>
                        <span className="text-[10px] text-slate-400 font-medium">Receita: R$ {comp.receitaTotal}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-6 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    Nenhum registro de consumo localizado.
                  </div>
                )}
              </div>
            </div>

            {/* ALERTA: EMPRESAS COM MARGEM CRÍTICA (NEGATIVA) (6 COLUNAS) */}
            <div className="lg:col-span-6 bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600" />
                  <span>Empresas com Margem Crítica (Prejuízo Operacional)</span>
                </h3>
                <span className="text-[10px] font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                  Alerta FinOps
                </span>
              </div>

              <div className="space-y-2 pt-1">
                {finOpsData.criticalCompanies.length > 0 ? (
                  finOpsData.criticalCompanies.map((comp) => (
                    <div key={comp.id} className="p-3 bg-red-50/60 rounded-xl border border-red-200 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2.5">
                        <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                        <div>
                          <span className="font-bold text-red-950 block">{comp.name}</span>
                          <span className="text-[10px] text-red-700">Receita R$ {comp.receitaTotal} vs Custo R$ {comp.custoTotal.toFixed(2)}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-extrabold text-red-700 block">R$ {comp.resultado.toFixed(2)}</span>
                        <span className="text-[10px] font-bold text-red-800">{comp.margem.toFixed(1)}% Margem</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center text-slate-500 text-xs bg-slate-50/60 rounded-xl border border-dashed border-slate-200">
                    <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
                    <p className="font-bold text-slate-700">Não existem empresas com margem negativa no período.</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Todas as empresas ativas apresentam rentabilidade operacional positiva.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* SEÇÃO 4: ECONOMIA POR OPERAÇÃO (BREAKDOWN DE RECURSOS) */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-600" />
                  <span>Economia por Operação de IA (Custos e Receita Atribuída)</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Análise detalhada de rentabilidade por tipo de recurso acionado</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-2.5 px-3">Funcionalidade / Operação</th>
                    <th className="py-2.5 px-3 text-right">Chamadas</th>
                    <th className="py-2.5 px-3 text-right">OmniCoins</th>
                    <th className="py-2.5 px-3 text-right">Tokens Totais</th>
                    <th className="py-2.5 px-3 text-right">Custo IA OpenRouter</th>
                    <th className="py-2.5 px-3 text-right">Receita Atribuída</th>
                    <th className="py-2.5 px-3 text-right">Margem %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {finOpsData.operationBreakdown.map((op) => {
                    const receitaAttr = op.coins * 0.10;
                    const margemOp = receitaAttr > 0 ? ((receitaAttr - op.custoIa) / receitaAttr) * 100 : 0;
                    return (
                      <tr key={op.label} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-3 font-bold text-slate-900">{op.label}</td>
                        <td className="py-3 px-3 text-right font-mono text-slate-600">{op.count}</td>
                        <td className="py-3 px-3 text-right font-bold text-amber-700">🪙 {op.coins} Coins</td>
                        <td className="py-3 px-3 text-right font-mono text-slate-500">{op.tokens.toLocaleString('pt-BR')}</td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-red-600">R$ {op.custoIa.toFixed(2)}</td>
                        <td className="py-3 px-3 text-right font-bold text-emerald-700">R$ {receitaAttr.toFixed(2)}</td>
                        <td className="py-3 px-3 text-right font-bold">
                          <span className={`px-2 py-0.5 text-[10px] rounded border ${
                            margemOp >= 80 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                            margemOp >= 0 ? 'bg-amber-50 text-amber-700 border-amber-200' :
                            'bg-red-50 text-red-700 border-red-200'
                          }`}>
                            {margemOp.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* SIMULAÇÃO DE USO ADMINISTRATIVA B2B */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-amber-600" />
                  <span>Calculadora de Simulação de Uso Administrativa</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Ferramenta para dimensionamento de planos e simulação de consumo médio</p>
              </div>
              <span className="text-[10px] font-semibold bg-amber-50 text-amber-800 px-2.5 py-1 rounded border border-amber-200">
                Simulador B2B
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Número de Funcionários:</label>
                <select
                  value={simEmployees}
                  onChange={(e) => setSimEmployees(Number(e.target.value))}
                  className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
                >
                  <option value={10}>10 Colaboradores</option>
                  <option value={15}>15 Colaboradores</option>
                  <option value={20}>20 Colaboradores</option>
                  <option value={30}>30 Colaboradores</option>
                  <option value={50}>50 Colaboradores</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Consultas Média/Dia por Pessoa:</label>
                <select
                  value={simQueriesPerDay}
                  onChange={(e) => setSimQueriesPerDay(Number(e.target.value))}
                  className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
                >
                  <option value={1}>1 consulta / dia</option>
                  <option value={2}>2 consultas / dia</option>
                  <option value={3}>3 consultas / dia</option>
                  <option value={5}>5 consultas / dia</option>
                  <option value={8}>8 consultas / dia</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Dias Úteis Mês:</label>
                <input
                  type="text"
                  disabled
                  value="22 dias úteis"
                  className="w-full h-9 px-3 bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-500"
                />
              </div>
            </div>

            {/* Sim Result */}
            {(() => {
              const reqsMês = simEmployees * simQueriesPerDay * simWorkingDays;
              const coinsMês = reqsMês * 5;
              const custoOpenRouterEst = (coinsMês * 0.003).toFixed(2);
              const planoRecomendado = coinsMês <= 5000 ? "Professional (5k Coins)" : coinsMês <= 15000 ? "Premium (15k Coins)" : "Business (50k Coins)";
              return (
                <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-4 rounded-xl text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Requisições/Mês</span>
                      <span className="text-lg font-bold">{reqsMês.toLocaleString('pt-BR')} chamadas</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-amber-400 block">OmniCoins Necessários</span>
                      <span className="text-lg font-bold text-amber-400">🪙 {coinsMês.toLocaleString('pt-BR')}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Custo Est. OpenRouter</span>
                      <span className="text-lg font-bold text-emerald-400">R$ {custoOpenRouterEst}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Plano Recomendado</span>
                      <span className="text-sm font-extrabold text-blue-300 block mt-0.5">{planoRecomendado}</span>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* SUITE DE VALIDAÇÃO COM 100 CHAMADAS REAIS/SIMULADAS */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Play className="w-4 h-4 text-emerald-600" />
                  <span>Suite de Simulação com 100 Chamadas de IA</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Simulação sintética de 100 requisições para estimar tokens, custos e precificação. Os dados gerados são fictícios (sem consumo real de OpenRouter).</p>
              </div>

              <button
                onClick={handleRun100CallsTest}
                disabled={isTesting100Calls}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg flex items-center gap-2 transition-all disabled:opacity-50 shadow-xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isTesting100Calls ? 'animate-spin' : ''}`} />
                <span>{isTesting100Calls ? 'Simulando 100 Chamadas...' : 'Executar Simulação de 100 Chamadas'}</span>
              </button>
            </div>

            {test100Result && (
              <div className="p-4 bg-slate-900 text-white rounded-xl space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" /> Relatório Sintético de Validação (100 Requisições Simuladas)
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">Status: Simulação 100/100</span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div className="bg-slate-800 p-2.5 rounded-lg border border-slate-700">
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">Total Tokens</span>
                    <span className="text-sm font-bold font-mono text-white">{test100Result.total_tokens?.toLocaleString('pt-BR')}</span>
                  </div>
                  <div className="bg-slate-800 p-2.5 rounded-lg border border-slate-700">
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">Custo OpenRouter</span>
                    <span className="text-sm font-bold text-amber-400 font-mono">R$ {test100Result.custo_openrouter_brl} <span className="text-[10px] text-slate-400">(US${test100Result.custo_openrouter_usd})</span></span>
                  </div>
                  <div className="bg-slate-800 p-2.5 rounded-lg border border-slate-700">
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">OmniCoins Cobrados</span>
                    <span className="text-sm font-bold text-amber-300 font-mono">🪙 {test100Result.omnicoins_consumed} Coins</span>
                  </div>
                  <div className="bg-slate-800 p-2.5 rounded-lg border border-slate-700">
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">Margem Bruta</span>
                    <span className="text-sm font-bold text-emerald-400 font-mono">{test100Result.margem_percentual}%</span>
                  </div>
                </div>

                <div className="p-3 bg-emerald-950/80 border border-emerald-800 rounded-lg text-xs text-emerald-200">
                  <strong>Recomendação Técnica:</strong> {test100Result.recomendacao_tecnica}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'infraestrutura' && (
        <div className="space-y-6">
          {/* SELETOR CENTRAL DE PROVEDOR DE IA DO SUPER ADMIN */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Bot className="w-4 h-4 text-primary" />
                  <span>Provedor de IA do Super Admin (Ambiente Exclusivo Master)</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Selecione qual provedor de IA será acionado nas operações executadas pelo Super Admin (Não altera o roteamento das empresas contratantes).
                </p>
              </div>

              <button
                onClick={handleSaveSuperAdminProvider}
                disabled={savingSuperAdminProvider}
                className="px-4 py-2 bg-primary hover:opacity-90 text-white text-xs font-bold rounded-lg flex items-center gap-2 transition-all shadow-xs disabled:opacity-50"
              >
                {savingSuperAdminProvider ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                <span>{savingSuperAdminProvider ? 'Salvando...' : 'Salvar Provedor do ADM'}</span>
              </button>
            </div>

            {superAdminProviderSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-lg flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Provedor de IA do Super Admin atualizado com sucesso!</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Opção 1: OpenRouter API Master */}
              <div 
                onClick={() => setSuperAdminAiProvider('openrouter_master')}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  superAdminAiProvider === 'openrouter_master'
                    ? 'bg-primary/5 border-primary shadow-xs'
                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100/60'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <input 
                      type="radio" 
                      name="superAdminProvider"
                      checked={superAdminAiProvider === 'openrouter_master'}
                      onChange={() => setSuperAdminAiProvider('openrouter_master')}
                      className="w-4 h-4 text-primary accent-primary cursor-pointer"
                    />
                    <span className="font-bold text-slate-900 text-xs">OpenRouter API Master</span>
                  </div>
                  {superAdminAiProvider === 'openrouter_master' && (
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold text-[10px] rounded border border-emerald-200 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Ativo
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Utiliza a credencial OpenRouter Master global da plataforma com acesso aos 15 modelos de ponta.
                </p>
              </div>

              {/* Opção 2: Endpoint Customizado / Proxy */}
              <div 
                onClick={() => setSuperAdminAiProvider('custom_endpoint')}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  superAdminAiProvider === 'custom_endpoint'
                    ? 'bg-primary/5 border-primary shadow-xs'
                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100/60'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <input 
                      type="radio" 
                      name="superAdminProvider"
                      checked={superAdminAiProvider === 'custom_endpoint'}
                      onChange={() => setSuperAdminAiProvider('custom_endpoint')}
                      className="w-4 h-4 text-primary accent-primary cursor-pointer"
                    />
                    <span className="font-bold text-slate-900 text-xs">Endpoint Customizado / Proxy</span>
                  </div>
                  {superAdminAiProvider === 'custom_endpoint' && (
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold text-[10px] rounded border border-emerald-200 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Ativo
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Roteia chamadas do Super ADM para o servidor local/proxy (<code className="text-slate-800 font-mono font-bold">{customAiUrl || 'http://localhost:20128/v1'}</code>, Modelo: <code className="text-slate-800 font-mono font-bold">{customAiModel || 'kimicode'}</code>).
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-100 text-xs">
              <input
                type="checkbox"
                id="chk_auto_fallback"
                checked={superAdminAutoFallback}
                onChange={(e) => setSuperAdminAutoFallback(e.target.checked)}
                className="w-4 h-4 rounded text-primary border-slate-300 accent-primary cursor-pointer"
              />
              <label htmlFor="chk_auto_fallback" className="font-semibold text-slate-700 cursor-pointer">
                Ativar fallback automático (se o Endpoint Customizado falhar, alternar temporariamente para OpenRouter Master)
              </label>
            </div>
          </div>



      {/* MODERN RESPONSIVE GRID OF INDEPENDENT CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 items-stretch">
        
        {/* CARD 1: OpenRouter API Integration (1 Coluna) */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
                  <Cpu className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900">OpenRouter API Master</h3>
                  <span className="text-[10px] text-slate-400 block">Acesso Global a 15 LLMs</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                  openRouterMasterKey ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                }`}>
                  {openRouterMasterKey ? 'Chave Ok' : 'Pendente'}
                </span>
                
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Motor:</span>
                  <button
                    onClick={() => setOpenRouterEnabled(!openRouterEnabled)}
                    className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${openRouterEnabled ? 'bg-emerald-500' : 'bg-slate-300'}`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${openRouterEnabled ? 'translate-x-5' : 'translate-x-1'}`} />
                  </button>
                </div>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Chave de API (`sk-or-v1-...`):
              </label>
              <input
                type="password"
                placeholder="sk-or-v1-****************"
                value={openRouterMasterKey}
                onChange={(e) => setOpenRouterMasterKey(e.target.value)}
                className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-mono focus:outline-none focus:border-primary"
              />
            </div>

            <button
              onClick={handleTestOpenRouterConnection}
              disabled={isTestingOpenRouter}
              className="w-full py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all"
            >
              {isTestingOpenRouter ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-primary" /> : <Sparkles className="w-3.5 h-3.5 text-primary" />}
              <span>{isTestingOpenRouter ? "Testando..." : "Testar Conexão API"}</span>
            </button>

            {openRouterTestResult && (
              <div className={`p-2 rounded text-[10px] font-semibold flex items-center gap-1.5 border ${
                openRouterTestResult.success ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'
              }`}>
                {openRouterTestResult.success ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />}
                <span className="truncate">{openRouterTestResult.message}</span>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-100 mt-auto space-y-2">
            {openRouterSuccess && (
              <div className="p-2 bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-bold rounded-md flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Salvo com sucesso!</span>
              </div>
            )}
            <button
              onClick={handleSaveOpenRouter}
              disabled={savingOpenRouter}
              className="w-full py-2 bg-primary hover:opacity-90 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all shadow-xs"
            >
              {savingOpenRouter ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>{savingOpenRouter ? "Salvando..." : "Salvar"}</span>
            </button>
          </div>
        </div>

        {/* CARD 2: LobeHub AI Integration (1 Coluna) */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
                  <Bot className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900">Integração LobeHub AI</h3>
                  <span className="text-[10px] text-slate-400 block">Sondagem de Agentes</span>
                </div>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">URL do Servidor LobeHub:</label>
              <input
                type="text"
                value={lobeHubServerUrl}
                onChange={(e) => setLobeHubServerUrl(e.target.value)}
                className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-mono focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Chave de API LobeHub:</label>
              <input
                type="password"
                value={lobeHubApiKey}
                onChange={(e) => setLobeHubApiKey(e.target.value)}
                className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-mono focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Modelo Padrão Lobe AI:</label>
              <select
                value={lobeDefaultModel}
                onChange={(e) => setLobeDefaultModel(e.target.value)}
                className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-bold focus:outline-none focus:border-primary cursor-pointer"
              >
                <option value="lobe-gpt-4o-mini">Lobe GPT-4o Mini Agent</option>
                <option value="lobe-claude-3.7-sonnet">Lobe Claude 3.7 Sonnet Agent</option>
                <option value="lobe-deepseek-v3">Lobe DeepSeek V3 Agent</option>
              </select>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 mt-auto space-y-2">
            {lobeSuccess && (
              <div className="p-2 bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-bold rounded-md flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Parâmetros LobeHub salvos!</span>
              </div>
            )}
            <button
              onClick={handleSaveLobeHub}
              disabled={savingLobeHub}
              className="w-full py-2 bg-primary hover:opacity-90 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all shadow-xs"
            >
              {savingLobeHub ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>{savingLobeHub ? "Salvando..." : "Salvar"}</span>
            </button>
          </div>
        </div>

        {/* CARD 3: Evolution API WhatsApp (1 Coluna) */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900">Evolution API WhatsApp</h3>
                  <span className="text-[10px] text-slate-400 block">Bot Multi-Tenant</span>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-amber-50 text-amber-800 border border-amber-200">
                Em breve
              </span>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">URL Base Evolution API:</label>
              <input
                type="text"
                value={evolutionUrl}
                onChange={(e) => setEvolutionUrl(e.target.value)}
                className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-mono focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Chave Global Evolution API Key:</label>
              <input
                type="password"
                value={evolutionApiKey}
                onChange={(e) => setEvolutionApiKey(e.target.value)}
                className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-mono focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 mt-auto space-y-2">
            {evolutionSuccess && (
              <div className="p-2 bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-bold rounded-md flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Evolution API salva!</span>
              </div>
            )}
            <button
              onClick={handleSaveEvolution}
              disabled={savingEvolution}
              className="w-full py-2 bg-primary hover:opacity-90 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all shadow-xs"
            >
              {savingEvolution ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>{savingEvolution ? "Salvando..." : "Salvar"}</span>
            </button>
          </div>
        </div>

        {/* CARD 4: Stripe Checkout & Faturamento (1 Coluna) */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900">Stripe Checkout</h3>
                  <span className="text-[10px] text-slate-400 block">Faturamento de OmniCoins</span>
                </div>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Publishable Key (Produção/Teste):</label>
              <input
                type="text"
                value={stripePublishableKey}
                onChange={(e) => setStripePublishableKey(e.target.value)}
                placeholder="pk_test_... ou pk_live_..."
                className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-mono focus:outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Secret Key (Master):</label>
              <input
                type="password"
                value={stripeSecretKey}
                onChange={(e) => setStripeSecretKey(e.target.value)}
                placeholder="sk_test_... ou sk_live_..."
                className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-mono focus:outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Webhook Secret (whsec_...):</label>
              <input
                type="password"
                value={stripeWebhookSecret}
                onChange={(e) => setStripeWebhookSecret(e.target.value)}
                placeholder="whsec_..."
                className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-mono focus:outline-none focus:border-blue-600"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 mt-auto space-y-2">
            {stripeSuccess && (
              <div className="p-2 bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-bold rounded-md flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Chaves Stripe salvas!</span>
              </div>
            )}
            <button
              onClick={handleSaveStripe}
              disabled={savingStripe}
              className="w-full py-2 bg-primary hover:opacity-90 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all shadow-xs"
            >
              {savingStripe ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>{savingStripe ? "Salvando..." : "Salvar"}</span>
            </button>
          </div>
        </div>

        {/* GESTÃO DE CHAVES DE API POR EMPRESA (INLINE) */}
        <div className="col-span-1 md:col-span-2 lg:col-span-4 bg-white p-5 lg:p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Key className="w-4 h-4 text-primary" />
                <span>Gestão de Chaves API por Empresa (Multi-Tenant)</span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Configure chaves da OpenRouter individualmente para cada ambiente</p>
            </div>
          </div>

          <div className="space-y-3">
            {companies.map(c => {
              const isEditing = selectedCompForAi?.id === c.id;
              const hasKey = c.openrouterApiKey && c.openrouterApiKey.length > 5;
              
              return (
                <div key={c.id} className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="flex-1">
                    <span className="font-bold text-slate-900 block">{c.tradeName || c.corporateName}</span>
                    <span className="text-[10px] text-slate-500">CNPJ: {c.cnpj}</span>
                  </div>
                  
                  <div className="flex-2 flex flex-col xl:flex-row xl:items-center gap-3">
                    <div className="w-full xl:w-64 shrink-0">
                      <input
                        type={isEditing ? "text" : "password"}
                        placeholder={hasKey ? (c.openrouterKeyMasked || "Chave salva") : "Utilizando API Master..."}
                        value={isEditing ? compApiKeyInput : (c.openrouterApiKey || "")}
                        readOnly={!isEditing}
                        onChange={(e) => {
                          if (isEditing) setCompApiKeyInput(e.target.value);
                        }}
                        className={`w-full h-9 px-3 text-xs border rounded-lg text-slate-900 font-mono focus:outline-none ${isEditing ? 'bg-white border-primary ring-1 ring-primary/20 shadow-xs' : 'bg-slate-100 border-slate-200 text-slate-500 cursor-default'}`}
                      />
                    </div>
                    
                    {isEditing ? (
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <button
                          onClick={handleTestCompanyOpenRouterKey}
                          disabled={testingCompKey || !compApiKeyInput.trim()}
                          className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-[11px] font-bold rounded-lg transition-colors disabled:opacity-50"
                        >
                          {testingCompKey ? 'Testando...' : 'Testar'}
                        </button>
                        <button
                          onClick={handleSaveCompanyOpenRouterKey}
                          disabled={savingCompKey || !compApiKeyInput.trim()}
                          className="px-3 py-1.5 bg-primary hover:opacity-90 text-white text-[11px] font-bold rounded-lg transition-colors shadow-xs disabled:opacity-50"
                        >
                          {savingCompKey ? 'Salvando...' : 'Salvar API'}
                        </button>
                        <button
                          onClick={() => {
                            setSelectedCompForAi(null);
                            setCompApiKeyInput("");
                            setCompKeyTestNotice(null);
                          }}
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <button
                          onClick={() => {
                            setSelectedCompForAi(c);
                            setCompApiKeyInput(c.openrouterApiKey || "");
                          }}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-[11px] font-bold rounded-lg transition-colors shadow-xs"
                        >
                          Configurar API
                        </button>
                        {hasKey && (
                          <button
                            onClick={() => {
                              setSelectedCompForAi(c);
                              setShowRemoveCompKeyModal(true);
                            }}
                            className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-100 text-[11px] font-bold rounded-lg transition-colors"
                          >
                            Remover
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          
          {compKeyTestNotice && (
            <div className={`p-3 mt-3 rounded-lg border text-xs font-semibold ${
              compKeyTestNotice.success ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'
            }`}>
              {compKeyTestNotice.message}
            </div>
          )}
        </div>

        {/* CARD COMPLEXO 5: Endpoint Customizado IA (Local/Proxy) */}
        <div className="col-span-1 bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
                  <Server className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900">Endpoint Customizado IA (Local / Proxy)</h3>
                  <span className="text-[10px] text-slate-400 block">Roteamento direto de requisições LLM</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase text-slate-400">Status:</span>
                <button
                  onClick={() => setCustomAiEnabled(!customAiEnabled)}
                  className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${customAiEnabled ? 'bg-primary' : 'bg-slate-300'}`}
                >
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${customAiEnabled ? 'translate-x-5' : 'translate-x-1'}`} />
                </button>
              </div>
            </div>

            <p className="text-[11px] text-slate-500">
              Se ativo, todas as requisições de IA serão roteadas para este endpoint em vez da OpenRouter.
            </p>

            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Endpoint API:</label>
                <input
                  type="text"
                  value={customAiUrl}
                  onChange={(e) => setCustomAiUrl(e.target.value)}
                  className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-mono focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Token de Acesso:</label>
                <input
                  type="text"
                  value={customAiKey}
                  onChange={(e) => setCustomAiKey(e.target.value)}
                  className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-mono focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Modelo / Combo:</label>
                <input
                  type="text"
                  value={customAiModel}
                  onChange={(e) => setCustomAiModel(e.target.value)}
                  className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-mono focus:outline-none focus:border-primary"
                  placeholder="auto"
                />
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 mt-auto space-y-2">
            {customAiSuccess && (
              <div className="p-2 bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-bold rounded-md flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Endpoint Customizado salvo com sucesso!</span>
              </div>
            )}
            <button
              onClick={handleSaveCustomAi}
              disabled={savingCustomAi}
              className="w-full py-2 bg-primary hover:opacity-90 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all shadow-xs"
            >
              {savingCustomAi ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>{savingCustomAi ? "Salvando..." : "Salvar Endpoint Customizado"}</span>
            </button>
          </div>
        </div>

        {/* CARD COMPLEXO 6: Fluxo Comercial de Cadastro & Venda Manual */}
        <div className="col-span-1 bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900">Venda Manual & Gerador de Checkout</h3>
                  <span className="text-[10px] text-slate-400 block">Fluxo comercial unificado Stripe</span>
                </div>
              </div>
            </div>

            <div className="space-y-2 text-xs text-slate-600 leading-relaxed">
              <p className="font-semibold text-slate-800">
                Centralização Comercial Unificada
              </p>
              <p className="text-[11px] text-slate-500">
                O cadastro de novos clientes e a geração de links de pagamento Stripe foram centralizados no <strong>Centro de Comando Multi-Finance</strong>.
              </p>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-[10px] space-y-1 text-slate-600">
                <span className="font-bold block text-slate-800">Regra Comercial Segura:</span>
                <span>1. Cadastro Comercial no Centro de Comando</span>
                <span className="block">2. Gerador de Checkout Stripe Real</span>
                <span className="block">3. Confirmação do Pagamento via Webhook</span>
                <span className="block">4. Provisionamento em "Pedidos de Compra SaaS"</span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 mt-auto">
            <a
              href="/empresas"
              className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all shadow-xs"
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Ir para Centro de Comando (Nova Venda Manual)</span>
            </a>
          </div>
        </div>

        {/* CARD COMPLEXO 7: Criar Usuário para Empresa */}
        <div className="col-span-1 md:col-span-2 lg:col-span-2 bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900">Criar Usuário (Gestor ou Funcionário)</h3>
                  <span className="text-[10px] text-slate-400 block">Vincular acesso à empresa contratante</span>
                </div>
              </div>
              <BatchUserUpload
                companyId={targetCompanyId}
                companyName={companies.find(c => c.id === targetCompanyId)?.tradeName || companies.find(c => c.id === targetCompanyId)?.corporateName}
                jobRoles={jobRoles}
                defaultRole={newUserRole}
                defaultModules={selectedUserModules}
                onCreated={() => {
                  setAllEmployees(getEmployees());
                }}
              />
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Empresa Destino:</label>
                <select
                  value={targetCompanyId}
                  onChange={(e) => setTargetCompanyId(e.target.value)}
                  className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-bold focus:outline-none focus:border-primary cursor-pointer"
                >
                  {companies.map(c => (
                    <option key={c.id} value={c.id}>{c.tradeName || c.corporateName} ({c.cnpj})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Nome Completo:</label>
                  <input
                    type="text"
                    placeholder="Ex: Carlos Mendes"
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-bold focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">E-mail Corporativo:</label>
                  <input
                    type="email"
                    placeholder="carlos@empresa.com.br"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-medium focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Data de Nascimento (Opcional):</label>
                  <input
                    type="date"
                    value={newUserBirthDate}
                    onChange={(e) => setNewUserBirthDate(e.target.value)}
                    className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-medium focus:outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Cargo / Departamento:</label>
                  <div className="flex items-center gap-1">
                    <select
                      value={newUserDept}
                      onChange={(e) => setNewUserDept(e.target.value)}
                      className="flex-1 h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-bold focus:outline-none focus:border-primary cursor-pointer truncate"
                    >
                      {jobRoles.map(jr => (
                        <option key={jr} value={jr}>{jr}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setShowAddRoleModal(true)}
                      className="w-9 h-9 bg-slate-100 border border-slate-200 hover:bg-slate-200 text-slate-700 rounded-lg flex items-center justify-center transition-colors shrink-0"
                      title="Criar Novo Cargo"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Função de Acesso:</label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value as any)}
                  className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-bold focus:outline-none focus:border-primary cursor-pointer"
                >
                  <option value="gestor">Gestor do Escritório</option>
                  <option value="funcionario">Funcionário Operacional</option>
                </select>
              </div>

              <div className="pt-2 space-y-1.5 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Permissão por Módulos (Módulos Iniciais):
                  </label>
                  <div className="flex items-center gap-1.5 text-[10px] font-bold">
                    <button 
                      type="button" 
                      onClick={() => setSelectedUserModules(ALL_SYSTEM_MODULES.map(m => m.id))} 
                      className="text-primary hover:underline"
                    >
                      Todos
                    </button>
                    <span className="text-slate-300">|</span>
                    <button 
                      type="button" 
                      onClick={() => setSelectedUserModules([])} 
                      className="text-slate-400 hover:underline"
                    >
                      Nenhum
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1 max-h-[100px] overflow-y-auto pr-1">
                  {ALL_SYSTEM_MODULES.map(mod => {
                    const isSelected = selectedUserModules.includes(mod.id);
                    return (
                      <button
                        key={mod.id}
                        type="button"
                        onClick={() => {
                          setSelectedUserModules(prev => 
                            prev.includes(mod.id) ? prev.filter(m => m !== mod.id) : [...prev, mod.id]
                          );
                        }}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                          isSelected
                            ? 'bg-primary/10 text-primary border-primary/40'
                            : 'bg-slate-50 text-slate-400 border-slate-200 hover:text-slate-700'
                        }`}
                      >
                        {isSelected ? `✓ ${mod.label}` : `+ ${mod.label}`}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 mt-auto space-y-2">
            <button
              onClick={handleCreateUserForCompany}
              disabled={savingUser}
              className="w-full py-2 bg-primary hover:opacity-90 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all shadow-xs"
            >
              {savingUser ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
              <span>{savingUser ? "Vribculando..." : "Vincular Usuário à Empresa"}</span>
            </button>
          </div>
        </div>

        {/* Removed table per user request */}
      </div>
      </div>
      )}

      {/* MODAL CONFIGURAÇÃO OPENROUTER DA EMPRESA */}
      {selectedCompForAi && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Bot className="w-4 h-4 text-primary" />
                  <span>OpenRouter IA da Empresa</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {selectedCompForAi.tradeName || selectedCompForAi.corporateName} (CNPJ: {selectedCompForAi.cnpj})
                </p>
              </div>
              <button 
                onClick={() => setSelectedCompForAi(null)}
                className="w-7 h-7 rounded-lg text-slate-400 hover:bg-slate-200 flex items-center justify-center text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Status Atual */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                <span className="font-bold text-slate-500">Status da Credencial:</span>
                {selectedCompForAi.openrouterApiKey ? (
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold text-[10px] rounded border border-emerald-200 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> 🟢 API própria conectada
                  </span>
                ) : (
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-800 font-bold text-[10px] rounded border border-blue-200 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> 🔵 Utilizando API Master (Fallback)
                  </span>
                )}
              </div>

              {/* Se já existe chave salva */}
              {selectedCompForAi.openrouterApiKey && (
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Chave Atual Cadastrada:</label>
                  <input
                    type="text"
                    disabled
                    value={selectedCompForAi.openrouterKeyMasked || "sk-or-v1-••••••••7F82"}
                    className="w-full h-9 px-3 bg-slate-100 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-600"
                  />
                </div>
              )}

              {/* Input da nova chave */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  {selectedCompForAi.openrouterApiKey ? 'Nova OpenRouter API Key:' : 'OpenRouter API Key:'}
                </label>
                <input
                  type="password"
                  placeholder="sk-or-v1-..."
                  value={compApiKeyInput}
                  onChange={(e) => setCompApiKeyInput(e.target.value)}
                  className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-800 focus:bg-white focus:border-primary focus:outline-hidden"
                />
              </div>

              {compKeyTestNotice && (
                <div className={`p-3 rounded-lg border text-xs font-semibold ${
                  compKeyTestNotice.success ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'
                }`}>
                  {compKeyTestNotice.message}
                </div>
              )}

              {/* Botões de Ação */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleTestCompanyOpenRouterKey}
                    disabled={testingCompKey || !compApiKeyInput.trim()}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-lg transition-all border border-slate-200 disabled:opacity-50 cursor-pointer"
                  >
                    {testingCompKey ? 'Testando...' : 'Testar Conexão'}
                  </button>

                  <button
                    onClick={handleSaveCompanyOpenRouterKey}
                    disabled={savingCompKey || !compApiKeyInput.trim()}
                    className="px-4 py-2 bg-primary hover:opacity-90 text-white text-xs font-bold rounded-lg transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    {savingCompKey ? 'Salvando...' : 'Salvar API'}
                  </button>
                </div>

                {selectedCompForAi.openrouterApiKey && (
                  <button
                    onClick={() => setShowRemoveCompKeyModal(true)}
                    className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold rounded-lg transition-all border border-red-200 cursor-pointer"
                  >
                    Remover API
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO PARA REMOVER API DA EMPRESA */}
      {showRemoveCompKeyModal && selectedCompForAi && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl p-6 text-center space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-red-50 border border-red-200 text-red-600 flex items-center justify-center mx-auto text-xl font-bold">
              ⚠️
            </div>
            <div>
              <h4 className="text-base font-bold text-slate-900">Remover API OpenRouter da Empresa?</h4>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Esta empresa passará a utilizar a <strong>API Master</strong> da plataforma para todas as chamadas de IA.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setShowRemoveCompKeyModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleRemoveCompanyOpenRouterKey}
                disabled={removingCompKey}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg transition-all shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {removingCompKey ? 'Removendo...' : 'Confirmar Remoção'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL SENHA TEMPORÁRIA DO USUÁRIO CRIADO */}
      {createdUserTempPassModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-amber-600" />
                <h3 className="text-base font-bold text-slate-900">Senha Temporária Gerada para Cadastro</h3>
              </div>
              <button onClick={() => setCreatedUserTempPassModal(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 font-medium space-y-1">
              <p><strong>Colaborador:</strong> {createdUserTempPassModal.name} ({createdUserTempPassModal.email})</p>
              <p className="text-[11px] text-amber-700">O colaborador deverá trocar essa senha obrigatoriamente no primeiro acesso.</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Senha Temporária Gerada:</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={createdUserTempPassModal.password}
                  className="w-full h-10 px-3 bg-slate-100 border border-slate-300 rounded-lg font-mono text-sm font-bold text-slate-900 tracking-wider text-center"
                />
                <button
                  onClick={() => copyPasswordToClipboard(createdUserTempPassModal.password)}
                  className="px-4 h-10 bg-primary hover:bg-primary/90 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 shrink-0 transition-colors shadow-xs"
                >
                  <Copy className="w-4 h-4" />
                  <span>{copyPassSuccess ? "Copiado!" : "Copiar"}</span>
                </button>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setCreatedUserTempPassModal(null)}
                className="px-4 py-2 bg-slate-900 text-white font-bold text-xs rounded-lg hover:bg-slate-800 transition-colors"
              >
                Concluir & Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
