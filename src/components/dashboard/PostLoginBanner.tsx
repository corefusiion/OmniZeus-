"use client";

import { useState, useEffect } from "react";
import { X, Sparkles } from "lucide-react";
import { useTenant } from "@/lib/tenant/TenantContext";
import { getCurrentUser } from "@/lib/auth/roles";
import DailySummary from "@/components/dashboard/DailySummary";
import CashFlowProjection from "@/components/dashboard/CashFlowProjection";

const FLAG = "omnizeus_post_login_banner";

export default function PostLoginBanner() {
  const [visible, setVisible] = useState(false);
  const { isTenantMode } = useTenant();

  useEffect(() => {
    // Aparece UMA vez por login (flag setado na página de login e consumido aqui).
    // Em F5/refresh o flag já foi removido → banner não reaparece.
    let shouldShow = false;
    try {
      if (sessionStorage.getItem(FLAG)) {
        shouldShow = true;
        sessionStorage.removeItem(FLAG);
      }
    } catch (e) {}
    if (shouldShow) {
      const t = setTimeout(() => setVisible(true), 250);
      return () => clearTimeout(t);
    }
  }, []);

  if (!visible) return null;

  const user = getCurrentUser();
  const firstName = (user?.name || "").split(" ")[0] || "Bem-vindo";

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl animate-in fade-in slide-in-from-top-4 duration-500">
      {/* Brilho decorativo */}
      <div className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 bg-primary/5 rounded-full blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 -left-20 w-64 h-64 bg-blue-400/5 rounded-full blur-3xl" />

      <button
        onClick={() => setVisible(false)}
        className="absolute top-3.5 right-3.5 z-10 w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors"
        title="Fechar lembrete"
        aria-label="Fechar lembrete"
      >
        <X className="w-4 h-4" strokeWidth={1.5} />
      </button>

      <div className="relative p-5 sm:p-6 lg:p-7 space-y-4">
        <div className="flex items-start gap-3.5 pr-10">
          <div className="w-11 h-11 bg-primary rounded-2xl flex items-center justify-center shadow-lg shrink-0">
            <Sparkles className="w-5.5 h-5.5 text-white" strokeWidth={1.5} />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              Olá, {firstName}! Este é o resumo do seu dia.
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
              Pendências que precisam de atenção hoje e a projeção do caixa. Aproveite e feche o lembrete — ele só volta no próximo login.
            </p>
          </div>
        </div>

        {isTenantMode ? (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <DailySummary />
            <CashFlowProjection />
          </div>
        ) : (
          <p className="text-xs text-slate-500 leading-relaxed">
            Você está no centro de controle da plataforma. Acesse o dashboard de uma empresa para ver o resumo diário e a projeção de caixa.
          </p>
        )}
      </div>
    </div>
  );
}
