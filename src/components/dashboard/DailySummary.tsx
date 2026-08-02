"use client";

import { useState, useEffect } from "react";
import { CalendarClock, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { getActiveTenantId } from "@/lib/auth/roles";

interface SummaryItem {
  module: string;
  title: string;
  tone: "ok" | "warn" | "danger";
  text: string;
}

export default function DailySummary() {
  const [items, setItems] = useState<SummaryItem[] | null>(null);
  const [date, setDate] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/daily-summary", {
      headers: { "x-company-id": getActiveTenantId() || "global" }
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !data) return;
        setItems(data.items || []);
        setDate(data.date || "");
      })
      .catch(() => {})
      .finally(() => {});
    return () => { active = false; };
  }, []);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 lg:p-6 shadow-xs">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-blue-50 text-primary rounded-xl flex items-center justify-center">
            <CalendarClock className="w-4.5 h-4.5" strokeWidth={1.5} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">Resumo de Hoje</h2>
            <p className="text-[11px] text-slate-500 capitalize">{date || "Carregando..."}</p>
          </div>
        </div>
      </div>

      {!items ? (
        <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
          <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.5} />
          Analisando o dia da empresa...
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((item, i) => (
            <div
              key={i}
              className={`flex items-start gap-2.5 rounded-xl border p-3.5 ${
                item.tone === "danger"
                  ? "bg-rose-50/60 border-rose-200/80"
                  : item.tone === "warn"
                    ? "bg-amber-50/60 border-amber-200/80"
                    : "bg-emerald-50/50 border-emerald-200/70"
              }`}
            >
              <div className="mt-0.5 shrink-0">
                {item.tone === "danger" ? (
                  <AlertTriangle className="w-4 h-4 text-rose-600" strokeWidth={1.5} />
                ) : item.tone === "warn" ? (
                  <AlertTriangle className="w-4 h-4 text-amber-600" strokeWidth={1.5} />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" strokeWidth={1.5} />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-slate-800">{item.title}</p>
                <p className="text-[11px] text-slate-600 leading-relaxed mt-0.5">{item.text}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
