"use client";

import { useState, useEffect } from "react";
import { FileText, Download, Sparkles, RefreshCw, Eye, Coins, Copy, CheckCircle2 } from "lucide-react";
import { deductCoins } from "@/lib/coins/store";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

function cleanDocumentText(rawText: string): string {
  if (!rawText) return "";
  let text = rawText.replace(/\[.*?\]/g, '').trim();

  // Strip conversational preambles (e.g. "Boa noite!", "Com base nas...", "Elaborei...")
  const titleKeywords = ["PROPOSTA", "CONTRATO", "MINUTA", "NOTIFICAÇÃO", "PARECER", "PROCURAÇÃO", "DECLARAÇÃO", "INSTRUMENTO", "TERMO"];
  const lines = text.split("\n");
  let startIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    const trimmedUpper = lines[i].trim().toUpperCase();
    if (titleKeywords.some(keyword => trimmedUpper.includes(keyword))) {
      startIndex = i;
      break;
    }
  }

  if (startIndex > 0) {
    text = lines.slice(startIndex).join("\n").trim();
  }

  // Strip conversational postambles if any
  const endKeywords = ["espero ter ajudado", "qualquer dúvida", "estou à disposição", "atenciosamente, equipe"];
  const endLines = text.split("\n");
  let endIndex = endLines.length;
  for (let i = endLines.length - 1; i >= 0; i--) {
    const lineLower = endLines[i].toLowerCase();
    if (endKeywords.some(kw => lineLower.includes(kw))) {
      endIndex = i;
    }
  }

  return endLines.slice(0, endIndex).join("\n").trim();
}

export default function DocumentosPage() {
  const [template, setTemplate] = useState("contrato");
  const [clientName, setClientName] = useState("Posto Shell Alvorada Ltda");
  const [cnpj, setCnpj] = useState("12.345.678/0001-90");
  const [value, setValue] = useState("4.500,00");
  const [serviceDesc, setServiceDesc] = useState("Prestação de Serviços de BPO Financeiro e Escrituração Fiscal Contábil");
  const [isGenerating, setIsGenerating] = useState(false);
  const [docContent, setDocContent] = useState("");
  const [copiedNotice, setCopiedNotice] = useState(false);
  const [showNoCoinsModal, setShowNoCoinsModal] = useState(false);

  // History state for last 4 generated documents
  const [history, setHistory] = useState<{ id: string; title: string; date: string; content: string }[]>([]);

  const handleGenerateDoc = async () => {
    // Deduct 30 OmniCoins
    const success = deductCoins(30, "Geração Documento PDF A4");
    if (!success) {
      setShowNoCoinsModal(true);
      return;
    }

    setIsGenerating(true);

    try {
      // Call Edge proxy LLM to draft specialized legal text
      const prompt = `GERAÇÃO EXCLUSIVA DE MINUTA DE DOCUMENTO OFICIAL:
Redija o texto integral e formal do seguinte documento: ${template === 'contrato' ? 'Contrato de Prestação de Serviços Contábeis' : template === 'proposta' ? 'Proposta Comercial de BPO Financeiro' : template === 'notificacao' ? 'Parecer Tributário / Notificação Fiscal' : 'Procuração Eletrônica e-CAC'}.

DADOS DO DOCUMENTO:
- Cliente / Contratante: ${clientName} (CNPJ: ${cnpj})
- Valor dos Honorários: R$ ${value}
- Escopo dos Serviços: ${serviceDesc}
- Contratada: ZENITUS INTELIGÊNCIA CONTÁBIL LTDA (CNPJ 42.189.902/0001-55)
- Cidade: Salvador/BA. Data: ${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}.

REGRAS ABSOLUTAS E OBRIGATÓRIAS DE SAÍDA:
1. COMEÇO DIRETO: Inicie IMEDIATAMENTE pelo título oficial em caixa alta (ex: "PROPOSTA COMERCIAL..." ou "CONTRATO DE PRESTAÇÃO...").
2. PROIBIÇÃO TOTAL DE COMENTÁRIOS: É ESTRITAMENTE PROIBIDO incluir qualquer saudação ("Boa noite", "Bom dia", "Olá"), introdução ("Com base nas diretrizes", "Elaborei a proposta"), nota de cabeçalho ou comentário explicativo.
3. SAÍDA EXCLUSIVA: O texto retornado deve conter ÚNICA E EXCLUSIVAMENTE o conteúdo oficial da minuta jurídica.`;

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: prompt }],
          model: "google/gemini-2.5-pro",
          personaPrompt: "Você é um gerador autônomo de minutas jurídicas. Sua saída deve conter ESTRITAMENTE o texto do documento oficial, sem qualquer saudação, introdução, comentário conversacional ou nota inicial.",
        }),
      });

      if (res.ok) {
        const text = await res.text();
        setDocContent(cleanDocumentText(text));
      } else {
        throw new Error("Fallback para gerador interno");
      }
    } catch (err) {
      console.error(err);
      // Fallback legal document generation
      setDocContent(`CONTRATO DE PRESTAÇÃO DE SERVIÇOS CONTÁBEIS E BPO FINANCEIRO

Pelo presente instrumento particular, de um lado:

CONTRATADA: ZENITUS INTELIGÊNCIA CONTÁBIL LTDA, inscrita no CNPJ/MF sob o nº 42.189.902/0001-55, com sede na Cidade de Salvador/BA.

CONTRATANTE: ${clientName.toUpperCase()}, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº ${cnpj}.

CLÁUSULA PRIMEIRA — DO OBJETO
O presente contrato tem por objeto a prestação dos serviços de ${serviceDesc}, compreendendo a apuração de tributos, elaboração de folhas de pagamento e entrega das obrigações acessórias ao fisco.

CLÁUSULA SEGUNDA — DOS HONORÁRIOS E CONDIÇÕES DE PAGAMENTO
Pela prestação dos serviços acordados, a CONTRATANTE pagará à CONTRATADA o valor mensal fixo de R$ ${value}, com vencimento no dia 10 de cada mês subsequente.

CLÁUSULA TERCEIRA — DAS OBRIGAÇÕES DA CONTRATADA
A CONTRATADA compromete-se a executar a escrituração contábil e fiscal de acordo com as normas emanadas do Conselho Federal de Contabilidade (CFC) e a legislação tributária brasileira.

CLÁUSULA QUARTA — DO FORO
Fica eleito o Foro da Comarca de Salvador/BA para dirimir quaisquer dúvidas oriundas do presente contrato.

Salvador, ${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}.

_____________________________________________
ZENITUS INTELIGÊNCIA CONTÁBIL LTDA

_____________________________________________
${clientName.toUpperCase()}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // Add to history after generating
  useEffect(() => {
    if (docContent && !isGenerating) {
      // Check if it's already in history (prevent duplicate on initial render)
      setHistory(prev => {
        if (prev.some(p => p.content === docContent)) return prev;
        
        let prefix = "Documento";
        if (template === "contrato") prefix = "Contrato de Prestação";
        if (template === "proposta") prefix = "Proposta Comercial";
        if (template === "notificacao") prefix = "Notificação Fiscal";
        if (template === "procuracao") prefix = "Procuração e-CAC";

        const newItem = {
          id: Math.random().toString(36).substring(7),
          title: `${prefix} - ${clientName}`,
          date: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          content: docContent
        };
        return [newItem, ...prev].slice(0, 4);
      });
    }
  }, [docContent, isGenerating, template, clientName]);

  const handleDownloadPDF = () => {
    window.print();
  };

  const handleCopyText = () => {
    if (!docContent) return;
    navigator.clipboard.writeText(docContent);
    setCopiedNotice(true);
    setTimeout(() => setCopiedNotice(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Insufficient Coins ConfirmModal */}
      <ConfirmModal
        isOpen={showNoCoinsModal}
        onClose={() => setShowNoCoinsModal(false)}
        onConfirm={() => window.location.href = '/financeiro'}
        title="Saldo Insuficiente de OmniCoins"
        description="Você não possui saldo suficiente de OmniCoins para gerar uma minuta de documento A4. Acesse o módulo Financeiro para efetuar a recarga."
        confirmText="Ir para Recarga"
        cancelText="Entendi"
        variant="warning"
      />

      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-5 lg:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-slate-900 tracking-tight">
            Gerador de Documentos Corporativos
          </h1>
          <p className="text-xs lg:text-sm text-slate-500 mt-1">
            Criação de contratos, propostas e notificações fiscais em formato folha A4 com exportação PDF
          </p>
        </div>
        {docContent && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyText}
              className="px-3.5 py-2 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-2 transition-all shadow-xs"
            >
              <Copy className="w-4 h-4 text-slate-500" />
              <span>{copiedNotice ? "Copiado!" : "Copiar Texto"}</span>
            </button>
            <button
              onClick={handleDownloadPDF}
              className="px-4 py-2 bg-primary hover:opacity-90 text-white text-xs font-semibold rounded-lg flex items-center gap-2 transition-all shadow-xs"
            >
              <Download className="w-4 h-4" />
              <span>Baixar PDF (A4)</span>
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Input Form */}
        <div className="lg:col-span-5 bg-white p-5 lg:p-6 rounded-xl border border-slate-200/80 space-y-5 shadow-xs">
          <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            <span>Parâmetros do Documento</span>
          </h2>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-2">Modelo de Documento:</label>
            <select
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:border-primary transition-all cursor-pointer"
            >
              <option value="contrato">Contrato de Prestação de Serviços Contábeis</option>
              <option value="proposta">Proposta Comercial de BPO Financeiro</option>
              <option value="notificacao">Notificação Fiscal / Parecer Tributário</option>
              <option value="procuracao">Procuração Eletrônica e-CAC / Receita</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-2">Nome / Razão Social do Cliente:</label>
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:border-primary transition-all"
            />
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-2">CNPJ:</label>
            <input
              type="text"
              value={cnpj}
              onChange={(e) => setCnpj(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:border-primary transition-all"
            />
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-2">Valor dos Honorários (R$):</label>
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:border-primary transition-all"
            />
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-2">Descrição do Escopo de Serviços:</label>
            <textarea
              rows={3}
              value={serviceDesc}
              onChange={(e) => setServiceDesc(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-primary transition-all"
            />
          </div>

          <button
            onClick={handleGenerateDoc}
            disabled={isGenerating}
            className="w-full py-2.5 bg-primary hover:opacity-90 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-all shadow-xs disabled:opacity-50"
          >
            {isGenerating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            <span>{isGenerating ? "Redigindo Minuta com IA..." : "Gerar Documento com IA"}</span>
          </button>
        </div>

        {/* Right A4 Preview Sheet Pane */}
        <div className="lg:col-span-7 flex flex-col items-center">
          {docContent ? (
            <div className="print-only-panel w-full max-w-[595px] min-h-[842px] bg-white border border-slate-200/80 shadow-md p-12 text-slate-900 font-serif text-sm leading-relaxed whitespace-pre-wrap rounded-sm print:m-0 print:border-none print:shadow-none">
              {docContent}
            </div>
          ) : (
            <div className="w-full max-w-[595px] h-[500px] bg-white border border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center text-center p-8 text-slate-400">
              <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mb-4">
                <Eye className="w-6 h-6 text-slate-300" />
              </div>
              <h3 className="font-bold text-sm text-slate-900">Pré-visualização do Documento A4</h3>
              <p className="text-xs mt-1.5 max-w-xs text-slate-500 leading-relaxed">Preencha os campos ao lado e clique em "Gerar Documento com IA" para visualizar a minuta formatada em papel A4.</p>
            </div>
          )}

          {/* History Widget */}
          {history.length > 0 && (
            <div className="w-full max-w-[595px] mt-6 bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs">
              <h3 className="text-xs font-bold text-slate-900 mb-3 uppercase tracking-wider">Últimos Documentos Gerados (IA)</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {history.map(item => (
                  <div key={item.id} className="relative group flex flex-col p-2.5 bg-slate-50 border border-slate-200 hover:border-primary/50 rounded-lg cursor-pointer transition-colors" onClick={() => setDocContent(item.content)}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        <FileText className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span className="text-[11px] font-semibold text-slate-900 truncate">{item.title}</span>
                      </div>
                      <span className="text-[9px] font-medium text-slate-400 shrink-0">{item.date}</span>
                    </div>
                    
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setHistory(prev => prev.filter(h => h.id !== item.id));
                        if (docContent === item.content) setDocContent("");
                      }}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-400 opacity-0 group-hover:opacity-100 hover:text-red-600 hover:border-red-200 transition-all shadow-sm"
                      title="Excluir documento"
                    >
                      <span className="text-xs leading-none font-bold">×</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
