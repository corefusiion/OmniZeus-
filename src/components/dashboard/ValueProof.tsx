"use client";

import { useState, useEffect, useCallback } from "react";
import { ShieldCheck, Clock, TrendingUp, Coins, Loader2, Calculator } from "lucide-react";
import { getActiveTenantId } from "@/lib/auth/roles";

interface FuncRow {
  funcionalidade: string;
  tipo_operacao: string;
  interacoes: number;
  minutos: number;
  horas: number;
  valor_base: number;
  valor_ajustado: number;
  coins: number;
  custo_brl: number;
}

interface ProofData {
  period: number;
  hourlyCost: number;
  confidence: number;
  scope: "all" | "self";
  totals: {
    interacoes: number;
    minutos: number;
    horas: number;
    valor_base: number;
    valor_ajustado: number;
    coins: number;
    custo_brl: number;
  };
  byFunctionality: FuncRow[];
}

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const fmtBRL2 = (v: number) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtInt = (v: number) => v.toLocaleString("pt-BR");
const fmtHoras = (h: number) => {
  const hs = Math.floor(h);
  const min = Math.round((h - hs) * 60);
  if (hs === 0) return `${min} min`;
  if (min === 0) return `${fmtInt(hs)} h`;
  return `${fmtInt(hs)} h ${min} min`;
};

const PERIODS = [
  { id: "7", label: "7 dias" },
  { id: "30", label: "30 dias" },
  { id: "60", label: "60 dias" },
  { id: "90", label: "90 dias" },
  { id: "year", label: "Este ano" }
];

export default function ValueProof() {
  const [data, setData] = useState<ProofData | null>(null);
  const [period, setPeriod] = useState("30");
  const [hourlyCost, setHourlyCost] = useState(60);
  const [confidence, setConfidence] = useState(80);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetch(
      `/api/value-proof?period=${period}&hourlyCost=${hourlyCost}&confidence=${confidence}`,
      { headers: { "x-company-id": getActiveTenantId() || "global" } }
    )
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("fetch failed"))))
      .then((json) => setData(json))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [period, hourlyCost, confidence]);

  useEffect(() => {
    load();
  }, [load]);

  const t = data?.totals;
  const isSelf = data?.scope === "self";

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 lg:p-6 shadow-xs">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
            <ShieldCheck className="w-4.5 h-4.5" strokeWidth={1.5} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              {isSelf ? "Minha Prova de Valor" : "Prova de Valor da Empresa"}
            </h2>
            <p className="text-[11px] text-slate-500">
              Horas e valor economizados pelas ações de IA — metodologia de precificação por valor
            </p>
          </div>
        </div>

        {/* Período */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 self-start lg:self-auto">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={`px-2.5 py-1.5 rounded-md text-[10px] font-bold transition-all ${
                period === p.id ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Premissas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <label className="block">
          <span className="text-[11px] font-semibold text-slate-600 block mb-1">
            Custo completo da hora (R$) — o que a equipe custa por hora
          </span>
          <input
            type="number"
            min={0}
            value={hourlyCost}
            onChange={(e) => setHourlyCost(Number(e.target.value) >= 0 ? Number(e.target.value) : 0)}
            className="w-full h-9 px-3 text-sm font-bold text-slate-900 bg-white border border-slate-200 rounded-lg outline-none focus:border-primary"
          />
        </label>
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-semibold text-slate-600">Confiança nos dados (ajuste de valor)</span>
            <span className="text-[11px] font-mono font-bold text-primary">{confidence}%</span>
          </div>
          <input
            type="range"
            min={30}
            max={100}
            step={5}
            value={confidence}
            onChange={(e) => setConfidence(Number(e.target.value))}
            className="w-full accent-primary"
          />
        </div>
      </div>

      {loading && !data ? (
        <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
          <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.5} />
          Calculando prova de valor...
        </div>
      ) : !data || !t ? (
        <p className="text-xs text-slate-500 py-2">
          Não foi possível calcular a prova de valor neste período.
        </p>
      ) : t.interacoes === 0 ? (
        <p className="text-xs text-slate-500 py-2">
          Nenhum uso de IA registrado neste período para {isSelf ? "você" : "esta empresa"}.
        </p>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            <div className="bg-slate-50/50 rounded-xl border border-slate-200/70 p-3.5">
              <div className="w-7 h-7 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center mb-2">
                <Clock className="w-3.5 h-3.5" strokeWidth={1.5} />
              </div>
              <p className="text-base font-bold text-slate-900">{fmtHoras(t.horas)}</p>
              <p className="text-[10px] text-slate-500 font-medium">Tempo economizado</p>
            </div>
            <div className="bg-primary/5 rounded-xl border border-primary/15 p-3.5">
              <div className="w-7 h-7 bg-primary/10 text-primary rounded-lg flex items-center justify-center mb-2">
                <TrendingUp className="w-3.5 h-3.5" strokeWidth={1.5} />
              </div>
              <p className="text-base font-bold text-slate-900">{fmtBRL(t.valor_ajustado)}</p>
              <p className="text-[10px] text-slate-500 font-medium">Valor estimado ({confidence}% conf.)</p>
            </div>
            <div className="bg-slate-50/50 rounded-xl border border-slate-200/70 p-3.5">
              <div className="w-7 h-7 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center mb-2">
                <Calculator className="w-3.5 h-3.5" strokeWidth={1.5} />
              </div>
              <p className="text-base font-bold text-slate-900">{fmtInt(t.interacoes)}</p>
              <p className="text-[10px] text-slate-500 font-medium">Interações de IA</p>
            </div>
            <div className="bg-slate-50/50 rounded-xl border border-slate-200/70 p-3.5">
              <div className="w-7 h-7 bg-amber-50 text-amber-600 rounded-lg flex items-center justify-center mb-2">
                <Coins className="w-3.5 h-3.5" strokeWidth={1.5} />
              </div>
              <p className="text-base font-bold text-slate-900">{fmtInt(t.coins)}</p>
              <p className="text-[10px] text-slate-500 font-medium">OmniCoins consumidas</p>
            </div>
          </div>

          {/* Detalhamento */}
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-left min-w-[640px]">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-200">
                  <th className="py-2 pr-3 font-semibold">Funcionalidade</th>
                  <th className="py-2 pr-3 font-semibold text-right">Interações</th>
                  <th className="py-2 pr-3 font-semibold text-right">Tempo economizado</th>
                  <th className="py-2 pr-3 font-semibold text-right">Valor (R$)</th>
                </tr>
              </thead>
              <tbody>
                {data.byFunctionality.map((r, i) => (
                  <tr key={i} className="border-b border-slate-100 text-xs hover:bg-slate-50/60 transition-colors">
                    <td className="py-2.5 pr-3 font-semibold text-slate-800">{r.funcionalidade}</td>
                    <td className="py-2.5 pr-3 text-right text-slate-700">{fmtInt(r.interacoes)}</td>
                    <td className="py-2.5 pr-3 text-right text-slate-700">{fmtHoras(r.horas)}</td>
                    <td className="py-2.5 pr-3 text-right font-medium text-emerald-600">+ {fmtBRL2(r.valor_ajustado)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 rounded-lg bg-slate-50 border border-slate-200 p-3 text-[10px] leading-relaxed text-slate-500">
            <strong className="text-slate-700">Como é calculado:</strong> cada ação de IA recebe um tempo médio
            economizado (ex.: extração de documento ≈ 20 min, auto-resposta de solicitação ≈ 20 min, análise
            Conta Azul ≈ 18 min). Valor = tempo economizado × custo da hora × confiança. Estimativas
            conservadoras — não são garantia. <strong className="text-slate-700">Custo da IA: {fmtBRL2(t.custo_brl)}</strong> no período versus
            valor estimado de <strong className="text-slate-700">{fmtBRL(t.valor_base)}</strong> (antes do ajuste por confiança).
          </div>
        </>
      )}
    </div>
  );
}