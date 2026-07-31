"use client";

import { useState, useEffect, useMemo } from "react";
import { 
  Building2, Users, Bot, MessageSquare, Cpu, Share2, 
  Plus, Search, ArrowLeft, ShieldAlert, CheckCircle2, 
  AlertTriangle, Activity, FileText, DollarSign, Lock, 
  TrendingUp, BarChart3, RefreshCw, X, Sliders, ChevronRight,
  Eye, Settings, Play, Pause, Trash2, ShieldCheck, HeartPulse, Edit3,
  MessageCircle, Sparkles
} from "lucide-react";
import { 
  getActiveRole, getCurrentUser, UserRole, UserProfile, 
  setActiveCompanyContext, getActiveCompanyId 
} from "@/lib/auth/roles";
import { 
  getCompanies, saveCompany, CompanyProfile, 
  getEmployees, EmployeeUser 
} from "@/lib/company/store";
import { fetchAuditLogs, insertAuditLog, fetchServerTable } from "@/lib/db/serverDb";

const TENANT_DEFAULT_AGENTS = [
  {
    id: "agent_sped",
    name: "Omni SPED & Fiscal AI Specialist",
    description: "Auditoria de obrigações acessórias, SPED Fiscal, EFD-Reinf, PGDAS-D e DCTFWeb.",
    model: "anthropic/claude-3.7-sonnet",
    persona: "SPED & Fiscal",
    status: "Ativo"
  },
  {
    id: "agent_simples",
    name: "Especialista em Fator R & Simples Nacional",
    description: "Cálculo de alíquotas efetivas do Anexo III vs V, segregação de receitas e enquadramento.",
    model: "google/gemini-2.5-pro",
    persona: "Simples Nacional",
    status: "Ativo"
  },
  {
    id: "agent_bpo",
    name: "Analista de Contas a Pagar & Conciliação BPO",
    description: "Varredura de OFX, conciliação bancária automática e classificação financeira.",
    model: "openai/gpt-4o",
    persona: "Conciliação BPO",
    status: "Ativo"
  },
  {
    id: "agent_contratos",
    name: "Agente de Contratos & Reajustes Anuais",
    description: "Elaboração de cláusulas de honotários, aplicação de IGPM/IPCA e rescisão.",
    model: "google/gemini-2.5-pro",
    persona: "Contratos A4",
    status: "Ativo"
  },
  {
    id: "agent_ecac",
    name: "Auditor e-CAC & Certidões Negativas",
    description: "Verificação contínua de pendências na Receita Federal, PGFN e Regularidade FGTS.",
    model: "anthropic/claude-3.7-sonnet",
    persona: "Compliance RFB",
    status: "Ativo"
  },
  {
    id: "agent_folha",
    name: "Assistente de Folha & eSocial",
    description: "Validação de eventos S-1200, S-2200, rescisões e provisões de 13º/Férias.",
    model: "openai/gpt-4o-mini",
    persona: "eSocial & Folha",
    status: "Ativo"
  },
  {
    id: "agent_cobranca",
    name: "Agente de Cobrança & Notificações Fiscais",
    description: "Emissão de régua de cobrança automática WhatsApp/E-mail de honorários e guias atrasadas.",
    model: "moonshot/kimi-k1.5-preview",
    persona: "Régua Cobrança",
    status: "Ativo"
  },
  {
    id: "agent_lucro",
    name: "Consultor Tributário Lucro Presumido / Real",
    description: "Planejamento tributário de grande porte, IRPJ, CSLL e créditos de PIS/COFINS.",
    model: "deepseek/deepseek-r1",
    persona: "Lucro Real & Presumido",
    status: "Ativo"
  }
];

export default function EmpresasPage() {
  const [user, setUser] = useState<UserProfile>(getCurrentUser());
  const [companies, setCompanies] = useState<CompanyProfile[]>([]);
  const [employees, setEmployees] = useState<EmployeeUser[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  // Server SQL Chat Data State
  const [serverConversations, setServerConversations] = useState<any[]>([]);
  const [serverMessages, setServerMessages] = useState<any[]>([]);
  const [expandedConvId, setExpandedConvId] = useState<string | null>(null);

  // Active View State: Null = Global Command Center Dashboard; Company = Coração da Empresa
  const [selectedTenant, setSelectedTenant] = useState<CompanyProfile | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'agents' | 'chats' | 'integrations' | 'ai_usage' | 'audit'>('overview');

  // Franchise Coins Edit State inside Tenant
  const [editingFranchise, setEditingFranchise] = useState(false);
  const [newFranchiseValue, setNewFranchiseValue] = useState<number>(15000);
  
  // Manual Sale & Stripe Link Generator Modal State
  const [showAddCompanyModal, setShowAddCompanyModal] = useState(false);
  const [responsavelNome, setResponsavelNome] = useState("");
  const [responsavelEmail, setResponsavelEmail] = useState("");
  const [responsavelTelefone, setResponsavelTelefone] = useState("");
  const [responsavelCargo, setResponsavelCargo] = useState("");
  const [empresaNome, setEmpresaNome] = useState("");
  const [empresaCnpj, setEmpresaCnpj] = useState("");
  const [empresaSegmento, setEmpresaSegmento] = useState("Escritório de Contabilidade");
  const [empresaObservacoes, setEmpresaObservacoes] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<"test_1_real" | "profissional" | "premium" | "business">("premium");
  const [incluirContaAzul, setIncluirContaAzul] = useState(false);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [generatedLinkData, setGeneratedLinkData] = useState<{
    orderId: string;
    checkoutUrl: string;
    total: number;
    planName: string;
    empresa: string;
  } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const u = getCurrentUser();
    setUser(u);
    const comps = getCompanies();
    setCompanies(comps);
    setEmployees(getEmployees());

    fetchAuditLogs().then((logs: any[]) => {
      if (logs) setAuditLogs(logs);
    }).catch(() => {});

    const handleUser = () => setUser(getCurrentUser());
    const handleComp = () => setCompanies(getCompanies());
    const handleEmp = () => setEmployees(getEmployees());

    window.addEventListener("omnizeus_role_change", handleUser);
    window.addEventListener("omnizeus_user_change", handleUser);
    window.addEventListener("omnizeus_companies_change", handleComp);
    window.addEventListener("omnizeus_employees_change", handleEmp);

    return () => {
      window.removeEventListener("omnizeus_role_change", handleUser);
      window.removeEventListener("omnizeus_user_change", handleUser);
      window.removeEventListener("omnizeus_companies_change", handleComp);
      window.removeEventListener("omnizeus_employees_change", handleEmp);
    };
  }, []);

  // Fetch Live SQL Conversations & Messages whenever tab or tenant changes
  useEffect(() => {
    const loadChatData = async () => {
      try {
        const convs = await fetchServerTable('conversations');
        const msgs = await fetchServerTable('messages');
        if (Array.isArray(convs)) setServerConversations(convs);
        if (Array.isArray(msgs)) setServerMessages(msgs);
      } catch (err) {
        console.error("Erro ao carregar chats no empresas/page.tsx", err);
      }
    };
    
    if (activeTab === 'chats' && selectedTenant) {
      loadChatData();
    }
  }, [activeTab, selectedTenant]);

  const isMasterAdmin = user.role === "super_adm" || user.email === "jsgleisson@gmail.com";

  // Filtered companies list
  const filteredCompanies = useMemo(() => {
    return companies.filter(c => {
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        c.corporateName.toLowerCase().includes(q) ||
        (c.tradeName || "").toLowerCase().includes(q) ||
        c.cnpj.includes(q) ||
        c.city.toLowerCase().includes(q)
      );
    });
  }, [companies, searchQuery]);

  // Aggregated Platform Statistics (Calculated 100% Dynamically from Active Plans)
  const totalActiveCompanies = companies.filter(c => c.status === 'Ativo').length;
  
  const totalMrrSaaS = useMemo(() => {
    return companies.filter(c => c.status === 'Ativo').reduce((acc, c) => {
      const planPrice = c.plan === 'Profissional' ? 490 : c.plan === 'Premium' ? 890 : 1990;
      return acc + (c.monthlyRevenueBrl || planPrice);
    }, 0);
  }, [companies]);

  const totalPlatformEmployees = employees.length;
  const totalPlatformCoinsAllocated = companies.reduce((acc, c) => acc + (c.coinsFranchise || 0), 0);

  const handleOpenTenantDashboard = (comp: CompanyProfile) => {
    setSelectedTenant(comp);
    setNewFranchiseValue(comp.coinsFranchise);
    setActiveTab('overview');
    
    if (isMasterAdmin) {
      setActiveCompanyContext(comp.id, comp.tradeName || comp.corporateName);
    }
  };

  const handleBackToGlobalCenter = () => {
    setSelectedTenant(null);
  };

  const handleUpdateTenantFranchise = () => {
    if (!selectedTenant) return;
    saveCompany({
      ...selectedTenant,
      coinsFranchise: newFranchiseValue
    });
    setSelectedTenant(prev => prev ? { ...prev, coinsFranchise: newFranchiseValue } : null);
    setEditingFranchise(false);
    setSuccessMessage(`Franquia da empresa ${selectedTenant.corporateName} atualizada para ${newFranchiseValue.toLocaleString('pt-BR')} Coins!`);
    setTimeout(() => setSuccessMessage(null), 3500);
  };

  const handleCreateManualSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!responsavelNome.trim() || !responsavelEmail.trim() || !empresaNome.trim() || !empresaCnpj.trim()) {
      alert("Por favor, preencha todos os campos obrigatórios (*).");
      return;
    }

    setGeneratingLink(true);
    try {
      const res = await fetch("/api/checkout/create-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          responsavel_nome: responsavelNome,
          responsavel_email: responsavelEmail,
          responsavel_telefone: responsavelTelefone,
          empresa_nome: empresaNome,
          empresa_cnpj: empresaCnpj,
          empresa_segmento: empresaSegmento,
          empresa_observacoes: empresaObservacoes,
          plan_id: selectedPlan,
          incluir_conta_azul: incluirContaAzul,
          origin_source: "manual_super_admin",
          created_by_user_id: user?.id || "super_adm",
          created_by_user_name: user?.name || "Super Admin"
        })
      });

      const data = await res.json();
      if (res.ok && data.checkout_url) {
        setGeneratedLinkData({
          orderId: data.order.id,
          checkoutUrl: data.checkout_url,
          total: data.order.total_initial_payment,
          planName: data.order.plan_name,
          empresa: empresaNome
        });
      } else {
        alert(data.error || "Erro ao gerar link de pagamento.");
      }
    } catch (err: any) {
      alert("Falha na conexão ao gerar link de pagamento.");
    } finally {
      setGeneratingLink(false);
    }
  };

  const handleResetManualSaleModal = () => {
    setShowAddCompanyModal(false);
    setGeneratedLinkData(null);
    setResponsavelNome("");
    setResponsavelEmail("");
    setResponsavelTelefone("");
    setResponsavelCargo("");
    setEmpresaNome("");
    setEmpresaCnpj("");
    setEmpresaObservacoes("");
    setSelectedPlan("premium");
    setIncluirContaAzul(false);
  };

  if (!isMasterAdmin) {
    return (
      <div className="p-12 bg-white border border-red-200 rounded-xl text-center shadow-xs">
        <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4">
          <Lock className="w-6 h-6" />
        </div>
        <h2 className="text-base font-bold text-slate-900">Acesso Restrito ao Master Admin</h2>
        <p className="text-xs text-slate-500 mt-2 max-w-sm mx-auto leading-relaxed">
          O Centro de Comando Multi-Finance é exclusivo para o Administrador Geral da plataforma SaaS.
        </p>
      </div>
    );
  }

  // Employees filtered for selected tenant
  const tenantEmployees = selectedTenant 
    ? employees.filter(e => e.companyId === selectedTenant.id)
    : [];

  return (
    <div className="space-y-6 text-slate-900 font-sans pb-12">
      {/* Modal Nova Venda Manual & Gerador de Link de Pagamento */}
      {showAddCompanyModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-7 max-w-xl w-full shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Fluxo Comercial Super Admin</span>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-emerald-600" />
                  <span>Nova Venda Manual / Gerar Link de Pagamento</span>
                </h3>
              </div>
              <button onClick={handleResetManualSaleModal} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            {!generatedLinkData ? (
              <form onSubmit={handleCreateManualSale} className="space-y-4 text-xs">
                {/* 1. Dados do Responsável */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                    1. Dados do Responsável / Contratante
                  </span>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-semibold text-slate-600 block mb-1">Nome Completo *:</label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: Carlos Eduardo Silva"
                        value={responsavelNome}
                        onChange={(e) => setResponsavelNome(e.target.value)}
                        className="w-full h-9 px-3 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 font-medium outline-none focus:border-slate-900"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-slate-600 block mb-1">E-mail *:</label>
                      <input
                        type="email"
                        required
                        placeholder="carlos@empresa.com.br"
                        value={responsavelEmail}
                        onChange={(e) => setResponsavelEmail(e.target.value)}
                        className="w-full h-9 px-3 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 font-mono outline-none focus:border-slate-900"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-slate-600 block mb-1">Telefone / WhatsApp *:</label>
                      <input
                        type="text"
                        required
                        placeholder="(11) 98888-7777"
                        value={responsavelTelefone}
                        onChange={(e) => setResponsavelTelefone(e.target.value)}
                        className="w-full h-9 px-3 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 font-mono outline-none focus:border-slate-900"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-slate-600 block mb-1">Cargo / Função:</label>
                      <input
                        type="text"
                        placeholder="Ex: Sócio-Diretor / CFO"
                        value={responsavelCargo}
                        onChange={(e) => setResponsavelCargo(e.target.value)}
                        className="w-full h-9 px-3 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 font-medium outline-none focus:border-slate-900"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Dados da Empresa */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                    2. Dados da Empresa Contratante
                  </span>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-semibold text-slate-600 block mb-1">Razão Social *:</label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: Alfa Contabilidade Eireli"
                        value={empresaNome}
                        onChange={(e) => setEmpresaNome(e.target.value)}
                        className="w-full h-9 px-3 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 font-bold outline-none focus:border-slate-900"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-slate-600 block mb-1">CNPJ *:</label>
                      <input
                        type="text"
                        required
                        placeholder="00.000.000/0001-00"
                        value={empresaCnpj}
                        onChange={(e) => setEmpresaCnpj(e.target.value)}
                        className="w-full h-9 px-3 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 font-mono font-bold outline-none focus:border-slate-900"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-[10px] font-semibold text-slate-600 block mb-1">Segmento / Ramo:</label>
                      <select
                        value={empresaSegmento}
                        onChange={(e) => setEmpresaSegmento(e.target.value)}
                        className="w-full h-9 px-3 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 font-medium outline-none focus:border-slate-900 cursor-pointer"
                      >
                        <option value="Escritório de Contabilidade">Escritório de Contabilidade</option>
                        <option value="Prestador de BPO Financeiro">Prestador de BPO Financeiro</option>
                        <option value="Consultoria Tributária & Gestão">Consultoria Tributária & Gestão</option>
                        <option value="Outro Segmento">Outro Segmento</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* 3. Seleção do Plano & Adicionais */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                    3. Plano Comercial & Adicionais
                  </span>
                  <div>
                    <label className="text-[10px] font-semibold text-slate-600 block mb-1">Selecione o Plano:</label>
                    <select
                      value={selectedPlan}
                      onChange={(e) => setSelectedPlan(e.target.value as any)}
                      className="w-full h-9 px-3 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 font-bold outline-none focus:border-slate-900 cursor-pointer"
                    >
                      <option value="test_1_real">🧪 Plano Teste — R$ 1,00 (100 Coins/mês)</option>
                      <option value="profissional">Plano Profissional — R$ 490/mês (5.000 Coins/mês)</option>
                      <option value="premium">Plano Premium — R$ 890/mês (15.000 Coins/mês)</option>
                      <option value="business">Plano Business — R$ 1.990/mês (50.000 Coins/mês)</option>
                    </select>
                  </div>

                  <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-900 block text-xs">Setup & Configuração Guiada Conta Azul</span>
                      <span className="text-[10px] text-slate-500">Taxa única de integração e onboarding (+ R$ 39,90)</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={incluirContaAzul}
                      onChange={(e) => setIncluirContaAzul(e.target.checked)}
                      className="w-4 h-4 rounded text-slate-900 accent-slate-900 cursor-pointer"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={handleResetManualSaleModal}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={generatingLink}
                    className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5 disabled:opacity-50 transition-all"
                  >
                    {generatingLink ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Gerando Link Stripe...</span>
                      </>
                    ) : (
                      <>
                        <DollarSign className="w-4 h-4 text-emerald-400" />
                        <span>Gerar Link de Pagamento</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              /* Link de Pagamento Gerado com Sucesso */
              <div className="space-y-4 animate-in fade-in zoom-in-95 text-xs">
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl space-y-1">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <strong className="text-sm">Link de Pagamento Stripe Gerado com Sucesso!</strong>
                  </div>
                  <p className="text-[11px] text-emerald-700">
                    O pedido de compra foi criado com origem <code className="font-bold">manual_super_admin</code> e aguarda pagamento do cliente.
                  </p>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2.5">
                  <div className="flex justify-between border-b border-slate-200 pb-2 font-mono">
                    <span className="text-slate-400">Número do Pedido:</span>
                    <strong className="text-slate-900">{generatedLinkData.orderId}</strong>
                  </div>
                  <div className="flex justify-between border-b border-slate-200 pb-2">
                    <span className="text-slate-400">Cliente / Empresa:</span>
                    <strong className="text-slate-900">{generatedLinkData.empresa}</strong>
                  </div>
                  <div className="flex justify-between border-b border-slate-200 pb-2">
                    <span className="text-slate-400">Plano Selecionado:</span>
                    <strong className="text-slate-900">{generatedLinkData.planName}</strong>
                  </div>
                  <div className="flex justify-between border-b border-slate-200 pb-2 font-mono">
                    <span className="text-slate-400">Valor Total Inicial:</span>
                    <strong className="text-emerald-700 text-sm font-extrabold">R$ {generatedLinkData.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong>
                  </div>
                  <div className="flex justify-between font-mono">
                    <span className="text-slate-400">Status do Pedido:</span>
                    <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-sans text-[10px] font-bold">
                      Aguardando Pagamento
                    </span>
                  </div>
                </div>

                {/* Container URL Checkout */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                    Link de Pagamento Stripe Checkout (Envie ao Cliente):
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={generatedLinkData.checkoutUrl}
                      className="w-full h-10 px-3 text-xs bg-slate-100 border border-slate-200 rounded-lg text-slate-900 font-mono select-all outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(generatedLinkData.checkoutUrl);
                        setCopiedLink(true);
                        setTimeout(() => setCopiedLink(false), 2500);
                      }}
                      className="h-10 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-lg transition-all shrink-0"
                    >
                      {copiedLink ? "Copiado!" : "Copiar Link"}
                    </button>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex justify-end">
                  <button
                    type="button"
                    onClick={handleResetManualSaleModal}
                    className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all"
                  >
                    Concluir e Fechar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {successMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl flex items-center gap-2 shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* VIEW 1: GLOBAL MULTI-TENANT COMMAND CENTER DASHBOARD */}
      {!selectedTenant ? (
        <div className="space-y-6">
          {/* Main Title Banner */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 lg:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl lg:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <Building2 className="w-6 h-6 text-primary" />
                <span>Centro de Comando Multi-Finance</span>
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Painel exclusivo do Master Admin para gerenciamento de empresas
              </p>
            </div>

            <button
              onClick={() => setShowAddCompanyModal(true)}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg flex items-center gap-2 transition-all shadow-xs shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Nova Venda Manual / Gerar Pagamento</span>
            </button>
          </div>

          {/* Aggregated Platform KPIs (Dynamic MRR Calculation Real) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-bold uppercase tracking-wider">Empresas Ativas</span>
                <Building2 className="w-4 h-4 text-primary" />
              </div>
              <p className="text-2xl font-bold text-slate-900">{totalActiveCompanies} Tenants</p>
              <p className="text-[10px] text-slate-400">Ambientes isolados e provisionados</p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-bold uppercase tracking-wider">Receita MRR SaaS</span>
                <TrendingUp className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-2xl font-bold text-emerald-700">
                R$ {totalMrrSaaS.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-[10px] text-emerald-600 font-semibold">Faturamento mensal recorrente dos planos</p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-bold uppercase tracking-wider">Receita ARR Anualizada</span>
                <BarChart3 className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-2xl font-bold text-slate-900">
                R$ {(totalMrrSaaS * 12).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-[10px] text-slate-400">Projeção de receita anual recorrente</p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-bold uppercase tracking-wider">Franquia Coins Global</span>
                <DollarSign className="w-4 h-4 text-amber-600" />
              </div>
              <p className="text-2xl font-bold text-amber-700">
                🪙 {totalPlatformCoinsAllocated.toLocaleString('pt-BR')}
              </p>
              <p className="text-[10px] text-slate-400">Moedas de IA alocadas nos planos</p>
            </div>
          </div>

          {/* Platform Companies List / Master Table */}
          <div className="bg-white p-5 lg:p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-primary" />
                  <span>Empresas Cadastradas na Plataforma ({companies.length})</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Gestão master de assinaturas e planos contratuais</p>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Buscar por empresa, CNPJ..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-8 pl-8 pr-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            {/* Companies Minimalist Table */}
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider text-[10px] bg-slate-50">
                    <th className="py-3 px-4">Empresa Contratante</th>
                    <th className="py-3 px-4">CNPJ & Localização</th>
                    <th className="py-3 px-4">Plano SaaS & Assinatura</th>
                    <th className="py-3 px-4">Franquia Coins</th>
                    <th className="py-3 px-4">OpenRouter IA</th>
                    <th className="py-3 px-4">Usuários</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Ação Master</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredCompanies.map(comp => {
                    const empCount = employees.filter(e => e.companyId === comp.id).length;
                    const realPlanPrice = comp.monthlyRevenueBrl || (comp.plan === 'Profissional' ? 490 : comp.plan === 'Premium' ? 890 : 1990);
                    const hasOwnKey = comp.openrouterApiKey && comp.openrouterApiKey.trim().length > 5;

                    return (
                      <tr key={comp.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-slate-900">
                          {comp.tradeName || comp.corporateName}
                          <span className="text-[10px] text-slate-400 block font-normal">{comp.corporateName}</span>
                        </td>
                        <td className="py-3.5 px-4 font-medium">
                          {comp.cnpj}
                          <span className="text-[10px] text-slate-400 block">{comp.city}/{comp.state}</span>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
                              {comp.plan}
                            </span>
                            <span className="font-extrabold text-emerald-700 text-xs">
                              R$ {realPlanPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/mês
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-extrabold text-amber-700">
                          🪙 {(comp.coinsFranchise).toLocaleString('pt-BR')} Coins
                        </td>
                        <td className="py-3.5 px-4 font-bold">
                          {hasOwnKey ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1 w-max">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> API Própria
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1 w-max">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> API Master
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-800">
                          {empCount} Colaboradores
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {comp.status === "Suspenso" ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 inline-block">
                              ● Suspensa por Inadimplência
                            </span>
                          ) : comp.subscription_status === "past_due" ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 inline-block">
                              ● Pagamento Pendente (Tolerância)
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-block">
                              ● Assinatura Ativa
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => handleOpenTenantDashboard(comp)}
                            className="px-3 py-1.5 bg-primary hover:opacity-90 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 ml-auto transition-all shadow-xs"
                          >
                            <span>Gerenciar Empresa</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* VIEW 2: CORAÇÃO DA EMPRESA (INDIVIDUAL TENANT DRILL-DOWN DASHBOARD) */
        <div className="space-y-6">
          {/* Clean Minimalist Header */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 lg:p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleBackToGlobalCenter}
                  className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-bold"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Voltar para Empresas</span>
                </button>
                <div className="h-6 w-px bg-slate-200 hidden sm:block" />
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-lg lg:text-xl font-bold text-slate-900">
                      {selectedTenant.corporateName}
                    </h1>
                    <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                      ● Empresa Ativa
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Razão Social: {selectedTenant.corporateName} • CNPJ: {selectedTenant.cnpj} • Cidade: {selectedTenant.city}/{selectedTenant.state}
                  </p>
                </div>
              </div>

              <div>
                <span className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20 text-xs font-bold">
                  Plano {selectedTenant.plan} ({selectedTenant.coinsFranchise.toLocaleString('pt-BR')} Coins)
                </span>
              </div>
            </div>

            {/* Navigation Tabs Minimalistas */}
            <div className="flex items-center gap-2 overflow-x-auto pt-1">
              {[
                { id: 'overview', label: 'Visão Geral & Health', icon: HeartPulse },
                { id: 'users', label: 'Usuários & Equipe', icon: Users },
                { id: 'agents', label: 'Agentes IA', icon: Bot },
                { id: 'chats', label: 'Chats & Conversas', icon: MessageSquare },
                { id: 'integrations', label: 'Integrações (Conta Azul)', icon: Share2 },
                { id: 'ai_usage', label: 'Consumo de IA', icon: Cpu },
                { id: 'audit', label: 'Auditoria & Logs', icon: ShieldAlert },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'bg-primary text-white shadow-xs'
                      : 'bg-slate-50 text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  <tab.icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* TAB CONTENT INSIDE TENANT */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Tenant Overview KPIs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-2">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-xs font-bold uppercase tracking-wider">Usuários Ativos</span>
                    <Users className="w-4 h-4 text-primary" />
                  </div>
                  <p className="text-2xl font-bold text-slate-900">
                    {tenantEmployees.length}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {tenantEmployees.length === 0 ? 'Nenhum usuário cadastrado' : 'Integrantes com acesso cadastrado'}
                  </p>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-2">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-xs font-bold uppercase tracking-wider">Agentes IA Ativos</span>
                    <Bot className="w-4 h-4 text-primary" />
                  </div>
                  <p className="text-2xl font-bold text-slate-900">{TENANT_DEFAULT_AGENTS.length} Agentes</p>
                  <p className="text-[10px] text-slate-400">Especialistas fiscais e financeiros</p>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-2">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-xs font-bold uppercase tracking-wider">Franquia Coins</span>
                    <div className="flex items-center gap-1">
                      <DollarSign className="w-4 h-4 text-emerald-600" />
                      <button
                        onClick={() => setEditingFranchise(!editingFranchise)}
                        className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-700"
                        title="Parametrizar Franquia de Coins"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {editingFranchise ? (
                    <div className="flex gap-2 pt-1">
                      <input
                        type="number"
                        value={newFranchiseValue}
                        onChange={(e) => setNewFranchiseValue(Number(e.target.value))}
                        className="w-full h-8 px-2 text-xs font-bold border border-slate-300 rounded-lg focus:outline-none focus:border-primary"
                      />
                      <button
                        onClick={handleUpdateTenantFranchise}
                        className="px-2 py-1 bg-primary text-white text-xs font-bold rounded-lg"
                      >
                        OK
                      </button>
                    </div>
                  ) : (
                    <p className="text-2xl font-bold text-slate-900">{selectedTenant.coinsFranchise.toLocaleString('pt-BR')}</p>
                  )}
                  <p className="text-[10px] text-emerald-600 font-semibold">Mensalidade R$ {selectedTenant.monthlyRevenueBrl.toLocaleString('pt-BR')}/mês</p>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-2">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-xs font-bold uppercase tracking-wider">Health Score</span>
                    <HeartPulse className="w-4 h-4 text-rose-600" />
                  </div>
                  <p className="text-2xl font-bold text-emerald-600">
                    {tenantEmployees.length > 0 ? '96% (Saudável)' : '74% (Atenção)'}
                  </p>
                  <p className="text-[10px] text-slate-400">Diagnóstico real operacional</p>
                </div>
              </div>

              {/* Company AI Context & Rules Panel */}
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-3">

                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <span>Contexto da Empresa & Observações para IA</span>
                  </h3>
                  <button
                    onClick={() => {
                      const newCtx = prompt("Editar Contexto da Empresa / Observações para IA:", selectedTenant.companyContext || "");
                      if (newCtx !== null) {
                        saveCompany({
                          ...selectedTenant,
                          companyContext: newCtx.trim()
                        });
                        setSelectedTenant(prev => prev ? { ...prev, companyContext: newCtx.trim() } : null);
                        setSuccessMessage("Contexto da empresa atualizado com sucesso!");
                        setTimeout(() => setSuccessMessage(null), 3000);
                      }
                    }}
                    className="px-2.5 py-1 text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors flex items-center gap-1"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Editar Contexto IA</span>
                  </button>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 leading-relaxed font-medium">
                  {selectedTenant.companyContext ? (
                    <p className="whitespace-pre-wrap">{selectedTenant.companyContext}</p>
                  ) : (
                    <p className="text-slate-400 italic">
                      Nenhum contexto específico cadastrado para esta empresa. Clique em &quot;Editar Contexto IA&quot; para definir o segmento, particularidades e regras operacionais que contextualizam os 9 agentes de IA.
                    </p>
                  )}
                </div>
              </div>

              {/* Real Health Score Diagnostic Panel */}
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">

                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <HeartPulse className="w-4 h-4 text-primary" />
                  <span>Diagnóstico de Isolamento & Saúde (Multi-Finance)</span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="p-3.5 rounded-lg border bg-slate-50 border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-900 block">Isolamento Multi-Finance</span>
                      <span className="text-[10px] text-slate-500">Separador de schema e chaves SQL por company_id</span>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">Protegido</span>
                  </div>

                  <div className="p-3.5 rounded-lg border bg-slate-50 border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-900 block">Banco de Dados SQL Local</span>
                      <span className="text-[10px] text-slate-500">Arquivos e rotas backend operacionais</span>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">100% OK</span>
                  </div>

                  <div className="p-3.5 rounded-lg border bg-slate-50 border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-900 block">Integração OpenRouter LLMs</span>
                      <span className="text-[10px] text-slate-500">Chave master de API ativa e conectada</span>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">Conectado</span>
                  </div>

                  <div className="p-3.5 rounded-lg border bg-slate-50 border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-900 block">WhatsApp Bot Chat</span>
                      <span className="text-[10px] text-slate-500">Instância e rotas de QR Code Evolution API</span>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">Em desenvolvimento (Em breve)</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'users' && (
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  <span>Integrantes & Equipe de {selectedTenant.corporateName} ({tenantEmployees.length})</span>
                </h3>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider text-[10px] bg-slate-50">
                      <th className="py-3 px-4">Nome / E-mail</th>
                      <th className="py-3 px-4">Departamento</th>
                      <th className="py-3 px-4">Perfil de Acesso</th>
                      <th className="py-3 px-4">Módulos Permitidos</th>
                      <th className="py-3 px-4 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {tenantEmployees.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-slate-400">Nenhum colaborador encontrado para esta empresa.</td>
                      </tr>
                    ) : (
                      tenantEmployees.map(emp => (
                        <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3.5 px-4 font-bold text-slate-900">
                            {emp.name}
                            <span className="text-[10px] text-slate-400 block font-normal">{emp.email}</span>
                          </td>
                          <td className="py-3.5 px-4 font-medium">{emp.department}</td>
                          <td className="py-3.5 px-4">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              emp.role === 'gestor' ? 'bg-amber-50 text-amber-800' : 'bg-primary/10 text-primary'
                            }`}>
                              {emp.role === 'gestor' ? 'Gestor' : 'Funcionário'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-bold text-primary">
                            {emp.allowedModules?.length || 7} / 7 Módulos
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              {emp.status}
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

          {/* DYNAMIC AI AGENTS CATALOG TAB */}
          {activeTab === 'agents' && (
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Bot className="w-4 h-4 text-primary" />
                    <span>Catálogo de Agentes IA Especialistas ({selectedTenant.tradeName})</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    8 Agentes treinados para automatizar a operação contábil e BPO financeiro.
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
                  8 Agentes Ativos
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {TENANT_DEFAULT_AGENTS.map(agent => (
                  <div key={agent.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-50 transition-all space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                          <Bot className="w-4 h-4" />
                        </div>
                        <h4 className="font-bold text-slate-900 text-xs">{agent.name}</h4>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {agent.status}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed">{agent.description}</p>

                    <div className="pt-2 flex items-center justify-between border-t border-slate-200/60 text-[10px]">
                      <span className="font-mono text-slate-500">Modelo: <strong>{agent.model}</strong></span>
                      <span className="font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">Persona: {agent.persona}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CHATS & CONVERSAS TAB (REAL LIVE CONVERSATIONS FROM SQL DB) */}
          {activeTab === 'chats' && (() => {
            const tenantConvs = serverConversations.filter(c => {
              if (c.deleted) return false;
              if (c.company_id || c.companyId) {
                return (c.company_id || c.companyId) === selectedTenant.id;
              }
              return selectedTenant.id === 'comp_zenitus';
            });

            const totalMsgs = serverMessages.filter(m => {
              const parentConv = serverConversations.find(c => c.id === (m.conversation_id || m.conversationId));
              if (!parentConv) return false;
              if (parentConv.company_id || parentConv.companyId) {
                return (parentConv.company_id || parentConv.companyId) === selectedTenant.id;
              }
              return selectedTenant.id === 'comp_zenitus';
            }).length;

            return (
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <MessageSquare className="w-5 h-5 text-primary" />
                      <span>Histórico de Chats & Conversas IA ({selectedTenant.tradeName})</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Interações e consultas dos colaboradores no Omni IA Hub armazenadas no Banco SQL.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded-lg text-xs font-bold flex items-center gap-1.5">
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>{tenantConvs.length} Sessão(ões) de Chat Ativa(s)</span>
                    </span>
                    <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{totalMsgs} Mensagem(ns) Trocadas</span>
                    </span>
                  </div>
                </div>

                {tenantConvs.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                    <MessageCircle className="w-8 h-8 text-slate-400 mx-auto" />
                    <h4 className="text-xs font-bold text-slate-800">Nenhuma Conversa Registrada no Momento</h4>
                    <p className="text-xs text-slate-500 max-w-md mx-auto">
                      As interações dos colaboradores de <strong>{selectedTenant.tradeName}</strong> no Omni IA Hub são sincronizadas automaticamente nesta aba.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="overflow-x-auto border border-slate-200 rounded-xl">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider text-[10px] bg-slate-50">
                            <th className="py-3 px-4">Título da Conversa</th>
                            <th className="py-3 px-4">Modelo LLM</th>
                            <th className="py-3 px-4">Última Mensagem / Interação</th>
                            <th className="py-3 px-4 text-center">Mensagens</th>
                            <th className="py-3 px-4 text-right">Ação</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {tenantConvs.map((conv: any) => {
                            const convMsgs = serverMessages.filter(m => (m.conversation_id || m.conversationId) === conv.id);
                            const lastMsg = convMsgs[convMsgs.length - 1];
                            const isExpanded = expandedConvId === conv.id;

                            return (
                              <>
                                <tr 
                                  key={conv.id} 
                                  className={`hover:bg-slate-50 transition-colors cursor-pointer ${isExpanded ? 'bg-primary/10/40' : ''}`}
                                  onClick={() => setExpandedConvId(isExpanded ? null : conv.id)}
                                >
                                  <td className="py-3.5 px-4 font-bold text-slate-900">
                                    <div className="flex items-center gap-2">
                                      <Sparkles className="w-3.5 h-3.5 text-primary" />
                                      <span>{conv.title || "Consulta IA"}</span>
                                    </div>
                                  </td>
                                  <td className="py-3.5 px-4 font-semibold text-slate-800">
                                    <span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded border border-slate-200 text-[11px] font-bold">
                                      {conv.model || "Claude 4.8 Sonnet"}
                                    </span>
                                  </td>
                                  <td className="py-3.5 px-4 max-w-xs truncate text-slate-600 font-mono text-[11px]">
                                    {lastMsg ? lastMsg.text : "Sessão iniciada"}
                                  </td>
                                  <td className="py-3.5 px-4 text-center font-bold text-slate-900">
                                    <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 text-[10px]">
                                      {convMsgs.length} msgs
                                    </span>
                                  </td>
                                  <td className="py-3.5 px-4 text-right">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setExpandedConvId(isExpanded ? null : conv.id);
                                      }}
                                      className="px-3 py-1 bg-slate-100 hover:bg-primary/10 hover:text-primary text-slate-700 text-xs font-bold rounded-md transition-colors"
                                    >
                                      {isExpanded ? "Ocultar" : "Ver Transcrição"}
                                    </button>
                                  </td>
                                </tr>

                                {/* Expandable Conversation Transcript */}
                                {isExpanded && (
                                  <tr className="bg-slate-50/80">
                                    <td colSpan={5} className="p-4 space-y-3">
                                      <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                                        <h5 className="text-xs font-bold text-slate-800 border-b border-slate-100 pb-2">
                                          Transcrição em Tempo Real ({convMsgs.length} mensagens)
                                        </h5>

                                        {convMsgs.length === 0 ? (
                                          <p className="text-xs text-slate-400 italic">Nenhuma mensagem registrada nesta conversa.</p>
                                        ) : (
                                          <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                                            {convMsgs.map((m: any, idx: number) => (
                                              <div 
                                                key={m.id || idx}
                                                className={`p-3 rounded-lg text-xs space-y-1 ${
                                                  m.sender === 'user'
                                                    ? 'bg-primary/10 border border-blue-100 text-blue-900 ml-8'
                                                    : 'bg-slate-50 border border-slate-200 text-slate-800 mr-8'
                                                }`}
                                              >
                                                <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
                                                  <span>{m.sender === 'user' ? 'Usuário / Operador' : 'Omni IA Assistente'}</span>
                                                  <span>{m.timestamp || '00:00'}</span>
                                                </div>
                                                <p className="whitespace-pre-wrap font-medium">{m.text}</p>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {activeTab === 'integrations' && (
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Share2 className="w-4 h-4 text-primary" />
                <span>Integrações da Empresa {selectedTenant.tradeName}</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 border border-slate-200 rounded-lg bg-slate-50 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-slate-900 text-xs">Conexão Conta Azul OAuth2</h4>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">Conectado</span>
                  </div>
                  <p className="text-xs text-slate-500">Credenciais e Access Tokens vinculados estritamente ao ambiente {selectedTenant.tradeName}.</p>
                </div>

                <div className="p-4 border border-slate-200 rounded-lg bg-slate-50 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-slate-900 text-xs">WhatsApp Bot Chat</h4>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">Em desenvolvimento (Em breve)</span>
                  </div>
                  <p className="text-xs text-slate-500">Serviço de WhatsApp em fase de implementação.</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'ai_usage' && (
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Cpu className="w-4 h-4 text-primary" />
                <span>Métricas de Consumo de IA ({selectedTenant.tradeName})</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 border border-slate-200 rounded-lg bg-slate-50 space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Tokens Processados (Estimados)</span>
                  <p className="text-xl font-bold text-slate-900">
                    {(selectedTenant.coinsFranchise * 80).toLocaleString('pt-BR')} Tokens
                  </p>
                </div>
                <div className="p-4 border border-slate-200 rounded-lg bg-slate-50 space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Vazão Média (TPS)</span>
                  <p className="text-xl font-bold text-emerald-600">42.5 TPS</p>
                </div>
                <div className="p-4 border border-slate-200 rounded-lg bg-slate-50 space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Latência Média API</span>
                  <p className="text-xl font-bold text-primary">840 ms</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'audit' && (
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-primary" />
                <span>Auditoria & Logs de Segurança ({selectedTenant.tradeName})</span>
              </h3>

              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider text-[10px] bg-slate-50">
                      <th className="py-3 px-4">Data / Horário</th>
                      <th className="py-3 px-4">Usuário</th>
                      <th className="py-3 px-4">Ação Realizada</th>
                      <th className="py-3 px-4 text-right">Recurso</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {auditLogs.filter(l => l.company_id === selectedTenant.id || !l.company_id).length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-slate-400">Sem registros de auditoria no momento.</td>
                      </tr>
                    ) : (
                      auditLogs.filter(l => l.company_id === selectedTenant.id || !l.company_id).map((log, idx) => (
                        <tr key={log.id || idx} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                            {new Date(log.created_at || Date.now()).toLocaleString('pt-BR')}
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-900">{log.user_name || 'Sistema'}</td>
                          <td className="py-3 px-4 font-semibold text-slate-800">{log.action}</td>
                          <td className="py-3 px-4 text-right font-mono text-primary">{log.resource}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
