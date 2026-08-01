"use client";

import { useState, useRef } from "react";
import { Upload, FileDown, Users, X, CheckCircle2, AlertCircle, KeyRound, Copy, RefreshCw } from "lucide-react";
import { saveEmployee } from "@/lib/company/store";
import { generateTemporaryPassword, hashPassword } from "@/lib/auth/passwordUtils";

const MAX_BATCH = 10;
const FALLBACK_MODULES = ['omni-ia', 'tarefas', 'whatsapp-bot', 'documentos'];

export interface BatchUserRow {
  nome: string;
  email: string;
  cargo: string;
  funcao: 'gestor' | 'funcionario';
  error?: string;
}

interface BatchUserUploadProps {
  companyId: string;
  companyName?: string;
  jobRoles: string[];
  defaultRole?: 'gestor' | 'funcionario';
  defaultModules?: string[];
  onCreated?: () => void;
}

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const sep = text.includes(";") ? ";" : ",";

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        field += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === sep && !inQuotes) {
      row.push(field.trim());
      field = "";
    } else if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      if (field.trim() || row.length > 0) row.push(field.trim());
      if (row.some(c => c !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field.trim() || row.length > 0) {
    row.push(field.trim());
    if (row.some(c => c !== "")) rows.push(row);
  }
  return rows;
}

function normalizeFuncao(value: string): 'gestor' | 'funcionario' {
  const v = value.trim().toLowerCase();
  if (v === "gestor" || v === "gestor_escritorio" || v === "gestor do escritório" || v === "gerente") return "gestor";
  return "funcionario";
}

export default function BatchUserUpload({
  companyId,
  companyName,
  jobRoles,
  defaultRole = "funcionario",
  defaultModules,
  onCreated,
}: BatchUserUploadProps) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<BatchUserRow[]>([]);
  const [parsed, setParsed] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultModal, setResultModal] = useState<{ total: number; users: { name: string; email: string; password: string }[]; skipped: number } | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = () => {
    const header = "nome;email;cargo;funcao";
    const example1 = `Mariana Castro;mariana@empresa.com.br;Analista Fiscal Sênior;funcionario`;
    const example2 = `Carlos Mendes;carlos@empresa.com.br;Gestor de Escritório;gestor`;
    const content = `${header}\n${example1}\n${example2}\n`;
    const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modelo_cadastro_usuarios.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFile = (file: File) => {
    setError(null);
    setParsed(false);
    setRows([]);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = String(e.target?.result || "");
      const matrix = parseCSV(text);
      if (matrix.length === 0) {
        setError("Arquivo vazio ou sem linhas de dados.");
        return;
      }

      // Detecta o cabeçalho (normaliza minúsculas)
      const headerRow = matrix[0].map(h => h.toLowerCase().replace(/\s+/g, ""));
      const idxNome = headerRow.findIndex(h => h.includes("nome"));
      const idxEmail = headerRow.findIndex(h => h.includes("email"));
      const idxCargo = headerRow.findIndex(h => h.includes("cargo") || h.includes("departamento"));
      const idxFuncao = headerRow.findIndex(h => h.includes("funcao") || h.includes("role"));
      const dataRows = matrix.slice(1);

      if (dataRows.length === 0) {
        setError("Nenhuma linha de colaboradores encontrada no arquivo.");
        return;
      }
      if (dataRows.length > MAX_BATCH) {
        setError(`O lote máximo é de ${MAX_BATCH} colaboradores por vez. Seu arquivo tem ${dataRows.length}.`);
        return;
      }
      if (idxNome === -1 || idxEmail === -1) {
        setError("Cabeçalho inválido. Use o modelo: nome;email;cargo;funcao");
        return;
      }

      const parsedRows: BatchUserRow[] = dataRows.map(r => {
        const nome = (r[idxNome] || "").trim();
        const email = (r[idxEmail] || "").trim();
        const cargo = (idxCargo >= 0 ? (r[idxCargo] || "").trim() : "") || "Analista Fiscal Sênior";
        const funcao = idxFuncao >= 0 ? normalizeFuncao(r[idxFuncao] || "") : defaultRole;
        return { nome, email, cargo, funcao, error: !nome || !email ? "Nome e e-mail obrigatórios" : undefined };
      });

      setRows(parsedRows);
      setParsed(true);
    };
    reader.readAsText(file);
  };

  const copyAllPasswords = () => {
    if (!resultModal) return;
    const text = resultModal.users.map(u => `${u.name} (${u.email}): ${u.password}`).join("\n");
    navigator.clipboard.writeText(text);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const handleImport = async () => {
    if (rows.length === 0) return;
    setImporting(true);
    setError(null);

    const created: { name: string; email: string; password: string }[] = [];
    let skipped = 0;
    const modules = (defaultModules && defaultModules.length > 0) ? defaultModules : FALLBACK_MODULES;

    for (const row of rows) {
      if (row.error) { skipped++; continue; }
      try {
        const tempPass = generateTemporaryPassword();
        const hashedPass = await hashPassword(tempPass);
        saveEmployee({
          companyId,
          companyName: companyName || companyId,
          name: row.nome,
          email: row.email,
          department: row.cargo,
          role: row.funcao,
          allowedModules: modules,
          status: 'Primeiro acesso pendente',
          passwordHash: hashedPass,
          mustChangePassword: true,
        } as any);
        created.push({ name: row.nome, email: row.email, password: tempPass });
      } catch {
        skipped++;
      }
    }

    setImporting(false);
    setResultModal({ total: rows.length, users: created, skipped });
    setRows([]);
    setParsed(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    onCreated?.();
  };

  return (
    <>
      {/* Link minimalista "Cadastro em lote" */}
      <button
        type="button"
        onClick={() => { setOpen(true); setRows([]); setParsed(false); setError(null); }}
        className="text-[10px] font-bold text-primary hover:underline flex items-center gap-1 shrink-0"
        title="Cadastrar até 10 colaboradores de uma vez via planilha CSV"
      >
        <Upload className="w-3 h-3" />
        <span>Cadastro em lote</span>
      </button>

      {/* Modal Upload CSV */}
      {open && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                <div>
                  <h3 className="text-base font-bold text-slate-900">Cadastro em Lote de Colaboradores</h3>
                  <p className="text-[11px] text-slate-400">Até {MAX_BATCH} usuários por lote · empresa: {companyName || companyId}</p>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-600 leading-relaxed">
              <p className="font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                <FileDown className="w-3.5 h-3.5 text-primary" />
                Formato da planilha (CSV):
              </p>
              <p className="font-mono text-[10px] text-slate-500 bg-white border border-slate-200 rounded p-2">
                nome;email;cargo;funcao
              </p>
              <p className="font-mono text-[10px] text-slate-500 bg-white border border-slate-200 rounded p-2 mt-1">
                Mariana Castro;mariana@empresa.com.br;Analista Fiscal Sênior;funcionario
              </p>
              <p className="text-[10px] text-slate-400 mt-1.5">
                Coluna <strong>funcao</strong>: <strong>gestor</strong> ou <strong>funcionario</strong>. Cargo opcional (usa o padrão quando vazio).
              </p>
              <div className="mt-2 pt-2 border-t border-slate-200">
                <p className="font-bold text-slate-700 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-primary" />
                  Módulos que serão aplicados:
                </p>
                <p className="text-[10px] text-slate-500 mt-1">
                  {defaultModules && defaultModules.length > 0
                    ? defaultModules.map(id => id.toUpperCase()).join(" · ")
                    : FALLBACK_MODULES.map(id => id.toUpperCase()).join(" · ")}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">Ajuste depois em Usuários & Equipe, se necessário.</p>
              </div>
            </div>

            <button
              type="button"
              onClick={downloadTemplate}
              className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-colors shadow-xs"
            >
              <FileDown className="w-4 h-4" />
              Baixar Modelo CSV para Preencher
            </button>

            <div className="border-2 border-dashed border-slate-300 rounded-lg p-5 text-center cursor-pointer hover:border-primary transition-colors bg-slate-50/60"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files?.[0];
                if (file) handleFile(file);
              }}
            >
              <Upload className="w-6 h-6 text-slate-400 mx-auto mb-1.5" />
              <p className="text-xs font-bold text-slate-700">Clique ou arraste o arquivo CSV</p>
              <p className="text-[10px] text-slate-400 mt-0.5">máximo {MAX_BATCH} linhas · colunas: nome;email;cargo;funcao</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                }}
              />
            </div>

            {error && (
              <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-[11px] font-semibold rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {parsed && rows.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    {rows.length} colaborador(es) identificado(s) no arquivo:
                  </p>
                </div>
                <div className="max-h-[160px] overflow-y-auto space-y-1 pr-1">
                  {rows.map((r, i) => (
                    <div key={i} className={`flex items-center justify-between p-2 rounded-lg border text-[11px] ${r.error ? "border-red-200 bg-red-50/60 text-red-600" : "border-slate-200 bg-slate-50 text-slate-700"}`}>
                      <span className="font-semibold truncate">{r.nome} <span className="text-slate-400 font-normal">({r.email})</span></span>
                      <span className="flex items-center gap-1.5 shrink-0">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${r.funcao === "gestor" ? "bg-primary/10 text-primary" : "bg-slate-200 text-slate-600"}`}>
                          {r.funcao === "gestor" ? "GESTOR" : "FUNCIONÁRIO"}
                        </span>
                        {r.error && <AlertCircle className="w-3.5 h-3.5 text-red-500" />}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleImport}
                disabled={!parsed || rows.length === 0 || importing}
                className="px-4 py-2 bg-primary hover:opacity-90 text-white text-xs font-bold rounded-lg flex items-center gap-2 transition-all shadow-xs disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {importing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Users className="w-3.5 h-3.5" />}
                <span>{importing ? "Cadastrando..." : `Cadastrar ${rows.length} Usuário(s)`}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Resultado com Senhas Temporárias */}
      {resultModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-amber-600" />
                <h3 className="text-base font-bold text-slate-900">Senhas Temporárias Geradas</h3>
              </div>
              <button onClick={() => setResultModal(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 font-medium">
              <p>
                <strong>{resultModal.users.length} colaborador(es) cadastrado(s)</strong>
                {resultModal.skipped > 0 && <span> · {resultModal.skipped} ignorado(s) por erro</span>}.
              </p>
              <p className="text-[11px] text-amber-700 mt-1">Cada colaborador deverá trocar a senha obrigatoriamente no primeiro acesso.</p>
            </div>

            <div className="max-h-[220px] overflow-y-auto space-y-1.5 pr-1">
              {resultModal.users.map((u, i) => (
                <div key={i} className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                  <p className="text-[11px] font-bold text-slate-800">{u.name} <span className="text-slate-400 font-normal">({u.email})</span></p>
                  <p className="font-mono text-sm font-bold text-slate-900 tracking-wider mt-0.5">{u.password}</p>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={copyAllPasswords}
                className="px-4 py-2 bg-primary hover:bg-primary/90 text-white text-xs font-bold rounded-lg flex items-center gap-2 transition-colors shadow-xs"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{copySuccess ? "Copiado!" : "Copiar Todas as Senhas"}</span>
              </button>
              <button
                type="button"
                onClick={() => setResultModal(null)}
                className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-lg hover:bg-slate-800 transition-colors"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
