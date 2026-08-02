"use client";

import { useState, useEffect } from "react";
import { Users, User, Coins, BrainCircuit, Wallet, Loader2 } from "lucide-react";
import { getActiveTenantId } from "@/lib/auth/roles";

interface UsageRow {
  usuario_id: string;
  usuario_nome: string;
  dia: string;
  interacoes: number;
  coins: number;
  tokens: number;
  custo_brl: number;
  funcionalidades: Record<string, number>;
}

interface UsageTotals {
  interacoes: number;
  coins: number;
  tokens: number;
  custo_brl: number;
}

const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtInt = (v: number) => v.toLocaleString("pt-BR");
const fmtDay = (d: string) => {
  if (!d || d === "—") return "—";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
};

export default function AiUsageByUser() {
  const [rows, setRows] = useState<UsageRow[] | null>(null);
  const [totals, setTotals] = useState<UsageTotals | null>(null);
  const [scope, setScope] = useState<"all" | "self">("self");

  useEffect(() => {
    let active = true;
    fetch("/api/ai-usage/by-user", {
      headers: { "x-company-id": getActiveTenantId() || "global" }
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !data) return;
        setRows(data.rows || []);
        setTotals(data.totals || null);
        setScope(data.scope || "self");
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const isSelf = scope === "self";

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 lg:p-6 shadow-xs">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-violet-50 text-violet-600 rounded-xl flex items-center justify-center">
            {isSelf ? <User className="w-4.5 h-4.5" strokeWidth={1.5} /> : <Users className="w-4.5 h-4.5" strokeWidth={1.5} />}
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              {isSelf ? "Meu Consumo de IA" : "Consumo de IA por Colaborador"}
            </h2>
            <p className="text-[11px] text-slate-500">
              {isSelf ? "Seu uso de OmniCoins e tokens, por dia" : "Uso de OmniCoins e tokens de cada colaborador, por dia"}
            </p>
          </div>
        </div>
      </div>

      {!rows ? (
        <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
          <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.5} />
          Carregando consumo de IA...
        </div>
      ) : rows.length === 0 ? (
        <p className="text-xs text-slate-500 py-2">
          Nenhum consumo de IA registrado ainda nesta empresa.
        </p>
      ) : (
        <>
          {/* Totais */}
          {totals && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
              {[
                { icon: BrainCircuit, label: "Interações", value: fmtInt(totals.interacoes), color: "text-blue-600", bg: "bg-blue-50" },
                { icon: Coins, label: "OmniCoins", value: fmtInt(totals.coins), color: "text-primary", bg: "bg-blue-50" },
                { icon: Wallet, label: "Custo (R$)", value: fmtBRL(totals.custo_brl), color: "text-emerald-600", bg: "bg-emerald-50" },
                { icon: BrainCircuit, label: "Tokens", value: fmtInt(totals.tokens), color: "text-violet-600", bg: "bg-violet-50" }
              ].map((s, i) => (
                <div key={i} className="bg-slate-50/50 rounded-xl border border-slate-200/70 p-3.5">
                  <div className={`w-7 h-7 ${s.bg} ${s.color} rounded-lg flex items-center justify-center mb-2`}>
                    <s.icon className="w-3.5 h-3.5" strokeWidth={1.5} />
                  </div>
                  <p className="text-base font-bold text-slate-900">{s.value}</p>
                  <p className="text-[10px] text-slate-500 font-medium">{s.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Tabela */}
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-left min-w-[560px]">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-200">
                  <th className="py-2 pr-3 font-semibold">{isSelf ? "Dia" : "Colaborador"}</th>
                  {!isSelf && <th className="py-2 pr-3 font-semibold">Dia</th>}
                  <th className="py-2 pr-3 font-semibold text-right">Interações</th>
                  <th className="py-2 pr-3 font-semibold text-right">Coins</th>
                  <th className="py-2 pr-3 font-semibold text-right">Tokens</th>
                  <th className="py-2 pr-3 font-semibold text-right">Custo (R$)</th>
                  <th className="py-2 font-semibold">Funcionalidades</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b border-slate-100 text-xs hover:bg-slate-50/60 transition-colors">
                    <td className="py-2.5 pr-3 font-semibold text-slate-800">{isSelf ? fmtDay(r.dia) : r.usuario_nome}</td>
                    {!isSelf && <td className="py-2.5 pr-3 text-slate-500">{fmtDay(r.dia)}</td>}
                    <td className="py-2.5 pr-3 text-right text-slate-700">{fmtInt(r.interacoes)}</td>
                    <td className="py-2.5 pr-3 text-right text-slate-700">{fmtInt(r.coins)}</td>
                    <td className="py-2.5 pr-3 text-right text-slate-700">{fmtInt(r.tokens)}</td>
                    <td className="py-2.5 pr-3 text-right font-medium text-slate-800">{fmtBRL(r.custo_brl)}</td>
                    <td className="py-2.5 text-slate-500">
                      {Object.entries(r.funcionalidades)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 2)
                        .map(([f, n]) => `${f} (${n})`)
                        .join(" · ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
