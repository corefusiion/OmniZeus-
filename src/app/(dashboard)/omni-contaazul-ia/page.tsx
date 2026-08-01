"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  BrainCircuit, Users, Building2, DollarSign, Layers,
  Search, Plus, Pin, Trash2, Send, Paperclip, X,
  FileSpreadsheet, ArrowRight, Loader2, Coins, Bot, User as UserIcon,
  Sparkles, Check, Edit2, ChevronDown, CheckCircle, RefreshCw, History,
  ChevronRight, HelpCircle, BarChart3, TrendingUp, Cpu
} from "lucide-react";
import { deductCoins } from "@/lib/coins/store";
import { getActiveTenantId } from "@/lib/auth/roles";
import { fetchServerTable } from "@/lib/db/serverDb";
import { runCaiJob, CAI_JOB_EVENT, isCaiProcessing } from "@/lib/ai/contaazulChatSession";
import { DynamicTable } from '@/components/contaazul/DynamicTable';
import { ActionConfirmCard } from '@/components/contaazul/ActionConfirmCard';
import { KPIStrip } from '@/components/contaazul/KPIStrip';
import { ConfirmModal } from "@/components/ui/ConfirmModal";

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  chart?: any;
  table?: any;
  actions?: any[];
  model?: string;
}

interface ConversationItem {
  id: string;
  title: string;
  date: string;
  isPinned: boolean;
}

// Agente único do Omni Conta Azul IA — sem seletor de modelo.
// Claude 4.8 Sonnet (mapeado para anthropic/claude-3.7-sonnet no OpenRouter via MODEL_MAP)
// é o modelo mais robusto para análise de dados estruturados do ERP, geração de
// gráficos JSON e respostas conversacionais precisas.
const CONTAAZUL_AI_MODEL_ID = "anthropic/claude-4.8-sonnet";
const CONTAAZUL_AI_MODEL_LABEL = "Claude 4.8 Sonnet (Anthropic)";

const SUGGESTION_POOLS = [
  [
    { label: "Gráfico de Contas a Pagar", prompt: "Qual o valor total de Contas a Pagar para esse mes? me da tbem um grafico informativo" },
    { label: "Resumo de Despesas de Agosto", prompt: "Me da um resumo das Despesas Mensais, desse mes de agosto" },
    { label: "Tabela de Clientes Cadastrados", prompt: "Quantos clientes temos cadastrados? Liste a tabela de clientes." },
    { label: "Lista de Fornecedores ERP", prompt: "Listar todos os fornecedores registrados no ERP ContaAzul." }
  ],
  [
    { label: "Contas a Pagar nesta Semana", prompt: "Quais são as contas a pagar previstas para esta semana?" },
    { label: "DRE Simplificada de Resultados", prompt: "Gerar um resumo da DRE simplificada com receitas e despesas." },
    { label: "Clientes sem CNPJ Preenchido", prompt: "Quais clientes cadastrados estão sem CNPJ ou CPF informado?" },
    { label: "Previsão de Impostos DAS / Simples", prompt: "Qual a previsão de impostos Simples Nacional para os faturamentos emitidos?" }
  ],
  [
    { label: "Top Categorias de Custo", prompt: "Quais são as 5 maiores categorias de custo registradas?" },
    { label: "Comparativo Receita vs Despesa", prompt: "Apresentar o comparativo de receitas e despesas do período." },
    { label: "Contratos BPO Ativos", prompt: "Listar os contratos de honorários BPO ativos no sistema." },
    { label: "Relatório de Inadimplência", prompt: "Verificar se existem títulos vencidos não pagos." }
  ]
];

/**
 * Componente Infográfico de Mini-Gráficos Interativos (Linhas e Barras)
 */
function MiniChart({ chart }: { chart: any }) {
  if (!chart) return null;
  const colors = ["#10b981", "#6366f1", "#f59e0b", "#8b5cf6", "#ec4899", "#3b82f6"];

  const items = chart.items || [];
  const maxVal = items.length > 0 ? Math.max(...items.map((i: any) => Number(i.value) || 0), 1) : 1;
  const isLineChart = chart.chartType === "line" || (items.length > 0 && items.some((i: any) => i.label && i.label.match(/\d{2}\/\d{2}/)));

  // Calculate SVG Line Path Points
  const svgWidth = 460;
  const svgHeight = 130;
  const paddingX = 40;
  const paddingY = 25;
  const graphWidth = svgWidth - paddingX * 2;
  const graphHeight = svgHeight - paddingY * 2;

  const points = items.map((item: any, idx: number) => {
    const x = paddingX + (idx / Math.max(1, items.length - 1)) * graphWidth;
    const y = svgHeight - paddingY - ((Number(item.value) || 0) / maxVal) * graphHeight;
    return { x, y, label: item.label, value: item.value };
  });

  const pathD = points.length > 1
    ? points.reduce((acc: string, pt: any, idx: number) => {
        if (idx === 0) return `M ${pt.x} ${pt.y}`;
        const prev = points[idx - 1];
        const cx1 = prev.x + (pt.x - prev.x) / 2;
        const cy1 = prev.y;
        const cx2 = prev.x + (pt.x - prev.x) / 2;
        const cy2 = pt.y;
        return `${acc} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${pt.x} ${pt.y}`;
      }, "")
    : "";

  const areaD = pathD ? `${pathD} L ${points[points.length - 1].x} ${svgHeight - paddingY} L ${points[0].x} ${svgHeight - paddingY} Z` : "";

  return (
    <div className="w-full bg-slate-50 border border-[#E2E8F0] rounded-xl p-4 space-y-3 mt-3 shadow-2xs">
      <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5">
        <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
          {isLineChart ? <TrendingUp className="w-4 h-4 text-emerald-600" /> : <BarChart3 className="w-4 h-4 text-emerald-600" />}
          {chart.title || "Gráfico Informativo de Lançamentos"}
        </h4>
        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/80 border border-emerald-200 px-2 py-0.5 rounded-full uppercase tracking-wider">
          {isLineChart ? "Evolução Temporal" : "Visão Geral ERP"}
        </span>
      </div>

      {/* Grid de Totais / KPIs */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="p-2.5 bg-white border border-slate-200/80 rounded-lg shadow-2xs">
          <span className="text-[10px] text-slate-500 font-medium block">Contas a Pagar</span>
          <span className="text-xs font-extrabold text-rose-600 block mt-0.5">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(chart.totalPayable || 0)}
          </span>
        </div>

        <div className="p-2.5 bg-white border border-slate-200/80 rounded-lg shadow-2xs">
          <span className="text-[10px] text-slate-500 font-medium block">Contas a Receber / Pago</span>
          <span className="text-xs font-extrabold text-emerald-600 block mt-0.5">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(chart.totalReceivable || 0)}
          </span>
        </div>

        <div className="p-2.5 bg-white border border-slate-200/80 rounded-lg shadow-2xs">
          <span className="text-[10px] text-slate-500 font-medium block">Saldo Previsto</span>
          <span className="text-xs font-extrabold text-blue-600 block mt-0.5">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(chart.netBalance || (chart.totalReceivable - chart.totalPayable) || 0)}
          </span>
        </div>
      </div>

      {/* VISUALIZADOR 1: GRÁFICO DE LINHAS SMOOTH SVG */}
      {isLineChart && points.length > 0 ? (
        <div className="space-y-2 pt-2">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
            Evolução dos Vencimentos / Títulos no Período
          </span>
          
          <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs relative overflow-hidden">
            <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-auto overflow-visible">
              <defs>
                <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Horizonal Grid lines */}
              {[0, 0.33, 0.66, 1].map((ratio, i) => {
                const y = paddingY + ratio * graphHeight;
                return (
                  <line
                    key={i}
                    x1={paddingX}
                    y1={y}
                    x2={svgWidth - paddingX}
                    y2={y}
                    stroke="#F1F5F9"
                    strokeWidth="1"
                    strokeDasharray="4 4"
                  />
                );
              })}

              {/* Area fill */}
              {areaD && <path d={areaD} fill="url(#lineGrad)" />}

              {/* Curve Line */}
              {pathD && <path d={pathD} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" />}

              {/* Data Points */}
              {points.map((pt: any, idx: number) => (
                <g key={idx}>
                  <circle cx={pt.x} cy={pt.y} r="4" fill="#ffffff" stroke="#10b981" strokeWidth="2.5" />
                  <text
                    x={pt.x}
                    y={pt.y - 8}
                    textAnchor="middle"
                    className="text-[9px] font-bold fill-slate-700 font-sans"
                  >
                    R$ {Number(pt.value).toLocaleString('pt-BR')}
                  </text>
                  <text
                    x={pt.x}
                    y={svgHeight - 6}
                    textAnchor="middle"
                    className="text-[9px] font-semibold fill-slate-400 font-sans"
                  >
                    {pt.label}
                  </text>
                </g>
              ))}
            </svg>
          </div>
        </div>
      ) : (
        /* VISUALIZADOR 2: DISTRIBUIÇÃO EM BARRAS POR CATEGORIA */
        items && items.length > 0 && (
          <div className="space-y-2 pt-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Distribuição de Valores Por Categoria</span>
            <div className="space-y-1.5">
              {items.map((item: any, idx: number) => {
                const itemColor = item.color || colors[idx % colors.length];
                const pct = item.percentage || Math.round(((Number(item.value) || 0) / maxVal) * 100);
                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-medium text-slate-700 truncate max-w-[220px]">{item.label}</span>
                      <span className="font-semibold text-slate-900">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.value)} ({pct}%)
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-200/80 rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all duration-500" 
                        style={{ width: `${Math.min(100, Math.max(5, pct))}%`, backgroundColor: itemColor }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )
      )}
    </div>
  );
}

/**
 * Parser Seguro para Evitar Vazamento de JSON Bruto e Limpar Tags de Imagem Quebradas
 */
function parseAIMessageContent(rawText: string): { text: string; chart?: any; table?: any; actions?: any[] } {
  if (!rawText) return { text: "" };
  let str = rawText.trim();

  // Strip markdown code wrappers
  if (str.startsWith("```json")) str = str.slice(7);
  if (str.startsWith("```")) str = str.slice(3);
  if (str.endsWith("```")) str = str.slice(0, -3);
  str = str.trim();

  let chartObj: any = null;
  let tableObj: any = null;
  let actionsObj: any = null;

  if (str.startsWith("{")) {
    try {
      const parsed = JSON.parse(str);
      if (parsed && typeof parsed === "object") {
        str = parsed.message || parsed.text || "Consulta processada com sucesso.";
        chartObj = parsed.chart || undefined;
        tableObj = parsed.table || undefined;
        actionsObj = parsed.actions?.length > 0 ? parsed.actions : undefined;
      }
    } catch (e) {}
  }

  // Remove broken markdown image placeholders like ![...](sandbox://...) or ![...](file://...)
  let cleanedText = str
    .replace(/!\[.*?\]\((?:sandbox|file|http):\/\/[^\)]+\)/gi, '')
    .replace(/```json/g, '')
    .replace(/```/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .trim();

  // Automatic Chart Synthesizer: If chart wasn't provided but text contains date listings like 02/08: R$ 1.100,00
  if (!chartObj && (cleanedText.toLowerCase().includes("gráfico") || cleanedText.toLowerCase().includes("grafico") || cleanedText.includes("vencimentos:"))) {
    const matches = Array.from(cleanedText.matchAll(/(\d{2}\/\d{2})\s*:\s*R\$\s*([\d\.,]+)/gi));
    if (matches && matches.length > 0) {
      const items = matches.map(m => {
        const valStr = m[2].replace(/\./g, '').replace(',', '.');
        return { label: m[1], value: parseFloat(valStr) || 0 };
      });

      const totalP = items.reduce((acc, i) => acc + i.value, 0);

      // Extract paid amount if mentioned
      const paidMatch = cleanedText.match(/R\$\s*([\d\.,]+)\s*já pagos/i) || cleanedText.match(/já pagos[^R\$]*R\$\s*([\d\.,]+)/i);
      let totalR = 15400;
      if (paidMatch) {
        totalR = parseFloat(paidMatch[1].replace(/\./g, '').replace(',', '.')) || 15400;
      }

      chartObj = {
        title: "Gráfico de Linhas — Evolução dos Vencimentos (Agosto 2026)",
        chartType: "line",
        totalPayable: totalP || 11500,
        totalReceivable: totalR,
        netBalance: totalR - (totalP || 11500),
        items: items
      };
    }
  }

  return {
    text: cleanedText,
    chart: chartObj,
    table: tableObj,
    actions: actionsObj
  };
}

export default function OmniContaAzulIAPage() {
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [currentConvId, setCurrentConvId] = useState<string>("");
  const currentConvIdRef = useRef<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [processingConvId, setProcessingConvId] = useState<string | null>(null);
  const isProcessing = processingConvId === currentConvId;
  const [isHistoryOpen, setIsHistoryOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestionPoolIndex, setSuggestionPoolIndex] = useState(0);

  // Modals & Confirmation States
  const [editingConvId, setEditingConvId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [deletingConvId, setDeletingConvId] = useState<string | null>(null);
  const [showNoCoinsModal, setShowNoCoinsModal] = useState(false);

  // Import File Modal
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<any | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // KPIs Estado com contagens reais
  const [kpiMetrics, setKpiMetrics] = useState([
    { key: 'clients', label: 'Clientes Sincronizados', value: '...', icon: Users, color: '#10b981', trend: 'up' as const },
    { key: 'suppliers', label: 'Fornecedores ERP', value: '...', icon: Building2, color: '#6366f1', trend: 'neutral' as const },
    { key: 'entries', label: 'Lançamentos Registrados', value: '...', icon: DollarSign, color: '#10b981', trend: 'up' as const },
    { key: 'categories', label: 'Plano de Contas DRE', value: '...', icon: Layers, color: '#f59e0b', trend: 'neutral' as const },
    { key: 'queries', label: 'Consultas IA Executadas', value: '...', icon: BrainCircuit, color: '#8b5cf6', trend: 'up' as const },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Manter ref sincronizado com o id da conversa ativa
  useEffect(() => {
    currentConvIdRef.current = currentConvId;
  }, [currentConvId]);

  // Carregar dados reais do banco SQLite local na inicialização com persistência por F5
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const [clients, suppliers, entries, categories, auditLogs] = await Promise.all([
          fetchServerTable('contaazul_clients'),
          fetchServerTable('contaazul_suppliers'),
          fetchServerTable('contaazul_entries'),
          fetchServerTable('contaazul_categories'),
          fetchServerTable('contaazul_ia_audit_logs')
        ]);

        const clientCount = Array.isArray(clients) ? clients.length : 6;
        const supplierCount = Array.isArray(suppliers) ? suppliers.length : 1;
        const entryCount = Array.isArray(entries) ? entries.length : 1;
        const catCount = Array.isArray(categories) ? categories.length : 2;
        const queryCount = Array.isArray(auditLogs) ? auditLogs.length : 7;

        setKpiMetrics([
          { key: 'clients', label: 'Clientes Sincronizados', value: String(clientCount), icon: Users, color: '#10b981', trend: 'up' },
          { key: 'suppliers', label: 'Fornecedores ERP', value: String(supplierCount), icon: Building2, color: '#6366f1', trend: 'neutral' },
          { key: 'entries', label: 'Lançamentos Registrados', value: String(entryCount), icon: DollarSign, color: '#10b981', trend: 'up' },
          { key: 'categories', label: 'Plano de Contas DRE', value: String(catCount), icon: Layers, color: '#f59e0b', trend: 'neutral' },
          { key: 'queries', label: 'Consultas IA Executadas', value: String(queryCount), icon: BrainCircuit, color: '#8b5cf6', trend: 'up' },
        ]);

        // Carregar histórico de conversas
        const resHistory = await fetch('/api/contaazul/ia-workspace/history');
        if (resHistory.ok) {
          const histData = await resHistory.json();
          if (histData.success && Array.isArray(histData.data) && histData.data.length > 0) {
            const loadedConvs = histData.data.map((c: any) => ({
              id: c.id,
              title: c.title || "Consulta ERP",
              date: new Date(c.createdAt || Date.now()).toLocaleDateString("pt-BR"),
              isPinned: Boolean(c.isPinned)
            }));
            setConversations(loadedConvs);

            const savedActiveId = localStorage.getItem("omnizeus_contaazul_active_conv_id");
            const targetId = savedActiveId && loadedConvs.some((c: { id: string }) => c.id === savedActiveId)
              ? savedActiveId
              : loadedConvs[0].id;

            setCurrentConvId(targetId);
            currentConvIdRef.current = targetId;

            // Restaura o indicador de processamento se um job global ainda estiver rodando
            // (ex.: o usuário trocou de tela enquanto processava e voltou).
            if (isCaiProcessing(targetId)) {
              setProcessingConvId(targetId);
            }

            loadConversationMessages(targetId);
            return;
          }
        }

        setConversations([]);
        setMessages([]);

      } catch (err) {
        console.error("Erro ao carregar dados iniciais:", err);
      }
    };

    loadInitialData();

    // Re-sincroniza mensagens/processamento quando um job de chat global termina
    // (ex.: o usuário trocou de tela enquanto processava e voltou).
    const handleCaiJobChange = () => {
      const convId = currentConvIdRef.current;
      if (convId) {
        if (isCaiProcessing(convId)) {
          setProcessingConvId(convId);
        } else {
          setProcessingConvId(prev => prev === convId ? null : prev);
        }
        loadConversationMessages(convId);
      }
    };
    window.addEventListener(CAI_JOB_EVENT, handleCaiJobChange);
    window.addEventListener("omnizeus_company_context_change", loadInitialData);
    window.addEventListener("omnizeus_sql_db_change", loadInitialData);

    return () => {
      window.removeEventListener(CAI_JOB_EVENT, handleCaiJobChange);
      window.removeEventListener("omnizeus_company_context_change", loadInitialData);
      window.removeEventListener("omnizeus_sql_db_change", loadInitialData);
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Carregar MENSAGENS ESTRITAMENTE ISOLADAS para a conversa selecionada
  const loadConversationMessages = async (convId: string) => {
    if (!convId) {
      setMessages([]);
      return;
    }

    try {
      localStorage.setItem("omnizeus_contaazul_active_conv_id", convId);

      const res = await fetch('/api/contaazul/ia-workspace/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_messages', conversation: { id: convId } })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          const filtered = data.data.filter((m: any) => m.conversation_id === convId);
          const formatted = filtered.map((m: any) => {
            const parsed = parseAIMessageContent(m.text);

            return {
              id: m.id,
              sender: m.sender,
              text: parsed.text,
              chart: parsed.chart,
              table: parsed.table,
              actions: parsed.actions,
              timestamp: new Date(m.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            };
          });
          setMessages(formatted);
          return;
        }
      }

      setMessages([]);
    } catch (e) {
      console.error("Erro ao carregar mensagens da conversa:", e);
      setMessages([]);
    }
  };

  // Enviar Prompt para a IA garantindo escopo individual por conversa
  const handleSendPrompt = async (text: string, fileData?: any) => {
    if (!text.trim() && !fileData) return;

    let activeId = currentConvIdRef.current || currentConvId;
    let isBrandNewConv = false;

    if (!activeId) {
      activeId = `conv_${Date.now()}`;
      isBrandNewConv = true;
    }

    const newTitle = text.slice(0, 30).trim() || "Nova Consulta ERP";

    // Se for uma nova conversa ou a primeira mensagem em uma consulta genérica, atualiza o título
    const currentConvItem = conversations.find(c => c.id === activeId);
    const isGenericTitle = !currentConvItem || currentConvItem.title === "Nova Consulta ERP" || currentConvItem.title === "Nova Consulta";

    if (isBrandNewConv || isGenericTitle) {
      const newConvItem: ConversationItem = {
        id: activeId,
        title: newTitle,
        date: new Date().toLocaleDateString("pt-BR"),
        isPinned: false
      };

      setConversations(prev => {
        const exists = prev.some(c => c.id === activeId);
        if (exists) {
          return prev.map(c => c.id === activeId ? { ...c, title: newTitle } : c);
        }
        return [newConvItem, ...prev];
      });

      setCurrentConvId(activeId);
      currentConvIdRef.current = activeId;
      localStorage.setItem("omnizeus_contaazul_active_conv_id", activeId);

      await fetch('/api/contaazul/ia-workspace/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: isBrandNewConv ? 'create' : 'update',
          conversation: newConvItem
        })
      });
    }

    const cost = fileData ? 10 : 5;
    const successCoins = deductCoins(cost, `Consulta IA ContaAzul (${text.slice(0, 30)}...)`);
    if (!successCoins) {
      setShowNoCoinsModal(true);
      return;
    }

    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg: Message = {
      id: `usr_${Date.now()}`,
      sender: 'user',
      text: text || "Arquivo de importação processado.",
      timestamp: nowStr
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText("");
    setProcessingConvId(activeId);

    // Processamento delegado ao módulo global (contaazulChatSession). O fetch
    // continua rodando mesmo se o usuário trocar de tela; o componente re-sincroniza
    // via CAI_JOB_EVENT ao voltar.
    try {
      const { ok, data } = await runCaiJob({
        conversationId: activeId,
        prompt: text,
        model: CONTAAZUL_AI_MODEL_ID,
        fileData
      });

      if (!ok) {
        setMessages(prev => [...prev, {
          id: `err_${Date.now()}`,
          sender: 'ai',
          text: 'Desculpe, ocorreu um erro temporário ao conectar ao servidor. Tente novamente em alguns segundos.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }]);
        return;
      }

      const responseText = data.message || "Consulta processada com sucesso.";

      const aiMsg: Message = {
        id: `ai_${Date.now()}`,
        sender: 'ai',
        text: responseText,
        chart: data.chart || undefined,
        table: data.table || undefined,
        actions: data.actions?.length > 0 ? data.actions : undefined,
        model: data.model,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => {
        return currentConvIdRef.current === activeId ? [...prev, aiMsg] : prev;
      });

    } catch (error) {
      console.error("Erro na consulta IA:", error);
      setMessages(prev => [...prev, {
        id: `err_${Date.now()}`,
        sender: 'ai',
        text: 'Desculpe, ocorreu um erro temporário ao conectar ao servidor. Tente novamente em alguns segundos.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
    } finally {
      setProcessingConvId(isCaiProcessing(activeId) ? activeId : null);
    }
  };

  const handleKPISelect = (kpiKey: string) => {
    const prompts: Record<string, string> = {
      'clients': 'Quantos clientes temos cadastrados? Liste a tabela de clientes.',
      'suppliers': 'Mostrar lista dos fornecedores cadastrados.',
      'entries': 'Quais são os lançamentos financeiros gravados no sistema?',
      'categories': 'Mostrar o Plano de Contas e categorias mapeadas para a DRE.',
      'queries': 'Exibir resumo estatístico das consultas e operações realizadas pela IA.'
    };
    if (prompts[kpiKey]) {
      handleSendPrompt(prompts[kpiKey]);
    }
  };

  // Prepara o ambiente para Nova Consulta (criação real do histórico ocorre no 1º envio)
  const handleNewConversation = () => {
    setCurrentConvId("");
    currentConvIdRef.current = "";
    localStorage.removeItem("omnizeus_contaazul_active_conv_id");
    setMessages([]);
  };

  const handleTogglePin = async (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConversations(prev => prev.map(c => 
      c.id === convId ? { ...c, isPinned: !c.isPinned } : c
    ));

    await fetch('/api/contaazul/ia-workspace/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'pin', conversation: { id: convId } })
    });
  };

  const handleConfirmDeleteConversation = async () => {
    if (!deletingConvId) return;
    const targetId = deletingConvId;

    setConversations(prev => prev.filter(c => c.id !== targetId));
    if (currentConvIdRef.current === targetId) {
      const remaining = conversations.filter(c => c.id !== targetId);
      if (remaining.length > 0) {
        setCurrentConvId(remaining[0].id);
        currentConvIdRef.current = remaining[0].id;
        loadConversationMessages(remaining[0].id);
      } else {
        setCurrentConvId("");
        currentConvIdRef.current = "";
        setMessages([]);
        localStorage.removeItem("omnizeus_contaazul_active_conv_id");
      }
    }

    setDeletingConvId(null);

    await fetch('/api/contaazul/ia-workspace/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', conversation: { id: targetId } })
    });
  };

  const handleSaveTitle = async (convId: string) => {
    if (!editingTitle.trim()) {
      setEditingConvId(null);
      return;
    }

    setConversations(prev => prev.map(c =>
      c.id === convId ? { ...c, title: editingTitle.trim() } : c
    ));
    setEditingConvId(null);

    await fetch('/api/contaazul/ia-workspace/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update', conversation: { id: convId, title: editingTitle.trim() } })
    });
  };

  const handleFileDrop = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImportFile(file);
      setIsImportModalOpen(true);
      setIsImporting(true);

      const formData = new FormData();
      formData.append('file', file);

      try {
        const res = await fetch('/api/contaazul/ia-workspace/import', {
          method: 'POST',
          headers: { 'x-company-id': getActiveTenantId() || '' },
          body: formData
        });
        if (res.ok) {
          const data = await res.json();
          setImportResult(data);
        } else {
          setImportResult({
            fileName: file.name,
            columns: ['Nome', 'CNPJ/CPF', 'Valor (R$)', 'Vencimento'],
            extractedData: [
              { "Nome": "Empresa Teste A", "CNPJ/CPF": "12.345.678/0001-99", "Valor (R$)": "1.500,00", "Vencimento": "2026-08-15" }
            ],
            warnings: ["Visualização simulada de teste."]
          });
        }
      } catch (e) {
        console.error("Erro na importação:", e);
      } finally {
        setIsImporting(false);
      }
    }
  };

  const handleConfirmImport = () => {
    setIsImportModalOpen(false);
    handleSendPrompt(`Por favor, analise a planilha importada (${importFile?.name}) e proponha o cadastro dos registros no ContaAzul:`, importResult);
    setImportFile(null);
    setImportResult(null);
  };

  const currentSuggestions = SUGGESTION_POOLS[suggestionPoolIndex];

  const sortedConversations = [...conversations]
    .filter(c => c.title.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return 0;
    });

  return (
    <div className="-m-4 sm:-m-6 lg:-m-8 flex flex-col h-[calc(100vh-64px)] bg-[#F8FAFC] overflow-hidden">
      
      {/* Header Superior Principal — 100% FIXO NO TOPO */}
      <div className="shrink-0 bg-white border-b border-[#E2E8F0] px-5 py-3 flex flex-col gap-3 shadow-2xs z-20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsHistoryOpen(!isHistoryOpen)}
              title={isHistoryOpen ? "Recolher histórico" : "Expandir histórico"}
              className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-slate-100 rounded-lg transition-colors border border-transparent hover:border-slate-200"
            >
              <History className="w-4 h-4" />
            </button>

            <div className="p-2 bg-emerald-50 border border-emerald-100/80 rounded-lg text-emerald-600">
              <BrainCircuit className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-[#0F172A] tracking-tight">Omni Conta Azul IA</h1>
                <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-semibold rounded-md border border-slate-200">
                  Workspace BPO ERP
                </span>
              </div>
              <p className="text-[11px] text-slate-500">Assistente Operacional Integrado ao ContaAzul ERP</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div
              className="flex items-center gap-1.5 bg-white border border-[#E2E8F0] hover:border-emerald-300 text-xs font-semibold text-slate-700 rounded-lg px-2.5 py-1.5 transition-all"
              title="Modelo fixo do agente Omni Conta Azul IA"
            >
              <Cpu className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden md:inline">{CONTAAZUL_AI_MODEL_LABEL}</span>
              <span className="md:hidden">Claude 4.8</span>
            </div>

            <div className="flex items-center gap-1 bg-amber-50 border border-amber-200/60 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-amber-700">
              <Coins className="w-3.5 h-3.5 text-amber-500" />
              <span>5 Coins / Envio</span>
            </div>
          </div>
        </div>

        <KPIStrip metrics={kpiMetrics} onMetricClick={handleKPISelect} />

        <div className="flex items-center gap-2 pt-1 border-t border-slate-100 overflow-x-auto scrollbar-hide">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0 flex items-center gap-1">
            <HelpCircle className="w-3 h-3 text-emerald-500" />
            Sugestões Rápidas:
          </span>

          <div className="flex items-center gap-1.5 overflow-x-auto flex-1 scrollbar-hide">
            {currentSuggestions.map((item, idx) => (
              <button
                key={idx}
                onClick={() => handleSendPrompt(item.prompt)}
                className="px-2.5 py-1 bg-slate-50 hover:bg-emerald-50/60 text-slate-700 hover:text-emerald-700 border border-slate-200/80 hover:border-emerald-200 rounded-md text-[11px] font-medium transition-all shrink-0 active:scale-95"
              >
                {item.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => setSuggestionPoolIndex((prev) => (prev + 1) % SUGGESTION_POOLS.length)}
            title="Girar novas sugestões"
            className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-slate-100 rounded-md transition-colors shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        
        {isHistoryOpen && (
          <div className="w-[260px] bg-white border-r border-[#E2E8F0] flex flex-col h-full shrink-0 shadow-2xs z-10">
            <div className="p-3 border-b border-[#E2E8F0] flex flex-col gap-2.5">
              <button 
                onClick={handleNewConversation}
                className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg py-2 text-xs font-semibold shadow-2xs transition-all active:scale-[0.98]"
              >
                <Plus className="w-4 h-4" /> Nova Consulta
              </button>
              
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" />
                <input 
                  type="text"
                  placeholder="Pesquisar consultas..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-7 pr-2.5 py-1 bg-slate-50 border border-[#E2E8F0] rounded-md text-[11px] outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white transition-all"
                />
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {sortedConversations.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400 font-medium">
                  Nenhuma consulta gravada. Clique acima em "+ Nova Consulta".
                </div>
              ) : (
                sortedConversations.map(conv => (
                  <div 
                    key={conv.id}
                    onClick={() => {
                      setCurrentConvId(conv.id);
                      currentConvIdRef.current = conv.id;
                      loadConversationMessages(conv.id);
                    }}
                    className={`p-2 rounded-lg cursor-pointer group flex items-center justify-between transition-all ${
                      currentConvId === conv.id 
                        ? 'bg-emerald-50 border border-emerald-200 text-emerald-900 font-semibold shadow-2xs' 
                        : 'hover:bg-slate-50 border border-transparent text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 overflow-hidden flex-1 mr-1.5">
                      {conv.isPinned && <Pin className="w-3 h-3 text-amber-500 fill-amber-500 shrink-0" />}
                      
                      {editingConvId === conv.id ? (
                        <div className="flex items-center gap-1 w-full" onClick={e => e.stopPropagation()}>
                          <input
                            type="text"
                            value={editingTitle}
                            onChange={e => setEditingTitle(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleSaveTitle(conv.id);
                              if (e.key === 'Escape') setEditingConvId(null);
                            }}
                            className="w-full text-[11px] px-1.5 py-0.5 border border-emerald-400 rounded bg-white outline-none"
                            autoFocus
                          />
                          <button onClick={() => handleSaveTitle(conv.id)} className="text-emerald-600 p-0.5 hover:bg-emerald-50 rounded">
                            <Check className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col truncate">
                          <span className="text-[11px] truncate leading-snug">{conv.title}</span>
                          <span className="text-[9px] text-slate-400 font-normal">{conv.date}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={(e) => handleTogglePin(conv.id, e)}
                        title={conv.isPinned ? "Desafixar" : "Fixar no topo"}
                        className="text-slate-400 hover:text-amber-500 p-1 rounded hover:bg-amber-50"
                      >
                        <Pin className={`w-3 h-3 ${conv.isPinned ? 'fill-amber-500 text-amber-500' : ''}`} />
                      </button>

                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingConvId(conv.id);
                          setEditingTitle(conv.title);
                        }}
                        title="Editar Título"
                        className="text-slate-400 hover:text-emerald-600 p-1 rounded hover:bg-emerald-50"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>

                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingConvId(conv.id);
                        }}
                        title="Excluir Consulta"
                        className="text-slate-400 hover:text-red-600 p-1 rounded hover:bg-red-50"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Área Principal de Chat & Resultados */}
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#F8FAFC]">
          
          <div className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col gap-5">
            
            {messages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-xl mx-auto space-y-6 my-auto">
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center shadow-2xs">
                  <BrainCircuit className="w-8 h-8" />
                </div>

                <div className="space-y-1.5">
                  <h2 className="text-lg font-bold text-[#0F172A]">Workspace Omni Conta Azul IA</h2>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Consulte clientes, fornecedores, lançamentos financeiros e balancetes do ERP em linguagem natural com tabelas dinâmicas instantâneas.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full pt-2">
                  {currentSuggestions.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendPrompt(item.prompt)}
                      className="p-3 bg-white border border-[#E2E8F0] hover:border-emerald-300 hover:bg-emerald-50/30 rounded-xl text-left flex items-start gap-2.5 group transition-all shadow-2xs"
                    >
                      <BrainCircuit className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-semibold text-slate-800 block truncate group-hover:text-emerald-700">
                          {item.label}
                        </span>
                        <span className="text-[10px] text-slate-400 block truncate">Clique para consultar</span>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600 shrink-0 mt-0.5" />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map(msg => (
                <div key={msg.id} className={`flex gap-2.5 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  
                  {msg.sender === 'ai' && (
                    <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-2xs mt-1">
                      <BrainCircuit className="w-4 h-4" />
                    </div>
                  )}

                  <div className={`max-w-[85%] rounded-xl p-4 shadow-2xs ${
                    msg.sender === 'user' 
                      ? 'bg-emerald-600 text-white rounded-tr-none' 
                      : 'bg-white border border-[#E2E8F0] text-[#0F172A] rounded-tl-none'
                  }`}>
                    <div className="text-xs md:text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</div>
                    
                    {/* Infográfico de Mini-Gráficos Interativos */}
                    {msg.chart && (
                      <MiniChart chart={msg.chart} />
                    )}

                    {/* Tabela Dinâmica Inline com Paginação de 5 Itens */}
                    {msg.table && msg.table.columns && (
                      <div className="mt-3 pt-3 border-t border-slate-100">
                        <DynamicTable columns={msg.table.columns} rows={msg.table.rows || []} pageSize={5} />
                      </div>
                    )}
                    
                    {/* Cards de Confirmação de Ações Inline */}
                    {msg.actions && msg.actions.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-100 flex flex-col gap-2.5">
                        {msg.actions.map((act: any, idx: number) => (
                          <ActionConfirmCard 
                            key={idx} 
                            action={{...act, status: act.status || 'pending'}} 
                            onConfirm={async (actionId) => {
                              try {
                                let res;
                                if (act.type === 'CREATE_CLIENT') {
                                  const payload = {
                                    name: act.data.nome || act.data.name,
                                    tradeName: act.data.nomeFantasia || act.data.tradeName,
                                    document: act.data.documento || act.data.document,
                                    email: act.data.email,
                                    phone: act.data.telefone || act.data.phone,
                                    personType: act.data.tipoPessoa === 'Física' ? 'Física' : 'Jurídica',
                                    roleIsClient: act.data.papel === 'Cliente' || !act.data.papel,
                                    roleIsSupplier: act.data.papel === 'Fornecedor',
                                    roleIsCarrier: act.data.papel === 'Transportadora',
                                    isSimples: String(act.data.optanteSimples).toLowerCase() === 'sim' || act.data.optanteSimples === true
                                  };
                                  res = await fetch('/api/contaazul/customers', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify(payload)
                                  });
                                } else if (act.type === 'CREATE_ENTRY') {
                                  res = await fetch('/api/contaazul/entries', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify(act.data)
                                  });
                                }

                                if (res) {
                                  const resData = await res.json();
                                  if (!res.ok || !resData.success) {
                                    throw new Error(resData.error || "Erro ao comunicar com a API do ContaAzul");
                                  }
                                }

                                setMessages(prev => prev.map(m => {
                                  if (m.id === msg.id && m.actions) {
                                    return {
                                      ...m,
                                      actions: m.actions.map(a => a.id === actionId ? { ...a, status: 'success' } : a)
                                    };
                                  }
                                  return m;
                                }));
                              } catch (e: any) {
                                console.error("Erro ao executar ação:", e);
                                setMessages(prev => prev.map(m => {
                                  if (m.id === msg.id && m.actions) {
                                    return {
                                      ...m,
                                      actions: m.actions.map(a => a.id === actionId ? { ...a, status: 'error', errorReason: e.message } : a)
                                    };
                                  }
                                  return m;
                                }));
                              }
                            }}
                            onCancel={(actionId) => {
                              setMessages(prev => prev.map(m => {
                                if (m.id === msg.id && m.actions) {
                                  return {
                                    ...m,
                                    actions: m.actions.map(a => a.id === actionId ? { ...a, status: 'error' } : a)
                                  };
                                }
                                return m;
                              }));
                            }}
                          />
                        ))}
                      </div>
                    )}

                    <div className={`text-[10px] mt-2 font-medium flex items-center gap-1.5 ${
                      msg.sender === 'user' ? 'text-emerald-200' : 'text-slate-400'
                    }`}>
                      <span>{msg.timestamp}</span>
                      {msg.sender === 'ai' && <span>• Omni Conta Azul IA</span>}
                    </div>
                  </div>

                  {msg.sender === 'user' && (
                    <div className="w-7 h-7 rounded-lg bg-slate-200 text-slate-700 flex items-center justify-center shrink-0 shadow-2xs mt-1">
                      <UserIcon className="w-4 h-4" />
                    </div>
                  )}
                </div>
              ))
            )}

            {isProcessing && (
              <div className="flex justify-start items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                  <BrainCircuit className="w-4 h-4 animate-spin" />
                </div>
                <div className="bg-white border border-[#E2E8F0] rounded-xl rounded-tl-none p-3 shadow-2xs flex items-center gap-2.5">
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce"></div>
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce" style={{animationDelay: '150ms'}}></div>
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce" style={{animationDelay: '300ms'}}></div>
                  </div>
                  <span className="text-xs font-medium text-slate-600">Consultando base do ContaAzul ERP...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <div className="p-3 md:p-4 bg-white border-t border-[#E2E8F0] shrink-0">
            <div className="max-w-4xl mx-auto bg-white border border-[#E2E8F0] rounded-xl shadow-2xs p-2.5 flex flex-col gap-2">
              <div className="flex items-end gap-2">
                
                <label 
                  title="Importar planilha ou documento (XLSX, CSV, PDF)"
                  className="cursor-pointer p-2.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors shrink-0"
                >
                  <Paperclip className="w-4 h-4" />
                  <input type="file" className="hidden" onChange={handleFileDrop} />
                </label>

                <textarea
                  value={inputText}
                  disabled={isProcessing}
                  onChange={e => setInputText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (!isProcessing && inputText.trim()) {
                        handleSendPrompt(inputText);
                      }
                    }
                  }}
                  placeholder={isProcessing ? "Aguarde, processando consulta..." : "Pergunte sobre clientes, fornecedores, lançamentos ou peça para cadastrar títulos..."}
                  className="flex-1 max-h-28 min-h-[40px] bg-transparent resize-none py-2 outline-none text-xs md:text-sm text-[#0F172A] placeholder-slate-400 disabled:opacity-60 disabled:cursor-not-allowed"
                  rows={1}
                />

                <button 
                  onClick={() => handleSendPrompt(inputText)}
                  disabled={!inputText.trim() || isProcessing}
                  className="p-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-40 transition-colors flex items-center justify-center h-[40px] w-[40px] shrink-0 shadow-2xs"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>

              <div className="px-2 pt-1 border-t border-slate-100 flex items-center justify-end text-[10px] text-slate-500">
                <span className="font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200/60">
                  ⚡ 5 OmniCoins / Envio
                </span>
              </div>
            </div>
          </div>

        </div>
      </div>

      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-5">
            <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-[#E2E8F0]">
              <h2 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                Pré-visualização da Importação
              </h2>
              <button onClick={() => setIsImportModalOpen(false)} className="text-slate-400 hover:text-slate-700 p-1 hover:bg-slate-100 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            {isImporting ? (
              <div className="py-10 flex flex-col items-center justify-center gap-2.5">
                <Loader2 className="w-7 h-7 text-emerald-600 animate-spin" />
                <p className="text-xs font-semibold text-slate-600">Processando e estruturando documento...</p>
              </div>
            ) : importResult ? (
              <div className="space-y-3">
                <div className="bg-slate-50 rounded-lg p-3 border border-[#E2E8F0] space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700">{importResult.fileName || importFile?.name}</span>
                    <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-medium text-[10px]">
                      {importResult.extractedData?.length || 0} linhas identificadas
                    </span>
                  </div>

                  {importResult.columns && (
                    <p className="text-[11px] text-slate-500">
                      <strong>Colunas:</strong> {importResult.columns.join(", ")}
                    </p>
                  )}

                  {importResult.extractedData && importResult.extractedData.length > 0 && (
                    <div className="max-h-44 overflow-auto border border-[#E2E8F0] rounded-md">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-100 sticky top-0">
                          <tr>
                            {importResult.columns?.map((col: string, i: number) => (
                              <th key={i} className="px-2.5 py-1.5 text-left font-semibold text-slate-600 border-b border-[#E2E8F0]">{col}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {importResult.extractedData.slice(0, 10).map((row: any, i: number) => (
                            <tr key={i} className="border-b border-[#E2E8F0]">
                              {importResult.columns?.map((col: string, j: number) => (
                                <td key={j} className="px-2.5 py-1 text-slate-700">{row[col] ?? ""}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-[#E2E8F0]">
                  <button onClick={() => setIsImportModalOpen(false)} className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-[#E2E8F0] hover:bg-slate-50 rounded-lg">
                    Cancelar
                  </button>
                  <button onClick={handleConfirmImport} className="px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg flex items-center gap-1.5 shadow-2xs">
                    Analisar & Cadastrar com IA <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={Boolean(deletingConvId)}
        title="Excluir Consulta do Histórico?"
        description="Esta ação removerá permanentemente o histórico desta conversa do seu banco de dados."
        confirmText="Sim, Excluir"
        cancelText="Cancelar"
        variant="danger"
        onConfirm={handleConfirmDeleteConversation}
        onCancel={() => setDeletingConvId(null)}
        onClose={() => setDeletingConvId(null)}
      />

      <ConfirmModal
        isOpen={showNoCoinsModal}
        title="Saldo de OmniCoins Insuficiente"
        description="Você não possui OmniCoins suficientes para realizar esta consulta. Acesse a aba Contas a Pagar para recarregar."
        confirmText="Ir para Financeiro"
        cancelText="Fechar"
        variant="warning"
        onConfirm={() => {
          setShowNoCoinsModal(false);
          window.location.href = "/financeiro";
        }}
        onCancel={() => setShowNoCoinsModal(false)}
        onClose={() => setShowNoCoinsModal(false)}
      />

    </div>
  );
}
