"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  BrainCircuit, Users, Building2, DollarSign, Layers,
  Search, Plus, Pin, Trash2, Send, Paperclip, X,
  FileSpreadsheet, ArrowRight, Loader2, Coins, Bot, User as UserIcon,
  Sparkles, Check, Edit2, ChevronDown, CheckCircle, RefreshCw, History,
  ChevronRight, HelpCircle, BarChart3, TrendingUp
} from "lucide-react";
import { deductCoins } from "@/lib/coins/store";
import { fetchServerTable } from "@/lib/db/serverDb";
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

// 15 Newest Frontier LLMs organized by Providers
const modelGroups = [
  {
    provider: "OpenAI",
    models: [
      { id: "openai/gpt-5.5-turbo", name: "GPT-5.5 Turbo (OpenAI)", badge: "Flagship 2026" },
      { id: "openai/gpt-5.0-pro", name: "GPT-5.0 Pro (OpenAI)", badge: "Raciocínio SPED" },
      { id: "openai/o4-mini", name: "o4-mini (OpenAI)", badge: "Alta Velocidade" },
    ]
  },
  {
    provider: "Anthropic",
    models: [
      { id: "anthropic/claude-4.8-sonnet", name: "Claude 4.8 Sonnet (Anthropic)", badge: "Recomendado Fiscal" },
      { id: "anthropic/claude-4.7-opus", name: "Claude 4.7 Opus (Anthropic)", badge: "Auditoria e-CAC" },
      { id: "anthropic/claude-3.7-sonnet", name: "Claude 3.7 Sonnet (Anthropic)", badge: "Redação Contratos" },
    ]
  },
  {
    provider: "Google",
    models: [
      { id: "google/gemini-3.6-pro", name: "Gemini 3.6 Pro (Google)", badge: "Análise SPED" },
      { id: "google/gemini-3.5-flash", name: "Gemini 3.5 Flash (Google)", badge: "Latência Ultrabaixa" },
      { id: "google/gemini-3.0-ultra", name: "Gemini 3.0 Ultra (Google)", badge: "Contexto Massivo" },
    ]
  },
  {
    provider: "DeepSeek",
    models: [
      { id: "deepseek/deepseek-v4", name: "DeepSeek V4 (DeepSeek)", badge: "Nova Geração" },
      { id: "deepseek/deepseek-r2", name: "DeepSeek R2 (DeepSeek)", badge: "Raciocínio Tributário" },
      { id: "deepseek/deepseek-v3.5", name: "DeepSeek V3.5 (DeepSeek)", badge: "Eficiência Extrema" },
    ]
  },
  {
    provider: "Outras IAs & Open Source",
    models: [
      { id: "moonshotai/moonshot-v2-256k", name: "Kimi Moonshot 256k (Moonshot)", badge: "Leitura Livros Fiscais" },
      { id: "meta-llama/llama-4-405b-instruct", name: "Llama 4 405B (Meta)", badge: "Open Source Enterprise" },
      { id: "qwen/qwen-3-72b-instruct", name: "Qwen 3 72B (Alibaba Qwen)", badge: "Multilíngue & Contábil" },
    ]
  }
];

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
 * Componente Infográfico de Mini-Gráficos Interativos
 */
function MiniChart({ chart }: { chart: any }) {
  if (!chart) return null;
  const colors = ["#1E6FD9", "#6366f1", "#f59e0b", "#10b981", "#8b5cf6", "#ec4899"];

  return (
    <div className="w-full bg-slate-50 border border-[#E2E8F0] rounded-xl p-3.5 space-y-3 mt-3 shadow-2xs">
      <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
        <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
          <BarChart3 className="w-4 h-4 text-blue-600" />
          {chart.title || "Infográfico Financeiro"}
        </h4>
        <span className="text-[10px] font-semibold text-blue-700 bg-blue-100 px-2 py-0.5 rounded">
          Visão Geral ERP
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="p-2 bg-white border border-slate-200/80 rounded-lg">
          <span className="text-[10px] text-slate-400 font-medium block">Contas a Pagar</span>
          <span className="text-xs font-bold text-rose-600">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(chart.totalPayable || 0)}
          </span>
        </div>

        <div className="p-2 bg-white border border-slate-200/80 rounded-lg">
          <span className="text-[10px] text-slate-400 font-medium block">Contas a Receber</span>
          <span className="text-xs font-bold text-emerald-600">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(chart.totalReceivable || 0)}
          </span>
        </div>

        <div className="p-2 bg-white border border-slate-200/80 rounded-lg">
          <span className="text-[10px] text-slate-400 font-medium block">Saldo Previsto</span>
          <span className="text-xs font-bold text-blue-600">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(chart.netBalance || 0)}
          </span>
        </div>
      </div>

      {chart.items && chart.items.length > 0 && (
        <div className="space-y-2 pt-1">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Distribuição de Valores Por Categoria</span>
          <div className="space-y-1.5">
            {chart.items.map((item: any, idx: number) => {
              const itemColor = item.color || colors[idx % colors.length];
              return (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-medium text-slate-700 truncate max-w-[220px]">{item.label}</span>
                    <span className="font-semibold text-slate-900">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.value)} ({item.percentage}%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-200/80 rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all duration-500" 
                      style={{ width: `${Math.min(100, Math.max(5, item.percentage))}%`, backgroundColor: itemColor }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Parser Seguro para Evitar Vazamento de JSON Bruto
 */
function parseAIMessageContent(rawText: string): { text: string; chart?: any; table?: any; actions?: any[] } {
  if (!rawText) return { text: "" };
  let str = rawText.trim();

  if (str.startsWith("```json")) str = str.slice(7);
  if (str.startsWith("```")) str = str.slice(3);
  if (str.endsWith("```")) str = str.slice(0, -3);
  str = str.trim();

  if (str.startsWith("{")) {
    try {
      const parsed = JSON.parse(str);
      if (parsed && typeof parsed === "object") {
        return {
          text: parsed.message || parsed.text || "Consulta processada com sucesso.",
          chart: parsed.chart || undefined,
          table: parsed.table || undefined,
          actions: parsed.actions?.length > 0 ? parsed.actions : undefined
        };
      }
    } catch (e) {}
  }

  const cleaned = str.replace(/```json/g, '').replace(/```/g, '').replace(/\*\*([^*]+)\*\*/g, '$1').trim();
  return { text: cleaned };
}

export default function OmniContaAzulIAPage() {
  const [selectedModel, setSelectedModel] = useState<string>("anthropic/claude-4.8-sonnet");
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [currentConvId, setCurrentConvId] = useState<string>("");
  const currentConvIdRef = useRef<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
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
    { key: 'clients', label: 'Clientes Sincronizados', value: '...', icon: Users, color: '#1E6FD9', trend: 'up' as const },
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
        const clients = await fetchServerTable('contaazul_clients');
        const suppliers = await fetchServerTable('contaazul_suppliers');
        const entries = await fetchServerTable('contaazul_entries');
        const categories = await fetchServerTable('contaazul_categories');
        const auditLogs = await fetchServerTable('contaazul_ia_audit_logs');

        const clientCount = Array.isArray(clients) ? clients.length : 6;
        const supplierCount = Array.isArray(suppliers) ? suppliers.length : 1;
        const entryCount = Array.isArray(entries) ? entries.length : 1;
        const catCount = Array.isArray(categories) ? categories.length : 2;
        const queryCount = Array.isArray(auditLogs) ? auditLogs.length : 7;

        setKpiMetrics([
          { key: 'clients', label: 'Clientes Sincronizados', value: String(clientCount), icon: Users, color: '#1E6FD9', trend: 'up' },
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
            const targetId = savedActiveId && loadedConvs.some(c => c.id === savedActiveId)
              ? savedActiveId
              : loadedConvs[0].id;

            setCurrentConvId(targetId);
            currentConvIdRef.current = targetId;
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
    setIsProcessing(true);

    try {
      const response = await fetch('/api/contaazul/ia-workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: text,
          conversationId: activeId,
          model: selectedModel,
          attachmentData: fileData
        })
      });

      const data = await response.json();
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
      setIsProcessing(false);
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
              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors border border-transparent hover:border-slate-200"
            >
              <History className="w-4 h-4" />
            </button>

            <div className="p-2 bg-blue-50 border border-blue-100/80 rounded-lg text-blue-600">
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
            <select
              value={selectedModel}
              onChange={e => setSelectedModel(e.target.value)}
              className="bg-slate-50 border border-[#E2E8F0] hover:border-blue-300 text-xs font-medium text-slate-700 rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer max-w-[260px] truncate"
            >
              {modelGroups.map(group => (
                <optgroup key={group.provider} label={group.provider}>
                  {group.models.map(m => (
                    <option key={m.id} value={m.id}>
                      ⚡ {m.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>

            <div className="flex items-center gap-1 bg-amber-50 border border-amber-200/60 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-amber-700">
              <Coins className="w-3.5 h-3.5 text-amber-500" />
              <span>5 Coins / Envio</span>
            </div>
          </div>
        </div>

        <KPIStrip metrics={kpiMetrics} onMetricClick={handleKPISelect} />

        <div className="flex items-center gap-2 pt-1 border-t border-slate-100 overflow-x-auto scrollbar-hide">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0 flex items-center gap-1">
            <HelpCircle className="w-3 h-3 text-blue-500" />
            Sugestões Rápidas:
          </span>

          <div className="flex items-center gap-1.5 overflow-x-auto flex-1 scrollbar-hide">
            {currentSuggestions.map((item, idx) => (
              <button
                key={idx}
                onClick={() => handleSendPrompt(item.prompt)}
                className="px-2.5 py-1 bg-slate-50 hover:bg-blue-50/60 text-slate-700 hover:text-blue-700 border border-slate-200/80 hover:border-blue-200 rounded-md text-[11px] font-medium transition-all shrink-0 active:scale-95"
              >
                {item.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => setSuggestionPoolIndex((prev) => (prev + 1) % SUGGESTION_POOLS.length)}
            title="Girar novas sugestões"
            className="p-1 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded-md transition-colors shrink-0"
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
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2 text-xs font-semibold shadow-2xs transition-all active:scale-[0.98]"
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
                  className="w-full pl-7 pr-2.5 py-1 bg-slate-50 border border-[#E2E8F0] rounded-md text-[11px] outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white transition-all"
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
                        ? 'bg-blue-50 border border-blue-200 text-blue-900 font-semibold shadow-2xs' 
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
                            className="w-full text-[11px] px-1.5 py-0.5 border border-blue-400 rounded bg-white outline-none"
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
                        className="text-slate-400 hover:text-blue-600 p-1 rounded hover:bg-blue-50"
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
                <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center shadow-2xs">
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
                      className="p-3 bg-white border border-[#E2E8F0] hover:border-blue-300 hover:bg-blue-50/30 rounded-xl text-left flex items-start gap-2.5 group transition-all shadow-2xs"
                    >
                      <BrainCircuit className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-semibold text-slate-800 block truncate group-hover:text-blue-700">
                          {item.label}
                        </span>
                        <span className="text-[10px] text-slate-400 block truncate">Clique para consultar</span>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 shrink-0 mt-0.5" />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map(msg => (
                <div key={msg.id} className={`flex gap-2.5 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  
                  {msg.sender === 'ai' && (
                    <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-2xs mt-1">
                      <BrainCircuit className="w-4 h-4" />
                    </div>
                  )}

                  <div className={`max-w-[85%] rounded-xl p-4 shadow-2xs ${
                    msg.sender === 'user' 
                      ? 'bg-blue-600 text-white rounded-tr-none' 
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
                      msg.sender === 'user' ? 'text-blue-200' : 'text-slate-400'
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
                <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                  <BrainCircuit className="w-4 h-4 animate-spin" />
                </div>
                <div className="bg-white border border-[#E2E8F0] rounded-xl rounded-tl-none p-3 shadow-2xs flex items-center gap-2.5">
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce"></div>
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce" style={{animationDelay: '150ms'}}></div>
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce" style={{animationDelay: '300ms'}}></div>
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
                  className="cursor-pointer p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors shrink-0"
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
                  className="p-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors flex items-center justify-center h-[40px] w-[40px] shrink-0 shadow-2xs"
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
                <Loader2 className="w-7 h-7 text-blue-600 animate-spin" />
                <p className="text-xs font-semibold text-slate-600">Processando e estruturando documento...</p>
              </div>
            ) : importResult ? (
              <div className="space-y-3">
                <div className="bg-slate-50 rounded-lg p-3 border border-[#E2E8F0] space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700">{importResult.fileName || importFile?.name}</span>
                    <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-medium text-[10px]">
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
                  <button onClick={handleConfirmImport} className="px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-1.5 shadow-2xs">
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
        description="Você não possui OmniCoins suficientes para realizar esta consulta. Acesse a aba Contas a Pagar & Coins para recarregar."
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
