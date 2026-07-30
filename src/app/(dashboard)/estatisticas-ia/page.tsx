"use client";

import { useState, useEffect } from "react";
import { Activity, BarChart2 } from "lucide-react";
import { getActiveRole, UserRole } from "@/lib/auth/roles";

export default function EstatisticasIAPage() {
  const [role, setRole] = useState<UserRole>("gestor");

  useEffect(() => {
    setRole(getActiveRole());
    const handleRoleChange = () => setRole(getActiveRole());
    window.addEventListener("omnizeus_role_change", handleRoleChange);
    return () => window.removeEventListener("omnizeus_role_change", handleRoleChange);
  }, []);

  if (role === "funcionario") {
    return (
      <div className="p-6 text-center text-slate-500 font-medium">
        Acesso restrito a Gestores.
      </div>
    );
  }

  return (
    <div className="space-y-6 text-slate-900 font-sans">
      <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-purple-600" />
              Estatísticas de Uso da IA
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Este é seu <strong>20 º dia</strong> com a plataforma OmniZeus AI
            </p>
          </div>
          <span className="text-[11px] font-semibold text-slate-400">
            Registrado em: 2026-07-08 • Atualizado em: 2026-07-27
          </span>
        </div>

        {/* 4 Cards Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Agentes Ativos</span>
            <span className="text-2xl font-extrabold text-slate-900 block">15 LLMs</span>
            <span className="text-[10px] text-slate-500 mt-1 block">OpenRouter & Local</span>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Tópicos Fiscais</span>
            <span className="text-2xl font-extrabold text-slate-900 block">11 Ativos</span>
            <span className="text-[10px] text-slate-500 mt-1 block">Consultas salvas</span>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Mensagens</span>
            <span className="text-2xl font-extrabold text-slate-900 block">171 Processadas</span>
            <span className="text-[10px] text-slate-500 mt-1 block">Tempo médio ~1.2s</span>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80">
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 block mb-1">Total de Tokens</span>
            <span className="text-2xl font-extrabold text-purple-700 block">5.6M Tokens</span>
            <span className="text-[10px] text-purple-600 mt-1 block">Pico Diário Máximo</span>
          </div>
        </div>
      </div>

      {/* Activity Grid Matrix Heatmap */}
      <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-600" />
            <span>Atividade de Uso no Último Ano</span>
          </h3>
          <div className="flex items-center gap-2 text-[10px] font-semibold">
            <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">Tokens</span>
            <span className="text-slate-400">Mensagens</span>
          </div>
        </div>

        {/* Matrix Squares */}
        <div className="overflow-x-auto pt-2 pb-1">
          <div className="flex items-center gap-1.5 min-w-[600px] text-[10px] text-slate-400 font-medium justify-between mb-2">
            <span>Ago</span><span>Set</span><span>Out</span><span>Nov</span><span>Dez</span><span>Jan</span><span>Fev</span><span>Mar</span><span>Abr</span><span>Mai</span><span>Jun</span><span>Jul</span>
          </div>
          <div className="grid grid-cols-12 gap-1.5 min-w-[600px]">
            {Array.from({ length: 12 }).map((_, col) => (
              <div key={col} className="grid grid-rows-5 gap-1.5">
                {Array.from({ length: 5 }).map((_, row) => {
                  const isActive = col === 11 && row >= 3;
                  return (
                    <div
                      key={row}
                      className={`w-full h-3 rounded-xs transition-colors ${
                        isActive ? 'bg-emerald-500' : 'bg-slate-100 hover:bg-slate-200'
                      }`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
          <div className="flex items-center justify-end gap-1.5 text-[9px] text-slate-400 mt-3 font-semibold">
            <span>Inativo</span>
            <span className="w-2.5 h-2.5 rounded-xs bg-slate-100" />
            <span className="w-2.5 h-2.5 rounded-xs bg-emerald-200" />
            <span className="w-2.5 h-2.5 rounded-xs bg-emerald-400" />
            <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600" />
            <span>Ativo</span>
          </div>
        </div>
      </div>

      {/* 3 Rankings Columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Model Ranking */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs space-y-3">
          <h4 className="text-xs font-bold text-slate-900 border-b border-slate-100 pb-2.5">
            Ranking de Uso dos Modelos
          </h4>
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between p-2 bg-primary/10/60 rounded-lg font-semibold">
              <span className="text-primary font-mono">deepseek-v4-pro</span>
              <span className="text-slate-900 font-extrabold">81 msgs</span>
            </div>
            <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg text-slate-700">
              <span className="font-mono">claude-fable-5</span>
              <span className="font-bold text-slate-900">2 msgs</span>
            </div>
            <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg text-slate-700">
              <span className="font-mono">claude-sonnet-4-8</span>
              <span className="font-bold text-slate-900">1 msg</span>
            </div>
            <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg text-slate-700">
              <span className="font-mono">gemini-3.6-flash</span>
              <span className="font-bold text-slate-900">1 msg</span>
            </div>
          </div>
        </div>

        {/* Agent Ranking */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs space-y-3">
          <h4 className="text-xs font-bold text-slate-900 border-b border-slate-100 pb-2.5">
            Ranking de Uso dos Agentes
          </h4>
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg font-semibold">
              <span className="text-slate-900">Omni AI / Especialista Fiscal</span>
              <span className="text-slate-900 font-extrabold">8 tópicos</span>
            </div>
            <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg text-slate-700">
              <span className="text-slate-700">Auditor Trabalhista eSocial</span>
              <span className="text-slate-900 font-bold">2 tópicos</span>
            </div>
            <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg text-slate-700">
              <span className="text-slate-700">Análise de Balancete ECD</span>
              <span className="text-slate-900 font-bold">1 tópico</span>
            </div>
          </div>
        </div>

        {/* Topics Ranking */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs space-y-3">
          <h4 className="text-xs font-bold text-slate-900 border-b border-slate-100 pb-2.5">
            Tópicos mais Ativos
          </h4>
          <div className="space-y-2 text-xs">
            <div className="p-2 bg-slate-50 rounded-lg space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 truncate pr-2">Análise de Risco Fiscal 2026</span>
                <span className="text-slate-500 font-semibold shrink-0">43 msgs</span>
              </div>
              <p className="text-[10px] text-slate-400">Especialista Fiscal • 3h atrás</p>
            </div>
            <div className="p-2 bg-slate-50 rounded-lg space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-700 truncate pr-2">Revisão DIRF vs Reinf</span>
                <span className="text-slate-500 font-medium shrink-0">12 msgs</span>
              </div>
              <p className="text-[10px] text-slate-400">Auditor Trabalhista • 1 dia atrás</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
