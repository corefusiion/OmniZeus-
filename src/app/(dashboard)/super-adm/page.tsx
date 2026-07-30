"use client";

import { useState, useEffect } from "react";
import { 
  Shield, Key, TrendingUp, AlertTriangle, Save, CheckCircle2, Crown, 
  CreditCard, Cpu, DollarSign, Users, Building2, Plus, Link as LinkIcon, MessageSquare, Trash2, Bot, Sparkles, RefreshCw, Check, X,
  Briefcase, ShieldCheck, UserPlus, Globe, Server
} from "lucide-react";
import { getActiveRole, UserRole } from "@/lib/auth/roles";
import { 
  getCompanies, saveCompany, CompanyProfile, 
  getEmployees, saveEmployee, EmployeeUser, ALL_SYSTEM_MODULES 
} from "@/lib/company/store";
import { fetchServerSettings, updateServerSettings, fetchCustomJobRoles, saveCustomJobRoles } from "@/lib/db/serverDb";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

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
  const [role, setRole] = useState<UserRole>("super_adm");
  
  // Master API Keys State (SQL DB Backed)
  const [stripeSecretKey, setStripeSecretKey] = useState("sk_live_51M********************************");
  const [stripePublishableKey, setStripePublishableKey] = useState("pk_live_51M********************************");
  const [openRouterMasterKey, setOpenRouterMasterKey] = useState("");
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
  const [userSuccess, setUserSuccess] = useState(false);

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

  const [warningMessage, setWarningMessage] = useState<string | null>(null);

  useEffect(() => {
    setRole(getActiveRole());
    const listComp = getCompanies();
    setCompanies(listComp);
    if (listComp.length > 0) setTargetCompanyId(listComp[0].id);
    setAllEmployees(getEmployees());

    fetchCustomJobRoles().then((savedRoles) => {
      if (savedRoles && savedRoles.length > 0) setJobRoles(savedRoles);
    }).catch(() => {});

    // Load master settings directly from local SQL Database file
    async function loadSqlSettings() {
      const s = await fetchServerSettings();
      if (s) {
        if (s.openrouter_api_key) setOpenRouterMasterKey(s.openrouter_api_key);
        if (s.lobehub_url) setLobeHubServerUrl(s.lobehub_url);
        if (s.lobehub_api_key) setLobeHubApiKey(s.lobehub_api_key);
        if (s.lobehub_model) setLobeDefaultModel(s.lobehub_model);
        if (s.evolution_url) setEvolutionUrl(s.evolution_url);
        if (s.evolution_api_key) setEvolutionApiKey(s.evolution_api_key);
        if (s.stripe_pub_key) setStripePublishableKey(s.stripe_pub_key);
        if (s.stripe_secret_key) setStripeSecretKey(s.stripe_secret_key);
        if (s.custom_ai_enabled !== undefined) setCustomAiEnabled(s.custom_ai_enabled);
        if (s.custom_ai_url) setCustomAiUrl(s.custom_ai_url);
        if (s.custom_ai_key) setCustomAiKey(s.custom_ai_key);
        if (s.custom_ai_model) setCustomAiModel(s.custom_ai_model);
      }
    }
    loadSqlSettings();

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

  const handleSaveOpenRouter = async () => {
    if (!openRouterMasterKey.trim()) {
      setWarningMessage("Por favor, informe uma chave de API válida da OpenRouter.");
      return;
    }
    setSavingOpenRouter(true);
    const ok = await updateServerSettings({
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
      stripe_pub_key: stripePublishableKey,
      stripe_secret_key: stripeSecretKey
    });
    setSavingStripe(false);
    if (ok) {
      setStripeSuccess(true);
      setTimeout(() => setStripeSuccess(false), 2500);
    }
  };

  const handleCreateCompany = () => {
    if (!newCorpName.trim() || !newCnpj.trim()) {
      setWarningMessage("Por favor, preencha a Razão Social e o CNPJ da nova empresa contratante.");
      return;
    }
    setSavingCompany(true);
    saveCompany({
      corporateName: newCorpName.trim(),
      tradeName: newCorpName.trim().split(" ")[0] + " Contábil",
      cnpj: newCnpj.trim(),
      city: newCity,
      state: newState,
      plan: newPlan,
      coinsFranchise: newCoins,
      activeClientsCount: 0,
      monthlyRevenueBrl: newPlan === 'Profissional' ? 490 : newPlan === 'Premium' ? 890 : 1990,
      status: 'Ativo'
    });

    setSavingCompany(false);
    setNewCorpName("");
    setNewCnpj("");
    setCompanySuccess(true);
    setTimeout(() => setCompanySuccess(false), 2500);
  };

  const handleCreateUserForCompany = () => {
    if (!newUserName.trim() || !newUserEmail.trim() || !targetCompanyId) {
      setWarningMessage("Por favor, preencha a empresa destinatária, o nome e o e-mail do usuário.");
      return;
    }
    setSavingUser(true);
    saveEmployee({
      companyId: targetCompanyId,
      name: newUserName.trim(),
      email: newUserEmail.trim(),
      department: newUserDept,
      role: newUserRole,
      birthDate: newUserBirthDate || undefined,
      allowedModules: selectedUserModules,
      status: 'Ativo'
    });

    setSavingUser(false);
    setNewUserName("");
    setNewUserEmail("");
    setNewUserBirthDate("");
    setUserSuccess(true);
    setTimeout(() => setUserSuccess(false), 2500);
  };

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
                <Briefcase className="w-4 h-4 text-[#1E6FD9]" />
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
                className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-bold focus:outline-none focus:border-[#1E6FD9]"
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
                className="px-4 py-1.5 bg-[#1E6FD9] hover:bg-blue-600 text-white text-xs font-semibold rounded-lg shadow-xs"
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

      {/* Header Limpo */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 lg:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-50 text-[#1E6FD9] flex items-center justify-center">
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

      {/* Top KPIs Limpos */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Margem Líquida Média</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900">98.6%</p>
          <p className="text-[10px] text-emerald-600 font-semibold">Margem Líquida Real do SaaS</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Status da API OpenRouter</span>
            <Cpu className="w-4 h-4 text-[#1E6FD9]" />
          </div>
          <div className="flex items-center gap-2">
            <p className="text-lg font-bold text-slate-900">
              {openRouterMasterKey ? 'Chave Master Ativa' : 'Chave Pendente'}
            </p>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
              openRouterMasterKey ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
            }`}>
              {openRouterMasterKey ? 'Conectado' : 'Aguardando'}
            </span>
          </div>
          <p className="text-[10px] text-slate-400">Acesso global a 15 LLMs (GPT-4o, Claude 3.7, Gemini 2.5)</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Escritórios Cadastrados</span>
            <Building2 className="w-4 h-4 text-[#1E6FD9]" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{companies.length} Empresa(s)</p>
          <p className="text-[10px] text-slate-400">Ambientes cadastrados e ativos</p>
        </div>
      </div>

      {/* MODERN RESPONSIVE GRID OF INDEPENDENT CARDS (Breakpoints: 4 cols ≥1440px | 3 cols ≥1024px | 2 cols ≥768px | 1 col <768px) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-5 items-stretch">
        
        {/* CARD 1: OpenRouter API Integration (1 Coluna) */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-50 text-[#1E6FD9] flex items-center justify-center font-bold">
                  <Cpu className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900">OpenRouter API Master</h3>
                  <span className="text-[10px] text-slate-400 block">Acesso Global a 15 LLMs</span>
                </div>
              </div>
              <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                openRouterMasterKey ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
              }`}>
                {openRouterMasterKey ? 'Ativo' : 'Pendente'}
              </span>
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
                className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-mono focus:outline-none focus:border-[#1E6FD9]"
              />
            </div>

            <button
              onClick={handleTestOpenRouterConnection}
              disabled={isTestingOpenRouter}
              className="w-full py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all"
            >
              {isTestingOpenRouter ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#1E6FD9]" /> : <Sparkles className="w-3.5 h-3.5 text-[#1E6FD9]" />}
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
              className="w-full py-2 bg-[#1E6FD9] hover:bg-blue-600 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all shadow-xs"
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
                <div className="w-7 h-7 rounded-lg bg-blue-50 text-[#1E6FD9] flex items-center justify-center font-bold">
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
                className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-mono focus:outline-none focus:border-[#1E6FD9]"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Chave de API LobeHub:</label>
              <input
                type="password"
                value={lobeHubApiKey}
                onChange={(e) => setLobeHubApiKey(e.target.value)}
                className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-mono focus:outline-none focus:border-[#1E6FD9]"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Modelo Padrão Lobe AI:</label>
              <select
                value={lobeDefaultModel}
                onChange={(e) => setLobeDefaultModel(e.target.value)}
                className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-bold focus:outline-none focus:border-[#1E6FD9] cursor-pointer"
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
              className="w-full py-2 bg-[#1E6FD9] hover:bg-blue-600 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all shadow-xs"
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
                className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-mono focus:outline-none focus:border-[#1E6FD9]"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Chave Global Evolution API Key:</label>
              <input
                type="password"
                value={evolutionApiKey}
                onChange={(e) => setEvolutionApiKey(e.target.value)}
                className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-mono focus:outline-none focus:border-[#1E6FD9]"
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
              className="w-full py-2 bg-[#1E6FD9] hover:bg-blue-600 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all shadow-xs"
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
                <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900">Stripe Checkout</h3>
                  <span className="text-[10px] text-slate-400 block">Faturamento de OmniCoins</span>
                </div>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Publishable Key (Produção):</label>
              <input
                type="text"
                value={stripePublishableKey}
                onChange={(e) => setStripePublishableKey(e.target.value)}
                className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-mono focus:outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Secret Key (Master):</label>
              <input
                type="password"
                value={stripeSecretKey}
                onChange={(e) => setStripeSecretKey(e.target.value)}
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
              className="w-full py-2 bg-[#1E6FD9] hover:bg-blue-600 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all shadow-xs"
            >
              {savingStripe ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>{savingStripe ? "Salvando..." : "Salvar"}</span>
            </button>
          </div>
        </div>

        {/* CARD COMPLEXO 5: Endpoint Customizado IA (Local/Proxy) — (Spans 2 Colunas) */}
        <div className="col-span-1 md:col-span-2 bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-50 text-[#1E6FD9] flex items-center justify-center font-bold">
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
                  className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${customAiEnabled ? 'bg-[#1E6FD9]' : 'bg-slate-300'}`}
                >
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${customAiEnabled ? 'translate-x-5' : 'translate-x-1'}`} />
                </button>
              </div>
            </div>

            <p className="text-[11px] text-slate-500">
              Se ativo, todas as requisições de IA serão roteadas para este endpoint em vez da OpenRouter.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Endpoint API:</label>
                <input
                  type="text"
                  value={customAiUrl}
                  onChange={(e) => setCustomAiUrl(e.target.value)}
                  className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-mono focus:outline-none focus:border-[#1E6FD9]"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Token de Acesso:</label>
                <input
                  type="text"
                  value={customAiKey}
                  onChange={(e) => setCustomAiKey(e.target.value)}
                  className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-mono focus:outline-none focus:border-[#1E6FD9]"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Modelo / Combo:</label>
                <input
                  type="text"
                  value={customAiModel}
                  onChange={(e) => setCustomAiModel(e.target.value)}
                  className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-mono focus:outline-none focus:border-[#1E6FD9]"
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
              className="w-full py-2 bg-[#1E6FD9] hover:bg-blue-600 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all shadow-xs"
            >
              {savingCustomAi ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>{savingCustomAi ? "Salvando..." : "Salvar Endpoint Customizado"}</span>
            </button>
          </div>
        </div>

        {/* CARD COMPLEXO 6: Cadastrar Nova Empresa Contratante (Spans 2 Colunas) */}
        <div className="col-span-1 md:col-span-2 bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-50 text-[#1E6FD9] flex items-center justify-center font-bold">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900">Cadastrar Nova Empresa Contratante</h3>
                  <span className="text-[10px] text-slate-400 block">Provisionar novo Tenant isolado</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Razão Social:</label>
                <input
                  type="text"
                  placeholder="Ex: Alfa Contabilidade & BPO Eireli"
                  value={newCorpName}
                  onChange={(e) => setNewCorpName(e.target.value)}
                  className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-medium focus:outline-none focus:border-[#1E6FD9]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">CNPJ:</label>
                  <input
                    type="text"
                    placeholder="00.000.000/0001-00"
                    value={newCnpj}
                    onChange={(e) => setNewCnpj(e.target.value)}
                    className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-medium focus:outline-none focus:border-[#1E6FD9]"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Plano SaaS:</label>
                  <select
                    value={newPlan}
                    onChange={(e) => {
                      const p = e.target.value as any;
                      setNewPlan(p);
                      setNewCoins(p === 'Profissional' ? 5000 : p === 'Premium' ? 15000 : 50000);
                    }}
                    className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-bold focus:outline-none focus:border-[#1E6FD9] cursor-pointer"
                  >
                    <option value="Profissional">Profissional (R$ 490 / 5k Coins)</option>
                    <option value="Premium">Premium (R$ 890 / 15k Coins)</option>
                    <option value="Business">Business (R$ 1.990 / 50k Coins)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 mt-auto space-y-2">
            {companySuccess && (
              <div className="p-2 bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-bold rounded-md flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Empresa cadastrada com sucesso!</span>
              </div>
            )}
            <button
              onClick={handleCreateCompany}
              disabled={savingCompany}
              className="w-full py-2 bg-[#1E6FD9] hover:bg-blue-600 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all shadow-xs"
            >
              {savingCompany ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Building2 className="w-3.5 h-3.5" />}
              <span>{savingCompany ? "Cadastrando..." : "Cadastrar Empresa"}</span>
            </button>
          </div>
        </div>

        {/* CARD COMPLEXO 7: Criar Usuário para Empresa (Spans 2 Colunas) */}
        <div className="col-span-1 md:col-span-2 bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-50 text-[#1E6FD9] flex items-center justify-center font-bold">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900">Criar Usuário (Gestor ou Funcionário)</h3>
                  <span className="text-[10px] text-slate-400 block">Vincular acesso à empresa contratante</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Empresa Destino:</label>
                <select
                  value={targetCompanyId}
                  onChange={(e) => setTargetCompanyId(e.target.value)}
                  className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-bold focus:outline-none focus:border-[#1E6FD9] cursor-pointer"
                >
                  {companies.map(c => (
                    <option key={c.id} value={c.id}>{c.tradeName || c.corporateName} ({c.cnpj})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Nome Completo:</label>
                  <input
                    type="text"
                    placeholder="Ex: Carlos Mendes"
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-bold focus:outline-none focus:border-[#1E6FD9]"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">E-mail Corporativo:</label>
                  <input
                    type="email"
                    placeholder="carlos@empresa.com.br"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-medium focus:outline-none focus:border-[#1E6FD9]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Data de Nascimento (Opcional):</label>
                  <input
                    type="date"
                    value={newUserBirthDate}
                    onChange={(e) => setNewUserBirthDate(e.target.value)}
                    className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-medium focus:outline-none focus:border-[#1E6FD9]"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Cargo / Departamento:</label>
                  <div className="flex items-center gap-1">
                    <select
                      value={newUserDept}
                      onChange={(e) => setNewUserDept(e.target.value)}
                      className="flex-1 h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-bold focus:outline-none focus:border-[#1E6FD9] cursor-pointer truncate"
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
                  className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-bold focus:outline-none focus:border-[#1E6FD9] cursor-pointer"
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
                      className="text-blue-600 hover:underline"
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
                            ? 'bg-blue-50 text-[#1E6FD9] border-[#1E6FD9]/40'
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
            {userSuccess && (
              <div className="p-2 bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-bold rounded-md flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Usuário vinculado com sucesso!</span>
              </div>
            )}
            <button
              onClick={handleCreateUserForCompany}
              disabled={savingUser}
              className="w-full py-2 bg-[#1E6FD9] hover:bg-blue-600 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all shadow-xs"
            >
              {savingUser ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
              <span>{savingUser ? "Vribculando..." : "Vincular Usuário à Empresa"}</span>
            </button>
          </div>
        </div>

        {/* FULL WIDTH TABLE: Registered Companies Dedicated Table (Spans all columns) */}
        <div className="col-span-1 md:col-span-2 lg:col-span-3 2xl:col-span-4 bg-white p-5 lg:p-6 rounded-xl border border-slate-200 shadow-xs space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-[#1E6FD9]" />
            <span>Empresas Contratantes Cadastradas ({companies.length})</span>
          </h4>

          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider text-[10px] bg-slate-50">
                  <th className="py-3 px-4">Empresa / Razão Social</th>
                  <th className="py-3 px-4">CNPJ & Localização</th>
                  <th className="py-3 px-4">Plano & Franquia Coins</th>
                  <th className="py-3 px-4">Usuários Cadastrados</th>
                  <th className="py-3 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {companies.map(c => {
                  const empCount = allEmployees.filter(e => e.companyId === c.id).length;
                  return (
                    <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        {c.tradeName || c.corporateName}
                        <span className="text-[10px] text-slate-400 block font-normal">{c.corporateName}</span>
                      </td>
                      <td className="py-3.5 px-4 font-medium">{c.cnpj} • {c.city}/{c.state}</td>
                      <td className="py-3.5 px-4">
                        <span className="font-extrabold text-[#1E6FD9]">{c.plan}</span>
                        <span className="text-[10px] text-slate-500 block">{(c.coinsFranchise).toLocaleString('pt-BR')} Coins/mês</span>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-800">
                        {empCount} Colaborador(es)
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {c.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
