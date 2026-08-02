"use client";

import { useState, useEffect } from "react";
import { TrendingUp, TrendingDown, Wallet, AlertTriangle, Sparkles, Loader2, RefreshCw } from "lucide-react";
import { getActiveTenantId } from "@/lib/auth/roles";

const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface Projection {
  receitas: number;
  despesas: number;
  saldo: number;
}

interface Data {
  saldoInicial: number;
  projection30: Projection;
  projection60: Projection;
  mrr: number;
  analysis: string;
  aiUsed: boolean;
  model?: string | null;
}

export default function CashFlowProjection() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    setError("");
    fetch("/api/cash-flow/project", {
      headers: { "x-company-id": getActiveTenantId() || "global" }
    })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Erro ao projetar fluxo de caixa.");
        setData(json);
      })
      .catch((err) => setError(err.message || "Erro de conexão."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const renderWindow = (label: string, p: Projection, saldoInicial: number) => {
    const positive = p.saldo >= 0;
    return (
      <div className="bg-slate-50/50 rounded-xl border border-slate-200/70 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${positive ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}>
            {positive ? "Positivo" : "Déficit"}
          </span>
        </div>
        <div className={`text-2xl font-bold tracking-tight ${positive ? "text-emerald-600" : "text-rose-600"}`}>
          R$ {fmtBRL(p.saldo)}
        </div>
        <div className="mt-2 space-y-1 text-[11px] text-slate-500">
          <div className="flex justify-between"><span>Receitas</span><span className="font-semibold text-emerald-600">R$ {fmtBRL(p.receitas)}</span></div>
          <div className="flex justify-between"><span>Despesas</span><span className="font-semibold text-amber-600">R$ {fmtBRL(p.despesas)}</span></div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 lg:p-6 shadow-xs">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
            <TrendingUp className="w-4.5 h-4.5" strokeWidth={1.5} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">Fluxo de Caixa Projetado</h2>
            <p className="text-[11px] text-slate-500">Projeção de 30 e 60 dias com análise de IA</p>
          </div>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="w-8 h-8 bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-lg flex items-center justify-center text-slate-500 transition-colors disabled:opacity-50"
          title="Atualizar projeção"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} strokeWidth={1.5} />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-slate-500 py-3">
          <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.5} />
          Projetando fluxo de caixa...
        </div>
      ) : error ? (
        <p className="text-xs text-rose-600 py-2">{error}</p>
      ) : data ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-slate-50/50 rounded-xl border border-slate-200/70 p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <Wallet className="w-3.5 h-3.5 text-slate-400" strokeWidth={1.5} />
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Saldo Realizado</span>
              </div>
              <div className="text-2xl font-bold text-slate-900 tracking-tight">R$ {fmtBRL(data.saldoInicial)}</div>
              <p className="text-[11px] text-slate-400 mt-1">entradas − saídas quitadas</p>
            </div>
            {renderWindow("Próximos 30 dias", data.projection30, data.saldoInicial)}
            {renderWindow("Próximos 60 dias", data.projection60, data.saldoInicial)}
            <div className="bg-slate-50/50 rounded-xl border border-slate-200/70 p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <TrendingDown className="w-3.5 h-3.5 text-slate-400" strokeWidth={1.5} />
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">MRR Contratos</span>
              </div>
              <div className="text-2xl font-bold text-primary tracking-tight">R$ {fmtBRL(data.mrr)}</div>
              <p className="text-[11px] text-slate-400 mt-1">receita recorrente / mês</p>
            </div>
          </div>

          <div className="bg-blue-50/50 border border-blue-200/70 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-primary" strokeWidth={1.5} />
              <span className="text-[11px] font-bold text-slate-800">
                Análise Inteligente{data.aiUsed ? ` · ${data.model?.split("/").pop() || ""}` : ""}
              </span>
              {data.aiUsed ? (
                <span className="text-[9px] font-semibold text-primary bg-blue-100 px-1.5 py-0.5 rounded">5 Coins</span>
              ) : (
                <span className="text-[9px] font-semibold text-slate-400 bg-white px-1.5 py-0.5 rounded border border-slate-200">sem IA</span>
              )}
            </div>
            <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">{data.analysis}</p>
          </div>

          {(data.projection30.saldo < 0 || data.projection60.saldo < 0) && (
            <div className="flex items-center gap-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-200/80 rounded-xl px-3.5 py-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0" strokeWidth={1.5} />
              Atenção: há risco de saldo negativo no período. Considere antecipar recebimentos e revisar vencimentos.
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
