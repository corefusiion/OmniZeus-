"use client";

import { useState, useEffect, useRef } from "react";
import { 
  Sparkles, Send, RefreshCw, Cpu, BookOpen, Coins, 
  Copy, Trash2, Plus, History, ChevronRight, Pin, Edit2, Check, X
} from "lucide-react";
import { fetchCoinBalanceFromServer } from "@/lib/coins/store";
import { sqlDb } from "@/lib/db/sqlite";
import { getCustomAgents, CustomAgent } from "@/lib/agents/store";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { fetchServerSettings, fetchServerTable, insertServerTable } from "@/lib/db/serverDb";
import { getActiveTenantId } from "@/lib/auth/roles";
import { runChatJob, OMNIIA_JOB_EVENT, OMNIIA_MESSAGE_EVENT, isConversationProcessing, getProcessingConversationIds } from "@/lib/ai/chatSession";

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  model?: string;
  pending?: boolean;
}

interface ConversationItem {
  id: string;
  title: string;
  model: string;
  isPinned?: boolean;
}

// 15 Newest 2026 Frontier LLMs organized by Providers
const modelGroups = [
  {
    provider: "OpenAI",
    models: [
      { id: "openai/gpt-5.5-turbo", name: "GPT-5.5 Turbo (OpenAI)", badge: "Flagship 2026" },
      { id: "openai/gpt-5.0-pro", name: "GPT-5.0 Pro (OpenAI)", badge: "Raciocínio Profundo SPED" },
      { id: "openai/o4-mini", name: "o4-mini (OpenAI)", badge: "Alta Velocidade & Raciocínio" },
    ]
  },
  {
    provider: "Anthropic",
    models: [
      { id: "anthropic/claude-4.8-sonnet", name: "Claude 4.8 Sonnet (Anthropic)", badge: "Recomendado Fiscal" },
      { id: "anthropic/claude-4.7-opus", name: "Claude 4.7 Opus (Anthropic)", badge: "Auditoria Complexa e-CAC" },
      { id: "anthropic/claude-3.7-sonnet", name: "Claude 3.7 Sonnet (Anthropic)", badge: "Redação de Contratos A4" },
    ]
  },
  {
    provider: "Google",
    models: [
      { id: "google/gemini-3.6-pro", name: "Gemini 3.6 Pro (Google)", badge: "Análise SPED & Balancetes" },
      { id: "google/gemini-3.5-flash", name: "Gemini 3.5 Flash (Google)", badge: "Latência Ultrabaixa" },
      { id: "google/gemini-3.0-ultra", name: "Gemini 3.0 Ultra (Google)", badge: "Contexto Massivo 2M" },
    ]
  },
  {
    provider: "DeepSeek",
    models: [
      { id: "deepseek/deepseek-v4", name: "DeepSeek V4 (DeepSeek)", badge: "Nova Geração Raciocínio" },
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

const allModelsList = modelGroups.flatMap(g => g.models);

const SPECIALIST_CARDS = [
  {
    id: "geral",
    label: "Assistente Geral Contábil",
    category: "Contábil & DRE",
    color: "bg-blue-50 text-blue-700 border-blue-200/60",
    description: "Dúvidas contábeis, escrituração NBC TG, balancetes e conciliações de contas.",
    samplePrompt: "Como estruturar o plano de contas e DRE gerencial para prestador de BPO?"
  },
  {
    id: "fiscal",
    label: "Especialista Fiscal & SPED",
    category: "Tributário & SPED",
    color: "bg-emerald-50 text-emerald-700 border-emerald-200/60",
    description: "Apuração de Simples Nacional, Fator R, ICMS, IPI, PIS/COFINS, DCTFWeb e SPED.",
    samplePrompt: "Calcular alíquota efetiva do Simples Nacional no Anexo III aplicando Fator R."
  },
  {
    id: "contratos",
    label: "Redator de Contratos & Societário",
    category: "Jurídico & Societário",
    color: "bg-purple-50 text-purple-700 border-purple-200/60",
    description: "Elaboração de contratos sociais, alteração contratual, distratos e acordos de sócios.",
    samplePrompt: "Gerar minuta de alteração contratual LTDA para entrada de novo sócio."
  },
  {
    id: "apresentacoes_deck",
    label: "Agente IA Decks & Apresentações",
    category: "Apresentações Executive",
    color: "bg-indigo-50 text-indigo-700 border-indigo-200/60",
    description: "Criação de roteiros para slides executivos, reuniões de resultados e propostas.",
    samplePrompt: "Elaborar estrutura de slides para apresentação de resultado fiscal e BPO ao cliente."
  }
];
function sanitizeAiText(raw: string): string {
  if (!raw) return "";
  let text = raw.trim();
  // Remove markdown code blocks containing json
  text = text.replace(/```json[\s\S]*?```/gi, "").trim();
  text = text.replace(/```[\s\S]*?```/gi, (match) => {
    if (match.includes("{") && match.includes("}")) return "";
    return match;
  }).trim();
  // If the whole string is a JSON array or object, convert to friendly text or strip
  if ((text.startsWith("[") && text.endsWith("]")) || (text.startsWith("{") && text.endsWith("}"))) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed) || typeof parsed === "object") {
        return "Análise concluída e estrutura processada com sucesso. Como deseja detalhar cada tópico abordado?";
      }
    } catch (e) {}
  }
  return text || "Resposta processada com sucesso.";
}

export default function OmniIAPage() {
  const [selectedModel, setSelectedModel] = useState(allModelsList[3].id);
  const [personas, setPersonas] = useState<CustomAgent[]>([]);
  const [selectedPersona, setSelectedPersona] = useState<string>("agente_geral");
  const [inputMessage, setInputMessage] = useState("");
  
  // Isolated loading state per conversation ID
  const [loadingConvIds, setLoadingConvIds] = useState<Record<string, boolean>>({});
  
  const [showHistorySidebar, setShowHistorySidebar] = useState(true);
  const [activeConvId, setActiveConvId] = useState<string>("");
  const activeConvIdRef = useRef<string>(activeConvId);

  useEffect(() => {
    activeConvIdRef.current = activeConvId;
    if (typeof window !== "undefined" && activeConvId) {
      localStorage.setItem("omnizeus_omniia_active_conv", activeConvId);
    }
  }, [activeConvId]);

  const [editingConvId, setEditingConvId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string>("");

  // Confirmation Modal States
  const [deletingConvId, setDeletingConvId] = useState<string | null>(null);
  const [showNoCoinsModal, setShowNoCoinsModal] = useState(false);

  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  // Per-conversation message cache. Keyed by conversation id.
  // A conversation whose key exists (even as []) is considered locally hydrated
  // and will NOT be destructively re-fetched from the DB — this prevents the
  // async loader from wiping optimistic (in-flight) messages.
  const [messagesByConv, setMessagesByConv] = useState<Record<string, Message[]>>({});
  const messages = activeConvId ? (messagesByConv[activeConvId] || []) : [];
  // Se há mensagem "Processando análise..." pendente no cache, a conversa está
  // em processamento (reflete estado persistido, sobrevive à navegação).
  const hasPendingMessage = messages.some(m => m.pending);
  const isActiveConvLoading = Boolean(loadingConvIds[activeConvId]) || hasPendingMessage;

  const activeModelObj = allModelsList.find(m => m.id === selectedModel) || allModelsList[0];
  // Agentes disponíveis para seleção (arquivados ficam ocultos do seletor,
  // mas conversas antigas continuam resolvendo o agente corretamente).
  const availablePersonas = personas.filter(p => p.status !== "Arquivado");
  const activePersonaObj = personas.find(p => p.id === selectedPersona) || personas.find(p => p.id === "agente_geral") || personas[0] || {
    id: "agente_geral",
    label: "Agente Geral",
    systemPrompt: "Você é o Agente Geral Corporativo do OmniZeus. Responda de forma concisa, executiva e precisa.",
    color: "bg-slate-50 text-slate-700 border-slate-200/60"
  };
  // Cards da tela inicial: especialistas padrão + agentes personalizados da empresa
  const customAgentCards = availablePersonas
    .filter(p => p.isCustom)
    .slice(0, 4)
    .map(p => ({
      id: p.id,
      label: p.label,
      category: `${p.category} • Personalizado`,
      color: p.color || "bg-blue-50 text-blue-700 border-blue-200/60",
      description: p.description || p.specialty || "Agente personalizado criado pela sua empresa.",
      samplePrompt: p.initialPrompt || (p.objective ? `Preciso de auxílio com: ${p.objective}` : `Olá! Preciso de auxílio como ${p.label}.`)
    }));
  const welcomeCards = [...SPECIALIST_CARDS, ...customAgentCards];

  useEffect(() => {
    setPersonas(getCustomAgents());
    const handleAgentsChange = () => setPersonas(getCustomAgents());

    const loadConversationsFromSql = async () => {
      try {
        const convRecords = await fetchServerTable('conversations');
        if (Array.isArray(convRecords) && convRecords.length > 0) {
          const activeConvs = convRecords.filter((c: any) => !c.deleted);
          if (activeConvs.length > 0) {
            setConversations(activeConvs.map((c: any) => ({
              id: c.id,
              title: c.title || "Conversa BPO",
              model: c.model || "Claude 4.8 Sonnet",
              isPinned: Boolean(c.pinned)
            })));

            // Restaura a última conversa ativa (se ainda existir), senão a primeira
            const savedActive = typeof window !== "undefined"
              ? localStorage.getItem("omnizeus_omniia_active_conv")
              : null;
            const restored = activeConvs.find((c: any) => c.id === savedActive) || activeConvs[0];
            setActiveConvId(restored.id);
            activeConvIdRef.current = restored.id;
            if (restored.persona) {
              setSelectedPersona(restored.persona);
            }
          } else {
            setConversations([]);
            setActiveConvId("");
            activeConvIdRef.current = "";
          }
        } else {
          setConversations([]);
          setActiveConvId("");
          activeConvIdRef.current = "";
        }
      } catch (err) {
        console.error("Erro ao carregar conversas do servidor DB:", err);
        setConversations([]);
        setActiveConvId("");
        activeConvIdRef.current = "";
      }
    };

    loadConversationsFromSql();

    // Re-sincroniza conversas/mensagens quando um job de chat global muda
    // (ex.: o usuário trocou de tela enquanto processava e voltou).
    const handleJobChange = () => {
      const processingIds = getProcessingConversationIds?.() ?? [];
      setLoadingConvIds(prev => {
        const next: Record<string, boolean> = {};
        processingIds.forEach((id) => { next[id] = true; });
        // Preserva jobs de conversas já abertas
        Object.keys(prev).forEach((k) => { if (prev[k]) next[k] = true; });
        return next;
      });
    };
    const handleMessagePersisted = () => {
      // Recarrega as mensagens da conversa ativa para refletir a resposta
      // (placeholder → texto final) sem depender de estado do componente.
      const convId = activeConvIdRef.current;
      if (convId) {
        loadMessagesFromSql(convId, true);
      }
    };

    window.addEventListener(OMNIIA_JOB_EVENT, handleJobChange);
    window.addEventListener(OMNIIA_MESSAGE_EVENT, handleMessagePersisted);
    window.addEventListener("omnizeus_agents_change", handleAgentsChange);
    return () => {
      window.removeEventListener(OMNIIA_JOB_EVENT, handleJobChange);
      window.removeEventListener(OMNIIA_MESSAGE_EVENT, handleMessagePersisted);
      window.removeEventListener("omnizeus_agents_change", handleAgentsChange);
    };
  }, []);

  // Load messages from DB (shared between the hydration effect and the global
  // job events). Handles pending placeholders (__PROCESSING__) so navigation
  // back shows "Processando análise..." instead of losing the in-flight state.
  const loadMessagesFromSql = async (convId?: string, force = false) => {
    const targetId = convId || activeConvId;
    if (!targetId) return;
    try {
      const convRecords = await fetchServerTable('conversations');
      const conv = convRecords.find((c: any) => c.id === targetId);
      if (conv && conv.persona) {
        setSelectedPersona(conv.persona);
      }

      const msgRecords = await fetchServerTable('messages');
      const msgs = msgRecords.filter((m: any) => m.conversation_id === targetId);

      const sortedMsgs = [...msgs].sort((a, b) => new Date(a.created_at || Date.now()).getTime() - new Date(b.created_at || Date.now()).getTime());
      const mapped: Message[] = sortedMsgs.map((m: any) => {
        // Placeholder de processamento persistido pelo chatSession global
        if (m.pending && m.text === "__PROCESSING__") {
          return {
            id: m.id,
            sender: 'ai' as const,
            text: "Processando análise...",
            timestamp: new Date(m.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            model: m.model || activeModelObj.name,
            pending: true
          };
        }
        return {
          id: m.id,
          sender: m.sender as 'user' | 'ai',
          text: m.sender === 'ai' ? sanitizeAiText(m.text) : m.text,
          timestamp: new Date(m.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          model: m.model || activeModelObj.name
        };
      });

      // Guard contra race: em hidratação normal não sobrescreve cache com
      // mensagens em vôo. Com force=true (evento global) sempre atualiza.
      setMessagesByConv(prev => {
        if (!force && prev[targetId] !== undefined && !mapped.some(m => m.pending)) return prev;
        return { ...prev, [targetId]: mapped };
      });
    } catch (err) {
      console.error("Erro ao carregar mensagens da conversa:", err);
    }
  };

  useEffect(() => {
    if (!activeConvId) return;

    // Already hydrated locally (has an entry, or is currently loading a response) → skip DB reload.
    if (messagesByConv[activeConvId] !== undefined && !loadingConvIds[activeConvId]) {
      return;
    }

    let cancelled = false;
    const run = async () => {
      try {
        const convRecords = await fetchServerTable('conversations');
        const conv = convRecords.find((c: any) => c.id === activeConvId);
        if (conv && conv.persona) {
          setSelectedPersona(conv.persona);
        }

        const msgRecords = await fetchServerTable('messages');
        const msgs = msgRecords.filter((m: any) => m.conversation_id === activeConvId);

        if (cancelled) return;

        const sortedMsgs = [...msgs].sort((a, b) => new Date(a.created_at || Date.now()).getTime() - new Date(b.created_at || Date.now()).getTime());
        const mapped: Message[] = sortedMsgs.map((m: any) => {
          if (m.pending && m.text === "__PROCESSING__") {
            return {
              id: m.id,
              sender: 'ai' as const,
              text: "Processando análise...",
              timestamp: new Date(m.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              model: m.model || activeModelObj.name,
              pending: true
            };
          }
          return {
            id: m.id,
            sender: m.sender as 'user' | 'ai',
            text: m.sender === 'ai' ? sanitizeAiText(m.text) : m.text,
            timestamp: new Date(m.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            model: m.model || activeModelObj.name
          };
        });

        // Guard against a race: if the conversation got hydrated while we were
        // fetching (e.g. user sent a message), don't clobber it.
        setMessagesByConv(prev => {
          if (prev[activeConvId] !== undefined && !mapped.some(m => m.pending)) return prev;
          return { ...prev, [activeConvId]: mapped };
        });
      } catch (err) {
        console.error("Erro ao carregar mensagens da conversa:", err);
        if (!cancelled) {
          setMessagesByConv(prev => (prev[activeConvId] !== undefined ? prev : { ...prev, [activeConvId]: [] }));
        }
      }
    };

    run();
    return () => { cancelled = true; };
  }, [activeConvId, messagesByConv, loadingConvIds]);

  const executeChatQuery = async (textToSend: string, overridePersonaId?: string) => {
    const promptText = textToSend.trim();
    if (!promptText) return;

    const activePersona = overridePersonaId || selectedPersona;
    const personaObj = personas.find(p => p.id === activePersona) || activePersonaObj;

    // Verifica saldo ANTES de enviar (sem debitar aqui). O débito real dos 5
    // OmniCoins acontece uma única vez no servidor (/api/chat → recordChatMetrics).
    const selectedCompanyId = typeof window !== "undefined"
      ? (localStorage.getItem("omnizeus_active_company_id") || "")
      : "";
    const activeCompany = selectedCompanyId || getActiveTenantId() || "";
    if (!activeCompany) {
      setShowNoCoinsModal(true);
      return;
    }
    const currentBalance = await fetchCoinBalanceFromServer(activeCompany);
    if (currentBalance < 5) {
      setShowNoCoinsModal(true);
      return;
    }

    let targetConvId = activeConvId;
    let isNewConv = false;

    // Always create a new conversation ID if starting from welcome screen or clicking a specialist card
    if (!targetConvId || conversations.length === 0 || overridePersonaId) {
      targetConvId = `conv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      isNewConv = true;
      const newTitle = personaObj.label || promptText.substring(0, 30);
      const newConv: ConversationItem = { id: targetConvId, title: newTitle, model: activeModelObj.name, isPinned: false };
      setConversations(prev => [newConv, ...prev.filter(c => c.id !== targetConvId)]);
      setActiveConvId(targetConvId);
      activeConvIdRef.current = targetConvId;
      // Mark as hydrated (empty) so the DB loader won't try to overwrite it.
      setMessagesByConv(prev => ({ ...prev, [targetConvId]: [] }));

      sqlDb.insert('conversations', {
        id: targetConvId,
        title: newConv.title,
        model: activeModelObj.name,
        persona: activePersona,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }

    if (overridePersonaId) {
      setSelectedPersona(overridePersonaId);
    }

    // A conversa fica vinculada ao agente em uso: atualiza o persona da
    // conversa no banco para que histórico e contexto sigam o agente ativo
    // mesmo em conversas existentes (sem criar nova conversa).
    if (!isNewConv && targetConvId) {
      try {
        await import("@/lib/db/serverDb").then(({ updateServerTableRecord }) =>
          updateServerTableRecord("conversations", {
            id: targetConvId,
            persona: activePersona,
            updated_at: new Date().toISOString()
          })
        );
      } catch (e) {}
    }

    // Snapshot of prior messages for this conversation (for the API history payload).
    const priorMessages = isNewConv ? [] : (messagesByConv[targetConvId] || []);

    const userMsg: Message = {
      id: `msg_${Date.now()}`,
      sender: "user",
      text: promptText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    // Optimistically show the user message in the correct conversation.
    setMessagesByConv(prev => ({
      ...prev,
      [targetConvId]: [...(prev[targetConvId] || []), userMsg]
    }));

    // Store in SQL DB immediately
    await insertServerTable('messages', {
      id: userMsg.id,
      conversation_id: targetConvId,
      sender: 'user',
      text: promptText,
      model: activeModelObj.name,
      created_at: new Date().toISOString()
    });

    setInputMessage("");
    setLoadingConvIds(prev => ({ ...prev, [targetConvId]: true }));

    // Processamento delegado ao módulo global (chatSession). O fetch continua
    // rodando mesmo se o usuário trocar de tela; a resposta é persistida no DB
    // e o componente re-sincroniza via eventos OMNIIA_JOB_EVENT / OMNIIA_MESSAGE_EVENT.
    try {
      await runChatJob({
        conversationId: targetConvId,
        messages: [
          ...priorMessages.map(m => ({
            role: (m.sender === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
            content: m.text
          })),
          { role: "user" as const, content: promptText }
        ],
        prompt: promptText,
        model: personaObj.modelLlm || selectedModel,
        persona: activePersona,
        personaPrompt: personaObj.systemPrompt,
        personaName: personaObj.label || activePersona,
        temperature: personaObj.temperature !== undefined ? personaObj.temperature : undefined,
        activeCompanyId: activeCompany
      });
    } finally {
      // O job é global; o loading local reflete o estado global para a UI.
      setLoadingConvIds(prev => ({ ...prev, [targetConvId]: isConversationProcessing(targetConvId) }));
    }
  };

  const handleStartAgentChat = (agentId: string, samplePrompt?: string) => {
    executeChatQuery(samplePrompt || `Olá! Preciso de auxílio contábil como ${agentId}.`, agentId);
  };

  const handleSendMessage = async () => {
    executeChatQuery(inputMessage);
  };

  const handleNewConversation = () => {
    setActiveConvId("");
    activeConvIdRef.current = "";
    setInputMessage("");
  };

  const togglePinConversation = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConversations(prev => prev.map(c => c.id === id ? { ...c, isPinned: !c.isPinned } : c));
  };

  const startEditingTitle = (id: string, currentTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingConvId(id);
    setEditingTitle(currentTitle);
  };

  const saveEditedTitle = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!editingTitle.trim()) return;
    const newTitle = editingTitle.trim();
    setConversations(prev => prev.map(c => c.id === id ? { ...c, title: newTitle } : c));
    sqlDb.updateConversationTitle(id, newTitle);
    setEditingConvId(null);
  };

  const openDeleteModal = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingConvId(id);
  };

  const confirmDeleteConversation = () => {
    if (!deletingConvId) return;
    sqlDb.deleteConversation(deletingConvId);

    const removedId = deletingConvId;
    const updated = conversations.filter(c => c.id !== removedId);
    setConversations(updated);
    setMessagesByConv(prev => {
      const next = { ...prev };
      delete next[removedId];
      return next;
    });
    if (activeConvId === removedId) {
      if (updated.length > 0) {
        setActiveConvId(updated[0].id);
        activeConvIdRef.current = updated[0].id;
      } else {
        setActiveConvId("");
        activeConvIdRef.current = "";
      }
    }
    setDeletingConvId(null);
  };

  const sortedConversations = [...conversations].sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0));

  return (
    <div className="-m-4 sm:-m-6 lg:-m-8 flex flex-col h-[calc(100vh-64px)] bg-[#F8FAFC] overflow-hidden">
      <ConfirmModal
        isOpen={deletingConvId !== null}
        onClose={() => setDeletingConvId(null)}
        onConfirm={confirmDeleteConversation}
        title="Excluir Consulta do Histórico?"
        description="Esta conversa será removida permanentemente do banco de dados."
        confirmText="Excluir Consulta"
        cancelText="Cancelar"
        variant="danger"
      />

      <ConfirmModal
        isOpen={showNoCoinsModal}
        onClose={() => setShowNoCoinsModal(false)}
        onConfirm={() => window.location.href = '/financeiro'}
        title="Saldo Insuficiente de OmniCoins"
        description="Você não possui saldo de OmniCoins suficiente para realizar esta consulta. Acesse o módulo Financeiro para efetuar a recarga."
        confirmText="Ir para Recarga"
        cancelText="Entendi"
        variant="warning"
      />

      {/* Header Superior Principal — FIXO NO TOPO */}
      <div className="shrink-0 bg-white border-b border-[#E2E8F0] px-5 py-3 flex flex-col gap-3 shadow-2xs z-20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowHistorySidebar(!showHistorySidebar)}
              title={showHistorySidebar ? "Recolher histórico" : "Expandir histórico"}
              className="p-1.5 text-slate-500 hover:text-primary hover:bg-slate-100 rounded-lg transition-colors border border-transparent hover:border-slate-200"
            >
              <History className="w-4 h-4" />
            </button>

            <div className="p-2 bg-blue-50 border border-blue-100/80 rounded-lg text-primary">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-[#0F172A] tracking-tight">Workspace Omni IA Hub</h1>
                <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-semibold rounded-md border border-slate-200">
                  Chat Especialistas
                </span>
              </div>
              <p className="text-[11px] text-slate-500">Consulte especialistas em contabilidade, fiscal/SPED, contratos e apresentações com IA de ponta.</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div
              className="flex items-center gap-1.5 bg-white border border-[#E2E8F0] hover:border-primary/40 text-xs font-semibold text-slate-700 rounded-lg px-2.5 py-1.5 transition-all"
              title={`Modelo em uso: ${activeModelObj.name}`}
            >
              <Cpu className="w-3.5 h-3.5 text-primary" />
              <span className="hidden md:inline">{activeModelObj.name}</span>
              <span className="md:hidden truncate max-w-[120px]">{activeModelObj.name}</span>
            </div>

            <div className="flex items-center gap-1 bg-amber-50 border border-amber-200/60 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-amber-700">
              <Coins className="w-3.5 h-3.5 text-amber-500" />
              <span>5 Coins / Consulta</span>
            </div>
          </div>
        </div>
      </div>

      {/* Área Principal: Sidebar + Chat */}
      <div className="flex flex-1 overflow-hidden relative">
        {showHistorySidebar && (
          <div className="w-[260px] bg-white border-r border-[#E2E8F0] flex flex-col h-full shrink-0 shadow-2xs z-10">
            <div className="p-3 border-b border-[#E2E8F0] flex flex-col gap-2.5">
              <button
                onClick={handleNewConversation}
                className="w-full flex items-center justify-center gap-2 bg-primary hover:opacity-90 text-white rounded-lg py-2 text-xs font-semibold shadow-2xs transition-all active:scale-[0.98]"
              >
                <Plus className="w-4 h-4" /> Nova Consulta
              </button>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Agente Especialista
                </label>
                <div className="flex items-center gap-2 bg-slate-50 border border-[#E2E8F0] px-2.5 py-1.5 rounded-md text-[11px] font-medium focus-within:ring-1 focus-within:ring-primary">
                  <BookOpen className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                  <select
                    value={selectedPersona}
                    onChange={(e) => setSelectedPersona(e.target.value)}
                    className="bg-transparent font-semibold text-slate-800 focus:outline-none flex-1 min-w-0 truncate cursor-pointer"
                  >
                    {availablePersonas.map(p => (
                      <option key={p.id} value={p.id}>{p.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Modelo de IA
                </label>
                <div className="flex items-center gap-2 bg-slate-50 border border-[#E2E8F0] px-2.5 py-1.5 rounded-md text-[11px] font-medium focus-within:ring-1 focus-within:ring-primary">
                  <Cpu className="w-3.5 h-3.5 text-primary shrink-0" />
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="bg-transparent font-semibold text-slate-800 focus:outline-none flex-1 min-w-0 truncate cursor-pointer"
                  >
                    {modelGroups.map(group => (
                      <optgroup key={group.provider} label={`--- ${group.provider} ---`}>
                        {group.models.map(m => (
                          <option key={m.id} value={m.id}>
                            {m.name} [{m.badge}]
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {sortedConversations.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400 font-medium">
                  Nenhuma consulta gravada. Clique acima em "+ Nova Consulta".
                </div>
              ) : (
                sortedConversations.map(c => {
                  const isConvLoading = Boolean(loadingConvIds[c.id]);
                  return (
                    <div
                      key={c.id}
                      onClick={() => {
                        setActiveConvId(c.id);
                        activeConvIdRef.current = c.id;
                      }}
                      className={`group relative p-2 rounded-lg text-xs font-medium cursor-pointer transition-all border ${
                        activeConvId === c.id
                          ? 'bg-blue-50 border border-blue-200 text-blue-900 font-semibold shadow-2xs'
                          : 'hover:bg-slate-50 border border-transparent text-slate-700'
                      }`}
                    >
                      {editingConvId === c.id ? (
                        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            className="w-full px-2 py-1 bg-white border border-primary rounded text-[11px] font-medium focus:outline-none"
                            autoFocus
                            onKeyDown={(e) => e.key === 'Enter' && saveEditedTitle(c.id, e as any)}
                          />
                          <button
                            onClick={(e) => saveEditedTitle(c.id, e)}
                            className="p-0.5 text-emerald-600 hover:bg-emerald-50 rounded"
                            title="Salvar"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setEditingConvId(null); }}
                            className="p-0.5 text-slate-400 hover:bg-slate-100 rounded"
                            title="Cancelar"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2 overflow-hidden flex-1 mr-1.5">
                            {c.isPinned && (
                              <Pin className="w-3 h-3 text-primary fill-[#1E6FD9] shrink-0" strokeWidth={1.75} />
                            )}
                            <div className="flex flex-col truncate">
                              <span className="text-[11px] truncate leading-snug flex items-center gap-1">
                                {c.title}
                                {isConvLoading && (
                                  <span className="relative flex h-2 w-2 shrink-0 ml-0.5" title="Processando análise em segundo plano...">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                  </span>
                                )}
                              </span>
                              <span className="text-[9px] text-slate-400 font-normal">{c.model}</span>
                            </div>
                          </div>

                          <div className="absolute right-2 top-2 hidden group-hover:flex items-center gap-0.5 bg-white/90 backdrop-blur-xs px-1 py-0.5 rounded border border-slate-200 shadow-xs">
                            <button
                              onClick={(e) => togglePinConversation(c.id, e)}
                              className={`p-1 rounded hover:bg-slate-100 transition-colors ${c.isPinned ? 'text-primary' : 'text-slate-400 hover:text-slate-700'}`}
                              title={c.isPinned ? "Desafixar" : "Fixar no Topo"}
                            >
                              <Pin className="w-3 h-3" strokeWidth={1.75} />
                            </button>
                            <button
                              onClick={(e) => startEditingTitle(c.id, c.title, e)}
                              className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
                              title="Renomear Chat"
                            >
                              <Edit2 className="w-3 h-3" strokeWidth={1.75} />
                            </button>
                            <button
                              onClick={(e) => openDeleteModal(c.id, e)}
                              className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Excluir Chat"
                            >
                              <Trash2 className="w-3 h-3" strokeWidth={1.75} />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

      {/* Área Principal de Chat & Resultados */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#F8FAFC]">
        <div className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col gap-5">
          {!activeConvId || messages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-xl mx-auto space-y-6 my-auto">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 text-primary flex items-center justify-center shadow-2xs">
                <Sparkles className="w-8 h-8" />
              </div>

              <div className="space-y-1.5">
                <h2 className="text-lg font-bold text-[#0F172A]">Workspace Omni IA Hub</h2>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Consulte especialistas em contabilidade, fiscal/SPED, contratos e apresentações em linguagem natural com modelos de IA de ponta.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full pt-2">
                {welcomeCards.map(agent => (
                  <button
                    key={agent.id}
                    onClick={() => handleStartAgentChat(agent.id, agent.samplePrompt)}
                    className="p-3 bg-white border border-[#E2E8F0] hover:border-blue-300 hover:bg-blue-50/30 rounded-xl text-left flex items-start gap-2.5 group transition-all shadow-2xs"
                  >
                    <BookOpen className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-semibold text-slate-800 block truncate group-hover:text-blue-700">
                        {agent.label}
                      </span>
                      <span className="text-[10px] text-slate-400 block truncate">{agent.category} • Clique para consultar</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-primary shrink-0 mt-0.5" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* Barra de contexto da conversa */}
              <div className="flex items-center gap-2.5 shrink-0">
                <div className="w-7 h-7 rounded-lg bg-blue-50 text-primary flex items-center justify-center shrink-0">
                  <BookOpen className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900 truncate">
                    {activePersonaObj.label || "Conversa Omni IA"}
                  </p>
                  <p className="text-[11px] text-slate-400 truncate flex items-center gap-1.5">
                    <Cpu className="w-3 h-3" />
                    {activeModelObj.name}
                  </p>
                </div>
              </div>

              {messages.map((msg) => (
                <div key={msg.id} className={`flex gap-2.5 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.sender === 'ai' && (
                    <div className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0 shadow-2xs mt-1">
                      <Sparkles className="w-4 h-4" />
                    </div>
                  )}

                  <div className={`max-w-[85%] rounded-xl p-4 shadow-2xs ${
                    msg.sender === 'user'
                      ? 'bg-primary text-white rounded-tr-none'
                      : 'bg-white border border-[#E2E8F0] text-[#0F172A] rounded-tl-none'
                  }`}>
                    <div className="text-xs md:text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</div>

                    <div className={`flex items-center gap-2.5 mt-2 text-[10px] text-slate-400 font-medium ${
                      msg.sender === 'user' ? 'justify-end text-white/70' : ''
                    }`}>
                      <span>{msg.timestamp}</span>
                      {msg.model && (
                        <>
                          <span className="w-0.5 h-0.5 rounded-full bg-slate-300" />
                          <span>{msg.model}</span>
                        </>
                      )}
                      <button onClick={() => navigator.clipboard.writeText(msg.text)} className="p-0.5 hover:opacity-70 rounded transition-opacity ml-1" title="Copiar texto">
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {Boolean(isActiveConvLoading) && (
                <div className="flex justify-start items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0 shadow-2xs">
                    <Sparkles className="w-4 h-4 animate-spin" />
                  </div>
                  <div className="bg-white border border-[#E2E8F0] rounded-xl rounded-tl-none p-3 shadow-2xs flex items-center gap-2.5">
                    <div className="flex gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce"></div>
                      <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{animationDelay: '150ms'}}></div>
                      <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{animationDelay: '300ms'}}></div>
                    </div>
                    <span className="text-xs font-medium text-slate-600">Processando análise...</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Input Form Bar */}
        <div className="p-3 md:p-4 bg-white border-t border-[#E2E8F0] shrink-0">
          <div className="max-w-4xl mx-auto bg-white border border-[#E2E8F0] rounded-xl shadow-2xs p-2.5 flex flex-col gap-2">
            <div className="flex items-center gap-2.5">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={inputMessage}
                  disabled={Boolean(isActiveConvLoading)}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !isActiveConvLoading && inputMessage.trim()) {
                      handleSendMessage();
                    }
                  }}
                  placeholder={isActiveConvLoading ? "Processando resposta... por favor aguarde." : "Digite sua dúvida tributária, fiscal ou operacional..."}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-primary focus:bg-white transition-all placeholder:text-slate-400 disabled:bg-slate-100 disabled:cursor-not-allowed"
                />
              </div>
              <button
                onClick={handleSendMessage}
                disabled={Boolean(isActiveConvLoading) || !inputMessage.trim()}
                className="px-4 py-2.5 bg-primary hover:opacity-90 text-white text-xs font-semibold rounded-lg flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-xs"
              >
                <span className="hidden sm:inline">{isActiveConvLoading ? "Gerando..." : "Enviar"}</span>
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                <Coins className="w-3 h-3 text-amber-500" />
                ⚡ 5 OmniCoins / Consulta
              </span>
              <span className="text-[10px] text-slate-400">{activeModelObj.name}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}
