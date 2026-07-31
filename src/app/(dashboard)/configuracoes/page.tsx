"use client";

import { useState, useEffect } from "react";
import { 
  Settings, User, Save, CheckCircle2, Building2, Lock, ShieldAlert, 
  Send, MessageSquare, ShieldCheck, Mail, Phone, Calendar, Users, DollarSign, Cpu
} from "lucide-react";
import { getCurrentUser, UserProfile, getActiveCompanyId } from "@/lib/auth/roles";
import { getCompanies, saveCompany, CompanyProfile, getEmployees } from "@/lib/company/store";
import { insertAuditLog, insertServerTable } from "@/lib/db/serverDb";

export default function ConfiguracoesPage() {
  const [user, setUser] = useState<UserProfile>(getCurrentUser());
  const [activeComp, setActiveComp] = useState<CompanyProfile | null>(null);
  const [employeeCount, setEmployeeCount] = useState<number>(0);
  
  // Form State for Master Admin
  const [corpName, setCorpName] = useState("");
  const [tradeName, setTradeName] = useState("");
  const [cnpj, setCnpj] = useState("");
  
  // User Profile Form State
  const [userName, setUserName] = useState("");
  const [userPhone, setUserPhone] = useState("(71) 99882-1020");
  const [userJobTitle, setUserJobTitle] = useState("Gestor de Operações & BPO");

  // Change Request Modal State
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestDetails, setRequestDetails] = useState("");
  const [requestSuccess, setRequestSuccess] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    const u = getCurrentUser();
    setUser(u);
    setUserName(u.name);

    const activeId = getActiveCompanyId();
    const comps = getCompanies();
    const comp = comps.find(c => c.id === activeId) || comps[0];
    if (comp) {
      setActiveComp(comp);
      setCorpName(comp.corporateName);
      setTradeName(comp.tradeName || comp.corporateName);
      setCnpj(comp.cnpj);
      
      const emps = getEmployees(comp.id);
      setEmployeeCount(emps.length);
    }

    const handleUserChange = () => {
      const updatedUser = getCurrentUser();
      setUser(updatedUser);
      setUserName(updatedUser.name);

      const currentActiveId = getActiveCompanyId();
      const updatedComps = getCompanies();
      const updatedComp = updatedComps.find(c => c.id === currentActiveId) || updatedComps[0];
      if (updatedComp) {
        setActiveComp(updatedComp);
        setCorpName(updatedComp.corporateName);
        setTradeName(updatedComp.tradeName || updatedComp.corporateName);
        setCnpj(updatedComp.cnpj);

        const emps = getEmployees(updatedComp.id);
        setEmployeeCount(emps.length);
      }
    };

    window.addEventListener("omnizeus_role_change", handleUserChange);
    window.addEventListener("omnizeus_user_change", handleUserChange);
    window.addEventListener("omnizeus_company_context_change", handleUserChange);

    return () => {
      window.removeEventListener("omnizeus_role_change", handleUserChange);
      window.removeEventListener("omnizeus_user_change", handleUserChange);
      window.removeEventListener("omnizeus_company_context_change", handleUserChange);
    };
  }, []);

  const isMasterAdmin = user.role === "super_adm" || user.email === "jsgleisson@gmail.com";

  const handleSaveSettings = () => {
    if (isMasterAdmin && activeComp) {
      saveCompany({
        ...activeComp,
        corporateName: corpName.trim() || activeComp.corporateName,
        tradeName: tradeName.trim() || activeComp.tradeName,
        cnpj: cnpj.trim() || activeComp.cnpj
      });
    }

    insertAuditLog({
      company_id: activeComp?.id || "global",
      user_name: user.name,
      action: "Perfil de usuário atualizado nas Configurações",
      resource: "Administração"
    }).catch(() => {});

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleSendUpdateRequest = () => {
    if (!requestDetails.trim()) {
      alert("Por favor, descreva as alterações necessárias.");
      return;
    }

    insertServerTable("company_update_requests", {
      id: `req_${Date.now()}`,
      company_id: activeComp?.id || "global",
      company_name: activeComp?.tradeName || activeComp?.corporateName || "Empresa",
      requester_name: user.name,
      requester_email: user.email,
      details: requestDetails.trim(),
      status: "Pendente",
      created_at: new Date().toISOString()
    }).catch(() => {});

    insertAuditLog({
      company_id: activeComp?.id || "global",
      user_name: user.name,
      action: "Solicitação de alteração cadastral criada pelo Gestor",
      resource: "Administração"
    }).catch(() => {});

    setRequestSuccess(true);
    setTimeout(() => {
      setRequestSuccess(false);
      setShowRequestModal(false);
      setRequestDetails("");
    }, 2000);
  };

  return (
    <div className="space-y-6 text-slate-900 font-sans pb-12">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-5 lg:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-slate-900 tracking-tight">
            Administração & Configurações
          </h1>
          <p className="text-xs lg:text-sm text-slate-500 mt-1">
            Informações cadastrais da empresa e perfil do usuário logado.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleSaveSettings}
            className="px-5 py-2.5 bg-primary hover:opacity-90 text-white text-xs font-semibold rounded-lg flex items-center gap-2 transition-all shadow-xs"
          >
            <Save className="w-4 h-4" />
            <span>Salvar Alterações do Perfil</span>
          </button>
        </div>
      </div>

      {savedSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200/60 text-emerald-800 text-xs font-semibold rounded-xl flex items-center gap-2 shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>Configurações do perfil salvas com sucesso!</span>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Dados da Empresa (Read-Only for Gestor, Editable for Super Admin) */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200/80 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Building2 className="w-4.5 h-4.5 text-primary" />
              <h2 className="text-base font-bold text-slate-900">Dados da Empresa Contratante</h2>
            </div>

            {!isMasterAdmin ? (
              <span className="px-2.5 py-1 rounded-md bg-amber-50 text-amber-800 text-[11px] font-bold border border-amber-200/70 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-amber-600" />
                <span>Dados gerenciados pelo Super Administrador</span>
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-md bg-purple-50 text-purple-700 text-[11px] font-bold border border-purple-200 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                <span>Edição Habilitada (Master Admin)</span>
              </span>
            )}
          </div>

          {!isMasterAdmin && (
            <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl text-xs text-slate-600 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Para atualizar a Razão Social, CNPJ ou Plano da sua empresa, envie uma mensagem direta ao Master Admin.</span>
              </div>
              <button
                onClick={() => setShowRequestModal(true)}
                className="px-3 py-1.5 bg-primary text-white font-semibold text-xs rounded-lg hover:bg-primary/90 transition-colors shrink-0 shadow-xs flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Solicitar Alteração</span>
              </button>
            </div>
          )}

          {/* Read-Only Grid Display */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Razão Social:</label>
              {isMasterAdmin ? (
                <input
                  type="text"
                  value={corpName}
                  onChange={(e) => setCorpName(e.target.value)}
                  className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-bold focus:outline-none focus:border-primary"
                />
              ) : (
                <div className="h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-900 flex items-center">
                  {activeComp?.corporateName || "Não informado"}
                </div>
              )}
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Nome Fantasia:</label>
              {isMasterAdmin ? (
                <input
                  type="text"
                  value={tradeName}
                  onChange={(e) => setTradeName(e.target.value)}
                  className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-bold focus:outline-none focus:border-primary"
                />
              ) : (
                <div className="h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-900 flex items-center">
                  {activeComp?.tradeName || activeComp?.corporateName || "Não informado"}
                </div>
              )}
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">CNPJ:</label>
              {isMasterAdmin ? (
                <input
                  type="text"
                  value={cnpj}
                  onChange={(e) => setCnpj(e.target.value)}
                  className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-bold focus:outline-none focus:border-primary"
                />
              ) : (
                <div className="h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-900 flex items-center font-mono">
                  {activeComp?.cnpj || "00.000.000/0001-00"}
                </div>
              )}
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Cidade / UF:</label>
              <div className="h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg font-semibold text-slate-800 flex items-center">
                {activeComp?.city || "Salvador"} / {activeComp?.state || "BA"}
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Plano SaaS Contratado:</label>
              <div className="h-9 px-3 bg-primary/5 border border-primary/20 text-primary font-bold rounded-lg flex items-center justify-between">
                <span>{activeComp?.plan || "Premium"}</span>
                <span className="text-[10px] bg-primary text-white px-2 py-0.5 rounded font-semibold">Ativo</span>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Franquia de Coins Mensais:</label>
              <div className="h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-900 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                <span>{(activeComp?.coinsFranchise || 15000).toLocaleString("pt-BR")} Coins / mês</span>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Integrantes / Colaboradores:</label>
              <div className="h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-900 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-primary" />
                <span>{employeeCount} Colaboradores Cadastrados</span>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Data de Cadastro no SaaS:</label>
              <div className="h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-700 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>{new Date(activeComp?.createdAt || Date.now()).toLocaleDateString("pt-BR")}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Perfil do Usuário Logado (Editável pelo Usuário) */}
        <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <User className="w-4.5 h-4.5 text-primary" />
              <span>Perfil do Usuário Logado</span>
            </h2>
          </div>

          <div className="space-y-3.5 text-xs">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Nome Completo:</label>
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-bold focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Telefone / WhatsApp Comercial:</label>
              <input
                type="text"
                value={userPhone}
                onChange={(e) => setUserPhone(e.target.value)}
                className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-medium focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Cargo / Especialidade:</label>
              <input
                type="text"
                value={userJobTitle}
                onChange={(e) => setUserJobTitle(e.target.value)}
                className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-medium focus:outline-none focus:border-primary"
              />
            </div>

            <div className="pt-2 border-t border-slate-100 space-y-3">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">E-mail de Acesso (Corporativo):</label>
                <input
                  type="email"
                  value={user.email}
                  disabled
                  className="w-full h-9 px-3 bg-slate-100 border border-slate-200 rounded-lg text-slate-500 font-medium cursor-not-allowed"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">O e-mail de acesso não pode ser alterado diretamente pelo usuário.</span>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Função / Perfil no Sistema:</label>
                <div className="h-9 px-3 bg-slate-100 border border-slate-200 rounded-lg text-slate-700 font-bold flex items-center justify-between">
                  <span>{user.role === 'super_adm' ? 'Super ADM Master' : user.role === 'gestor' ? 'Gestor de Escritório' : 'Funcionário Operacional'}</span>
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Solicitar Alteração Modal */}
      {showRequestModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 p-6 max-w-md w-full shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-primary" />
                <span>Solicitar Alteração Cadastral</span>
              </h3>
              <button onClick={() => setShowRequestModal(false)} className="text-slate-400 hover:text-slate-700">
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Descreva as alterações necessárias na Razão Social, CNPJ, Telefone ou Plano da empresa <strong>{activeComp?.tradeName}</strong>. Sua mensagem será enviada diretamente ao Super Administrador.
            </p>

            <textarea
              rows={4}
              placeholder="Ex: Gostaria de atualizar a Razão Social da empresa para Alfa Contábil Ltda e alterar o e-mail financeiro para financeiro@alfacontabil.com.br."
              value={requestDetails}
              onChange={(e) => setRequestDetails(e.target.value)}
              className="w-full p-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-medium focus:outline-none focus:border-primary resize-none"
            />

            {requestSuccess && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-lg flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Solicitação enviada com sucesso ao Super Admin!</span>
              </div>
            )}

            <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                onClick={() => setShowRequestModal(false)}
                className="px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={handleSendUpdateRequest}
                className="px-4 py-1.5 text-xs font-bold text-white bg-primary hover:opacity-90 rounded-lg shadow-xs flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Enviar Solicitação</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
