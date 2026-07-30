"use client";

import { useState, useEffect } from "react";
import { Settings, User, Save, CheckCircle2, Building2, Lock, ShieldAlert } from "lucide-react";
import { getCurrentUser, UserProfile, getActiveCompanyId } from "@/lib/auth/roles";
import { getCompanies, saveCompany, CompanyProfile } from "@/lib/company/store";

export default function ConfiguracoesPage() {
  const [user, setUser] = useState<UserProfile>(getCurrentUser());
  const [activeComp, setActiveComp] = useState<CompanyProfile | null>(null);
  
  // Form State
  const [corpName, setCorpName] = useState("");
  const [tradeName, setTradeName] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [userName, setUserName] = useState("");

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

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  return (
    <div className="space-y-6 text-slate-900 font-sans pb-12">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-5 lg:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-slate-900 tracking-tight">
            Configurações Gerais
          </h1>
          <p className="text-xs lg:text-sm text-slate-500 mt-1">
            Informações do perfil do usuário e preferências do sistema.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleSaveSettings}
            className="px-5 py-2.5 bg-primary hover:opacity-90 text-white text-xs font-semibold rounded-lg flex items-center gap-2 transition-all shadow-xs"
          >
            <Save className="w-4 h-4" />
            <span>Salvar Alterações</span>
          </button>
        </div>
      </div>

      {savedSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200/60 text-emerald-800 text-xs font-semibold rounded-xl flex items-center gap-2 shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>Configurações salvas com sucesso!</span>
        </div>
      )}

      {/* Dados da Empresa & Perfil */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Dados da Empresa (Desativado para não-Master ADM) */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" />
              <span>Dados da Empresa</span>
            </h2>

            {!isMasterAdmin && (
              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-bold border border-slate-200 flex items-center gap-1">
                <Lock className="w-3 h-3 text-slate-400" />
                <span>Apenas Leitura</span>
              </span>
            )}
          </div>

          {!isMasterAdmin && (
            <div className="p-2.5 bg-slate-50 border border-slate-200/60 rounded-lg text-[11px] text-slate-500 flex items-center gap-2 font-medium">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>A alteração dos dados cadastrais da empresa é restrita exclusivamente ao Administrador Master.</span>
            </div>
          )}

          <div className="space-y-3 text-xs">
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Razão Social:</label>
              <input
                type="text"
                value={corpName}
                onChange={(e) => setCorpName(e.target.value)}
                disabled={!isMasterAdmin}
                className={`w-full h-9 px-3 border rounded-lg font-semibold transition-all ${
                  isMasterAdmin 
                    ? "bg-slate-50 border-slate-200 text-slate-900 focus:outline-none focus:border-primary" 
                    : "bg-slate-100 border-slate-200 text-slate-600 cursor-not-allowed"
                }`}
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Nome Fantasia:</label>
              <input
                type="text"
                value={tradeName}
                onChange={(e) => setTradeName(e.target.value)}
                disabled={!isMasterAdmin}
                className={`w-full h-9 px-3 border rounded-lg font-semibold transition-all ${
                  isMasterAdmin 
                    ? "bg-slate-50 border-slate-200 text-slate-900 focus:outline-none focus:border-primary" 
                    : "bg-slate-100 border-slate-200 text-slate-600 cursor-not-allowed"
                }`}
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">CNPJ:</label>
              <input
                type="text"
                value={cnpj}
                onChange={(e) => setCnpj(e.target.value)}
                disabled={!isMasterAdmin}
                className={`w-full h-9 px-3 border rounded-lg font-semibold transition-all ${
                  isMasterAdmin 
                    ? "bg-slate-50 border-slate-200 text-slate-900 focus:outline-none focus:border-primary" 
                    : "bg-slate-100 border-slate-200 text-slate-600 cursor-not-allowed"
                }`}
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Fuso Horário (Sistema):</label>
              <input
                type="text"
                value="America/Sao_Paulo (BRT)"
                disabled
                className="w-full h-9 px-3 bg-slate-100 border border-slate-200 rounded-lg text-slate-500 font-medium cursor-not-allowed"
              />
            </div>
          </div>
        </div>

        {/* Perfil do Usuário Logado (Editável pelo Usuário) */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <User className="w-4 h-4 text-primary" />
              <span>Perfil do Usuário Logado</span>
            </h2>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Nome Completo:</label>
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-bold focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">E-mail de Acesso:</label>
              <input
                type="email"
                value={user.email}
                disabled
                className="w-full h-9 px-3 bg-slate-100 border border-slate-200 rounded-lg text-slate-500 font-medium cursor-not-allowed"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Função / Perfil no Sistema:</label>
              <input
                type="text"
                value={user.role === 'super_adm' ? 'Master Admin' : user.role === 'gestor' ? 'Gestor do Escritório' : 'Funcionário Operacional'}
                disabled
                className="w-full h-9 px-3 bg-slate-100 border border-slate-200 rounded-lg text-slate-500 font-bold cursor-not-allowed"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
