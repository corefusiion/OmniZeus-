"use client";

import { useState, useEffect } from "react";
import { 
  Shield, Key, TrendingUp, AlertTriangle, Save, CheckCircle2, Crown, 
  CreditCard, Cpu, DollarSign, Users, Building2, Plus, Link as LinkIcon, MessageSquare, Trash2, Bot, Sparkles, RefreshCw, Check, X
} from "lucide-react";
import { getActiveRole, UserRole } from "@/lib/auth/roles";
import { 
  getCompanies, saveCompany, CompanyProfile, 
  getEmployees, saveEmployee, EmployeeUser 
} from "@/lib/company/store";
import { fetchServerSettings, updateServerSettings } from "@/lib/db/serverDb";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

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

  // User Creation for Company State
  const [allEmployees, setAllEmployees] = useState<EmployeeUser[]>([]);
  const [targetCompanyId, setTargetCompanyId] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserRole, setNewUserRole] = useState<'gestor' | 'funcionario'>('gestor');
  const [newUserDept, setNewUserDept] = useState("Diretoria Contábil");

  const [warningMessage, setWarningMessage] = useState<string | null>(null);

  useEffect(() => {
    setRole(getActiveRole());
    const listComp = getCompanies();
    setCompanies(listComp);
    if (listComp.length > 0) setTargetCompanyId(listComp[0].id);
    setAllEmployees(getEmployees());

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

  const handleSaveLobeHub = async () => {
    const ok = await updateServerSettings({
      lobehub_url: lobeHubServerUrl,
      lobehub_api_key: lobeHubApiKey,
      lobehub_model: lobeDefaultModel
    });
    if (ok) {
      setLobeSuccess(true);
      setTimeout(() => setLobeSuccess(false), 2500);
    }
  };

  const handleSaveCustomAi = async () => {
    const ok = await updateServerSettings({
      custom_ai_enabled: customAiEnabled,
      custom_ai_url: customAiUrl.trim(),
      custom_ai_key: customAiKey.trim(),
      custom_ai_model: customAiModel.trim()
    });
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
    const ok = await updateServerSettings({
      openrouter_api_key: openRouterMasterKey.trim()
    });
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
    const ok = await updateServerSettings({
      evolution_url: evolutionUrl,
      evolution_api_key: evolutionApiKey
    });
    if (ok) {
      setEvolutionSuccess(true);
      setTimeout(() => setEvolutionSuccess(false), 2500);
    }
  };

  const handleSaveStripe = async () => {
    const ok = await updateServerSettings({
      stripe_pub_key: stripePublishableKey,
      stripe_secret_key: stripeSecretKey
    });
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

    saveEmployee({
      companyId: targetCompanyId,
      name: newUserName.trim(),
      email: newUserEmail.trim(),
      department: newUserDept,
      role: newUserRole,
      allowedModules: ['omni-ia', 'financeiro', 'contaazul', 'whatsapp-bot', 'tarefas', 'documentos', 'apresentacoes'],
      status: 'Ativo'
    });

    setNewUserName("");
    setNewUserEmail("");
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
          Este painel é reservado exclusivamente para o perfil Super ADM Master da plataforma OmniZeus.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-slate-900 font-sans">
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

      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-5 lg:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
            <Crown className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-xl lg:text-2xl font-bold text-slate-900 tracking-tight">
              Painel Master Super ADM (SQL Local Server)
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Persistência direta no Banco SQL Local (`data/omnizeus_local_sql_database.json`) compatível com Supabase PostgreSQL
            </p>
          </div>
        </div>

        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200/60 uppercase tracking-wider">
          Super ADM Master
        </span>
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Margem Líquida Média</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 tracking-tight">85.9% – 98.6%</div>
          <div className="flex items-center gap-2 mt-2 text-xs">
            <span className="font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded text-[11px]">
              Altíssima
            </span>
            <span className="text-slate-400">Cobrança R$ 890 vs Custo ~US$ 2.16</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Status da API OpenRouter</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#1E6FD9] flex items-center justify-center">
              <Cpu className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 tracking-tight">
            {openRouterMasterKey ? 'Chave Gravada no SQL' : 'Pendente no SQL'}
          </div>
          <div className="flex items-center gap-2 mt-2 text-xs">
            <span className="text-slate-400">Banco de Dados Local Servidor Ativo</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Escritórios Cadastrados</span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 tracking-tight">{companies.length} Empresa</div>
          <div className="flex items-center gap-2 mt-2 text-xs">
            <span className="font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded text-[11px]">
              Zenitus Contábil (Master)
            </span>
          </div>
        </div>
      </div>

      {/* Independent Section 1: OpenRouter API Integration */}
      <div className="bg-white p-5 lg:p-6 rounded-xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Cpu className="w-4.5 h-4.5 text-purple-600" />
            <span>OpenRouter Master Enterprise API Key (Acesso Global a 15 LLMs)</span>
          </h3>
          <button
            onClick={handleSaveOpenRouter}
            className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white text-xs font-semibold rounded-lg flex items-center gap-2 transition-all shadow-xs"
          >
            <Save className="w-4 h-4" />
            <span>Salvar no Banco SQL Local</span>
          </button>
        </div>

        {openRouterSuccess && (
          <div className="p-3 bg-emerald-50 border border-emerald-200/60 text-emerald-800 text-xs font-semibold rounded-lg flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Chave da OpenRouter salva diretamente no Banco SQL Local do Servidor com sucesso!</span>
          </div>
        )}

        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
            Insira sua chave de API OpenRouter (`sk-or-v1-...`):
          </label>
          <input
            type="password"
            placeholder="sk-or-v1-********************************"
            value={openRouterMasterKey}
            onChange={(e) => setOpenRouterMasterKey(e.target.value)}
            className="w-full h-9 px-4 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-mono focus:outline-none focus:border-purple-500 transition-all"
          />
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          <button
            onClick={handleTestOpenRouterConnection}
            disabled={isTestingOpenRouter}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-lg flex items-center gap-2 transition-all shrink-0"
          >
            {isTestingOpenRouter ? <RefreshCw className="w-4 h-4 animate-spin text-purple-600" /> : <Sparkles className="w-4 h-4 text-purple-600" />}
            <span>{isTestingOpenRouter ? "Testando Conexão..." : "Testar Conexão OpenRouter API"}</span>
          </button>

          {openRouterTestResult && (
            <div className={`p-2.5 rounded-lg text-xs font-semibold flex items-center gap-2 border flex-1 ${
              openRouterTestResult.success ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'
            }`}>
              {openRouterTestResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />}
              <span>{openRouterTestResult.message}</span>
            </div>
          )}
        </div>
      </div>

      {/* Independent Section: Custom AI Endpoint */}
      <div className="bg-white p-5 lg:p-6 rounded-xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Cpu className="w-4.5 h-4.5 text-indigo-600" />
            <h3 className="text-base font-bold text-slate-900">Integração de Endpoint Customizado IA (Local/Proxy)</h3>
          </div>
          <button
            onClick={handleSaveCustomAi}
            className="px-4 py-2 bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-semibold rounded-lg flex items-center gap-2 transition-all shadow-xs"
          >
            <Save className="w-4 h-4" />
            <span>Salvar no Banco SQL</span>
          </button>
        </div>

        {customAiSuccess && (
          <div className="p-3 bg-emerald-50 border border-emerald-200/60 text-emerald-800 text-xs font-semibold rounded-lg flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Parâmetros do Endpoint Customizado salvos no Banco SQL Local!</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-2 sm:col-span-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Status da Integração Customizada:</label>
            <button
              onClick={() => setCustomAiEnabled(!customAiEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${customAiEnabled ? 'bg-indigo-600' : 'bg-slate-300'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${customAiEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
            <p className="text-xs text-slate-500">Se ativo, todas as requisições de IA (chat) serão roteadas para este endpoint em vez da OpenRouter.</p>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Endpoint da API (ex: http://localhost:20128/v1):</label>
            <input
              type="text"
              value={customAiUrl}
              onChange={(e) => setCustomAiUrl(e.target.value)}
              className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-mono focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Token de Acesso:</label>
            <input
              type="text"
              value={customAiKey}
              onChange={(e) => setCustomAiKey(e.target.value)}
              className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-mono focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Modelo / Combo (ex: kimicode, auto):</label>
            <input
              type="text"
              value={customAiModel}
              onChange={(e) => setCustomAiModel(e.target.value)}
              className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-mono focus:outline-none focus:border-indigo-500"
              placeholder="Digite o ID do modelo ou combo"
            />
          </div>
        </div>
      </div>

      {/* Independent Section 2: LobeHub Integration */}
      <div className="bg-white p-5 lg:p-6 rounded-xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Bot className="w-4.5 h-4.5 text-purple-600" />
            <h3 className="text-base font-bold text-slate-900">Integração LobeHub AI (Sondagem de Funcionalidades)</h3>
          </div>
          <button
            onClick={handleSaveLobeHub}
            className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white text-xs font-semibold rounded-lg flex items-center gap-2 transition-all shadow-xs"
          >
            <Save className="w-4 h-4" />
            <span>Salvar no Banco SQL</span>
          </button>
        </div>

        {lobeSuccess && (
          <div className="p-3 bg-emerald-50 border border-emerald-200/60 text-emerald-800 text-xs font-semibold rounded-lg flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Parâmetros do LobeHub salvos no Banco SQL Local!</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">URL do Servidor LobeHub:</label>
            <input
              type="text"
              value={lobeHubServerUrl}
              onChange={(e) => setLobeHubServerUrl(e.target.value)}
              className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-mono focus:outline-none focus:border-purple-500"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Chave de API LobeHub:</label>
            <input
              type="password"
              value={lobeHubApiKey}
              onChange={(e) => setLobeHubApiKey(e.target.value)}
              className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-mono focus:outline-none focus:border-purple-500"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Modelo Padrão Lobe AI:</label>
            <select
              value={lobeDefaultModel}
              onChange={(e) => setLobeDefaultModel(e.target.value)}
              className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-bold focus:outline-none focus:border-purple-500 cursor-pointer"
            >
              <option value="lobe-gpt-4o-mini">Lobe GPT-4o Mini Agent</option>
              <option value="lobe-claude-3.7-sonnet">Lobe Claude 3.7 Sonnet Agent</option>
              <option value="lobe-deepseek-v3">Lobe DeepSeek V3 Agent</option>
            </select>
          </div>
        </div>
      </div>

      {/* Independent Section 3: Evolution API WhatsApp */}
      <div className="bg-white p-5 lg:p-6 rounded-xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4.5 h-4.5 text-emerald-600" />
            <h3 className="text-base font-bold text-slate-900">Evolution API (WhatsApp Bot Multi-Tenant)</h3>
          </div>
          <button
            onClick={handleSaveEvolution}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg flex items-center gap-2 transition-all shadow-xs"
          >
            <Save className="w-4 h-4" />
            <span>Salvar no Banco SQL</span>
          </button>
        </div>

        {evolutionSuccess && (
          <div className="p-3 bg-emerald-50 border border-emerald-200/60 text-emerald-800 text-xs font-semibold rounded-lg flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Parâmetros da Evolution API salvos no Banco SQL Local!</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1.5">URL Base Evolution API:</label>
            <input
              type="text"
              value={evolutionUrl}
              onChange={(e) => setEvolutionUrl(e.target.value)}
              className="w-full h-9 px-4 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-mono focus:outline-none focus:border-emerald-600 transition-all"
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1.5">Chave Global Evolution API Key:</label>
            <input
              type="password"
              value={evolutionApiKey}
              onChange={(e) => setEvolutionApiKey(e.target.value)}
              className="w-full h-9 px-4 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-mono focus:outline-none focus:border-emerald-600 transition-all"
            />
          </div>
        </div>
      </div>

      {/* Independent Section 4: Stripe Checkout */}
      <div className="bg-white p-5 lg:p-6 rounded-xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <CreditCard className="w-4.5 h-4.5 text-blue-600" />
            <h3 className="text-base font-bold text-slate-900">Stripe (Checkout & Faturamento de OmniCoins)</h3>
          </div>
          <button
            onClick={handleSaveStripe}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg flex items-center gap-2 transition-all shadow-xs"
          >
            <Save className="w-4 h-4" />
            <span>Salvar no Banco SQL</span>
          </button>
        </div>

        {stripeSuccess && (
          <div className="p-3 bg-emerald-50 border border-emerald-200/60 text-emerald-800 text-xs font-semibold rounded-lg flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Chaves do Stripe salvas no Banco SQL Local!</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1.5">Publishable Key (Produção):</label>
            <input
              type="text"
              value={stripePublishableKey}
              onChange={(e) => setStripePublishableKey(e.target.value)}
              className="w-full h-9 px-4 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-mono focus:outline-none focus:border-blue-600 transition-all"
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1.5">Secret Key (Master):</label>
            <input
              type="password"
              value={stripeSecretKey}
              onChange={(e) => setStripeSecretKey(e.target.value)}
              className="w-full h-9 px-4 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-mono focus:outline-none focus:border-blue-600 transition-all"
            />
          </div>
        </div>
      </div>

      {/* Multi-Tenant Companies & Users Creation Forms */}
      <div className="bg-white p-5 lg:p-6 rounded-xl border border-slate-200/80 shadow-xs space-y-6">
        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
          <Building2 className="w-4.5 h-4.5 text-purple-600" />
          <span>Cadastrar Empresa Contratante & Criar Acessos (Gestor / Funcionário)</span>
        </h3>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Form: Create Company */}
          <div className="lg:col-span-6 bg-slate-50/70 p-5 rounded-xl border border-slate-200/80 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-purple-700 flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              1. Cadastrar Nova Empresa Contratante
            </h4>

            {companySuccess && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200/60 text-emerald-800 text-xs font-semibold rounded-lg flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Empresa cadastrada no Banco SQL com sucesso!</span>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Razão Social:</label>
                <input
                  type="text"
                  placeholder="Ex: Alfa Contabilidade & BPO Eireli"
                  value={newCorpName}
                  onChange={(e) => setNewCorpName(e.target.value)}
                  className="w-full h-9 px-3 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 font-medium focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">CNPJ:</label>
                  <input
                    type="text"
                    placeholder="00.000.000/0001-00"
                    value={newCnpj}
                    onChange={(e) => setNewCnpj(e.target.value)}
                    className="w-full h-9 px-3 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 font-medium focus:outline-none focus:border-purple-500"
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
                    className="w-full h-9 px-3 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 font-bold focus:outline-none focus:border-purple-500 cursor-pointer"
                  >
                    <option value="Profissional">Profissional (R$ 490 / 5k Coins)</option>
                    <option value="Premium">Premium (R$ 890 / 15k Coins)</option>
                    <option value="Business">Business (R$ 1.990 / 50k Coins)</option>
                  </select>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCreateCompany}
              className="w-full py-2.5 bg-purple-700 hover:bg-purple-800 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-all shadow-xs"
            >
              <Building2 className="w-4 h-4" />
              <span>Cadastrar Empresa no Banco SQL</span>
            </button>
          </div>

          {/* Right Form: Create User for Company */}
          <div className="lg:col-span-6 bg-slate-50/70 p-5 rounded-xl border border-slate-200/80 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-purple-700 flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              2. Criar Usuário (Gestor ou Funcionário) para Empresa
            </h4>

            {userSuccess && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200/60 text-emerald-800 text-xs font-semibold rounded-lg flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Usuário vinculado no Banco SQL com sucesso!</span>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Empresa Destino:</label>
                <select
                  value={targetCompanyId}
                  onChange={(e) => setTargetCompanyId(e.target.value)}
                  className="w-full h-9 px-3 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 font-bold focus:outline-none focus:border-purple-500 cursor-pointer"
                >
                  {companies.map(c => (
                    <option key={c.id} value={c.id}>{c.corporateName} ({c.cnpj})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Nome do Usuário:</label>
                  <input
                    type="text"
                    placeholder="Ex: Carlos Mendes"
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    className="w-full h-9 px-3 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 font-medium focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">E-mail Corporativo:</label>
                  <input
                    type="email"
                    placeholder="carlos@empresa.com.br"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    className="w-full h-9 px-3 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 font-medium focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Perfil de Acesso:</label>
                  <select
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value as any)}
                    className="w-full h-9 px-3 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 font-bold focus:outline-none focus:border-purple-500 cursor-pointer"
                  >
                    <option value="gestor">Gestor do Escritório</option>
                    <option value="funcionario">Funcionário Operacional</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Departamento:</label>
                  <input
                    type="text"
                    value={newUserDept}
                    onChange={(e) => setNewUserDept(e.target.value)}
                    className="w-full h-9 px-3 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 font-medium focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleCreateUserForCompany}
                className="w-full py-2.5 bg-purple-700 hover:bg-purple-800 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-all shadow-xs"
              >
                <Users className="w-4 h-4" />
                <span>Vincular Usuário no Banco SQL</span>
              </button>
            </div>
          </div>
        </div>

        {/* Registered Companies Table */}
        <div className="border-t border-slate-100 pt-5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
            Empresas Contratantes Cadastradas no Banco SQL ({companies.length})
          </h4>

          <div className="overflow-x-auto">
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
                    <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900">{c.corporateName}</td>
                      <td className="py-3.5 px-4 font-medium">{c.cnpj} • {c.city}/{c.state}</td>
                      <td className="py-3.5 px-4">
                        <span className="font-extrabold text-purple-700">{c.plan}</span>
                        <span className="text-[10px] text-slate-500 block">{(c.coinsFranchise).toLocaleString('pt-BR')} Coins/mês</span>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-800">
                        {empCount} Usuário
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
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
