"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { MessageSquare, X, Send, Sparkles, Cpu, Coins } from "lucide-react";
import { getActiveTenantId } from "@/lib/auth/roles";

interface RagMessage {
  id: string;
  sender: "user" | "ai";
  text: string;
}

const SUGGESTIONS = [
  "Qual o saldo de OmniCoins da empresa?",
  "Quais contas vencem hoje?",
  "Resumo das tarefas em aberto"
];

const STORAGE_KEY = "omnizeus_company_rag_messages";

export default function CompanyRagChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<RagMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setMessages(JSON.parse(raw));
    } catch (e) {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-50)));
    } catch (e) {}
  }, [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, open]);

  const ask = useCallback(async (question: string) => {
    const q = question.trim();
    if (!q || loading) return;
    setInput("");
    setMessages((prev) => [
      ...prev,
      { id: `u_${Date.now()}`, sender: "user", text: q }
    ]);
    setLoading(true);
    try {
      const res = await fetch("/api/company-rag", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-company-id": getActiveTenantId() || "global"
        },
        body: JSON.stringify({ question: q })
      });
      const data = await res.json();
      if (!res.ok) {
        const fallbackText = data.error || "Servidor fora de operação, aguarde um momento e tente novamente.";
        setMessages((prev) => [
          ...prev,
          { id: `a_${Date.now()}`, sender: "ai", text: fallbackText }
        ]);
        return;
      }
      setMessages((prev) => [
        ...prev,
        { id: `a_${Date.now()}`, sender: "ai", text: data.text }
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { id: `a_${Date.now()}`, sender: "ai", text: "Falha de conexão com o servidor. Tente novamente." }
      ]);
    } finally {
      setLoading(false);
    }
  }, [loading]);

  return (
    <>
      {/* Botão flutuante */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-5 right-5 z-50 w-12 h-12 bg-primary hover:bg-primary/90 text-white rounded-2xl shadow-xl flex items-center justify-center transition-all hover:scale-105"
        title="Pergunte sobre esta empresa"
        aria-label="Pergunte sobre esta empresa"
      >
        {open ? <X className="w-5 h-5" strokeWidth={1.5} /> : <MessageSquare className="w-5 h-5" strokeWidth={1.5} />}
      </button>

      {/* Painel de chat */}
      {open && (
        <div className="fixed bottom-20 right-5 z-50 w-[calc(100vw-2.5rem)] max-w-sm bg-white rounded-2xl border border-slate-200/80 shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95" style={{ height: "min(560px, calc(100vh - 7rem))" }}>
          {/* Header */}
          <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 bg-primary rounded-xl flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4" strokeWidth={1.5} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold truncate">Pergunte sobre esta empresa</p>
                <p className="text-[10px] text-slate-400 truncate">Respostas com dados reais do seu tenant</p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-white transition-colors shrink-0">
              <X className="w-4 h-4" strokeWidth={1.5} />
            </button>
          </div>

          {/* Mensagens */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5 bg-[#F8FAFC]">
            {messages.length === 0 && (
              <div className="space-y-2.5">
                <p className="text-[11px] text-slate-500 leading-relaxed px-1">
                  Faça perguntas sobre a empresa atual: saldo de coins, contas a pagar, tarefas, contratos, clientes e mais.
                </p>
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => ask(s)}
                    disabled={loading}
                    className="block w-full text-left text-[11px] text-slate-700 bg-white border border-slate-200 hover:border-primary/50 hover:text-primary rounded-xl px-3 py-2 transition-colors disabled:opacity-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.sender === "user" ? "justify-end" : "justify-start"}`}>
                {m.sender === "ai" && (
                  <div className="w-6 h-6 bg-primary rounded-lg flex items-center justify-center mr-2 mt-0.5 shrink-0">
                    <Sparkles className="w-3 h-3 text-white" strokeWidth={1.5} />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-2xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap break-words ${
                    m.sender === "user"
                      ? "bg-primary text-white rounded-tr-none"
                      : "bg-white border border-slate-200 text-slate-800 rounded-tl-none"
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="w-6 h-6 bg-primary rounded-lg flex items-center justify-center mr-2 mt-0.5 shrink-0">
                  <Sparkles className="w-3 h-3 text-white" strokeWidth={1.5} />
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-none px-3 py-2.5 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" />
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "120ms" }} />
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "240ms" }} />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-slate-200/80 bg-white shrink-0">
            <form
              onSubmit={(e) => { e.preventDefault(); ask(input); }}
              className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus-within:border-primary/60"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ex.: Quais contas vencem hoje?"
                className="flex-1 bg-transparent text-xs text-slate-800 placeholder:text-slate-400 outline-none"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="w-7 h-7 bg-primary disabled:bg-slate-300 text-white rounded-lg flex items-center justify-center shrink-0 transition-colors"
              >
                <Send className="w-3.5 h-3.5" strokeWidth={1.5} />
              </button>
            </form>
            <p className="flex items-center justify-center gap-1 mt-2 text-[9px] text-slate-400">
              <Cpu className="w-3 h-3" strokeWidth={1.5} />
              Claude 3.7 Sonnet
              <span className="text-slate-300">•</span>
              <Coins className="w-3 h-3" strokeWidth={1.5} />
              5 OmniCoins / Consulta
            </p>
          </div>
        </div>
      )}
    </>
  );
}
