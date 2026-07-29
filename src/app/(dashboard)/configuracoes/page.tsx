"use client";

import { useState, useEffect } from "react";
import { Settings, User, Save, CheckCircle2, Building2 } from "lucide-react";
import { getActiveRole, UserRole } from "@/lib/auth/roles";

export default function ConfiguracoesPage() {
  const [role, setRole] = useState<UserRole>("gestor");
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    setRole(getActiveRole());
    const handleRoleChange = () => setRole(getActiveRole());
    window.addEventListener("omnizeus_role_change", handleRoleChange);
    return () => window.removeEventListener("omnizeus_role_change", handleRoleChange);
  }, []);

  const handleSaveSettings = () => {
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  return (
    <div className="space-y-6 text-slate-900 font-sans">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-5 lg:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-slate-900 tracking-tight">
            Configurações Gerais
          </h1>
          <p className="text-xs lg:text-sm text-slate-500 mt-1">
            Dados básicos do escritório, fuso horário e informações do sistema.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleSaveSettings}
            className="px-5 py-2.5 bg-[#1E6FD9] hover:bg-blue-600 text-white text-xs font-semibold rounded-lg flex items-center gap-2 transition-all shadow-xs"
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
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs">
          <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 mb-4 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-[#1E6FD9]" />
            <span>Dados da Empresa</span>
          </h2>
          <div className="space-y-3 text-xs">
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Razão Social:</label>
              <input type="text" defaultValue="Zenitus Inteligência Contábil Ltda" className="w-full h-8 px-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-medium" />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">CNPJ:</label>
              <input type="text" defaultValue="42.189.902/0001-55" disabled className="w-full h-8 px-3 bg-slate-100 border border-slate-200 rounded-lg text-slate-500 font-medium" />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Fuso Horário (Sistema):</label>
              <input type="text" defaultValue="America/Sao_Paulo (BRT)" disabled className="w-full h-8 px-3 bg-slate-100 border border-slate-200 rounded-lg text-slate-500 font-medium" />
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs">
          <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 mb-4 flex items-center gap-2">
            <User className="w-4 h-4 text-[#1E6FD9]" />
            <span>Perfil do Usuário Logado</span>
          </h2>
          <div className="space-y-3 text-xs">
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Nome Completo:</label>
              <input type="text" defaultValue="Carlos Mendes" className="w-full h-8 px-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-bold" />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Cargo / Perfil:</label>
              <input type="text" defaultValue="Gestor — Diretoria Fiscal" disabled className="w-full h-8 px-3 bg-slate-100 border border-slate-200 rounded-lg text-slate-500 font-medium" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
