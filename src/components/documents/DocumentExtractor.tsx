"use client";

import { useState, useRef } from "react";
import { Upload, FileText, Sparkles, Coins, Copy, CheckCircle2, X, Loader2 } from "lucide-react";
import { getActiveTenantId } from "@/lib/auth/roles";

export default function DocumentExtractor() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleFile = (f: File | null) => {
    if (!f) return;
    const ext = f.name.split(".").pop()?.toLowerCase() || "";
    if (!["pdf", "png", "jpg", "jpeg", "webp"].includes(ext)) {
      setError("Envie um PDF, PNG, JPG ou WEBP.");
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setError("Arquivo muito grande (máx. 10 MB).");
      return;
    }
    setError("");
    setResult("");
    setFile(f);
  };

  const handleExtract = async () => {
    if (!file || loading) return;
    setLoading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/document-extract", {
        method: "POST",
        headers: { "x-company-id": getActiveTenantId() || "global" },
        body: formData
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Não foi possível extrair o documento.");
        return;
      }
      setResult(data.extracted);
    } catch (err) {
      setError("Falha de conexão com o servidor. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const copyResult = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 p-5 lg:p-6 shadow-xs space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-blue-50 text-primary rounded-xl flex items-center justify-center">
            <FileText className="w-4.5 h-4.5" strokeWidth={1.5} />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Extração Automática de Documentos</h2>
            <p className="text-[11px] text-slate-500">
              Envie a foto ou PDF (nota fiscal, contrato, boleto, comprovante) e a IA extrai todo o conteúdo
            </p>
          </div>
        </div>
        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1 shrink-0">
          <Coins className="w-3 h-3" strokeWidth={1.5} />
          5 OmniCoins / documento
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Dropzone */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            handleFile(e.dataTransfer.files?.[0] || null);
          }}
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-slate-300 hover:border-primary/60 rounded-xl p-8 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors bg-slate-50/50"
        >
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0] || null)}
          />
          <Upload className="w-6 h-6 text-slate-400" strokeWidth={1.5} />
          <p className="text-xs font-semibold text-slate-700">
            {file ? file.name : "Clique ou arraste o documento aqui"}
          </p>
          <p className="text-[10px] text-slate-400">PDF, PNG, JPG ou WEBP · máx. 10 MB</p>
          {file && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setFile(null);
                setResult("");
              }}
              className="text-[10px] text-rose-600 hover:underline flex items-center gap-1"
            >
              <X className="w-3 h-3" strokeWidth={1.5} />
              Remover arquivo
            </button>
          )}
        </div>

        {/* Ação + resultado */}
        <div className="space-y-3">
          <button
            onClick={handleExtract}
            disabled={!file || loading}
            className="w-full py-2.5 bg-primary hover:opacity-90 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-all shadow-xs disabled:opacity-40"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.5} /> : <Sparkles className="w-4 h-4" strokeWidth={1.5} />}
            <span>{loading ? "Extraindo com IA..." : "Extrair dados — 5 Coins"}</span>
          </button>

          {error && (
            <p className="text-[11px] text-rose-600 bg-rose-50 border border-rose-200/80 rounded-lg px-3 py-2">{error}</p>
          )}

          {result && (
            <div className="relative">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 max-h-72 overflow-y-auto">
                <pre className="text-[11px] text-slate-700 leading-relaxed whitespace-pre-wrap font-sans">{result}</pre>
              </div>
              <button
                onClick={copyResult}
                className="absolute top-2 right-2 w-8 h-8 bg-white border border-slate-200 hover:border-slate-300 rounded-lg flex items-center justify-center text-slate-500 shadow-xs transition-colors"
                title="Copiar texto"
              >
                {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-600" strokeWidth={1.5} /> : <Copy className="w-4 h-4" strokeWidth={1.5} />}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
