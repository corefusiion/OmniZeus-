"use client";

import { useState, useEffect, useRef } from "react";
import { 
  Sparkles, Send, Bot, User, RefreshCw, Cpu, BookOpen, Coins, 
  Copy, Trash2, Plus, History, ChevronRight, Layers, Pin, Edit2, Check, X, ArrowRight, MessageSquare
} from "lucide-react";
import { fetchCoinBalanceFromServer } from "@/lib/coins/store";
import { sqlDb } from "@/lib/db/sqlite";
import { getCustomAgents, CustomAgent } from "@/lib/agents/store";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { fetchServerSettings, fetchServerTable, insertServerTable } from "@/lib/db/serverDb";

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  model?: string;
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

  const activeModelObj = allModelsList.find(m => m.id === selectedModel) || allModelsList[0];
  const activePersonaObj = personas.find(p => p.id === selectedPersona) || personas.find(p => p.id === "agente_geral") || personas[0] || {
    id: "agente_geral",
    label: "Agente Geral",
    systemPrompt: "Você é o Agente Geral Corporativo do OmniZeus. Responda de forma concisa, executiva e precisa.",
    color: "bg-slate-50 text-slate-700 border-slate-200/60"
  };

  useEffect(() => {
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
            setActiveConvId(activeConvs[0].id);
            activeConvIdRef.current = activeConvs[0].id;
            if (activeConvs[0].persona) {
              setSelectedPersona(activeConvs[0].persona);
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

    setPersonas(getCustomAgents());
    const handleAgentsChange = () => setPersonas(getCustomAgents());
    window.addEventListener("omnizeus_agents_change", handleAgentsChange);
    return () => window.removeEventListener("omnizeus_agents_change", handleAgentsChange);
  }, []);

  // Load messages from DB when switching to a conversation that isn't hydrated
  // locally yet. Conversations already in the cache (including in-flight ones)
  // are never destructively overwritten here.
  useEffect(() => {
    if (!activeConvId) return;

    // Already hydrated locally (has an entry, or is currently loading a response) → skip DB reload.
    if (messagesByConv[activeConvId] !== undefined || loadingConvIds[activeConvId]) {
      return;
    }

    let cancelled = false;
    const loadMessagesFromSql = async () => {
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
        const mapped: Message[] = sortedMsgs.map((m: any) => ({
          id: m.id,
          sender: m.sender as 'user' | 'ai',
          text: m.sender === 'ai' ? sanitizeAiText(m.text) : m.text,
          timestamp: new Date(m.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          model: m.model || activeModelObj.name
        }));

        // Guard against a race: if the conversation got hydrated while we were
        // fetching (e.g. user sent a message), don't clobber it.
        setMessagesByConv(prev => {
          if (prev[activeConvId] !== undefined) return prev;
          return { ...prev, [activeConvId]: mapped };
        });
      } catch (err) {
        console.error("Erro ao carregar mensagens da conversa:", err);
        if (!cancelled) {
          setMessagesByConv(prev => (prev[activeConvId] !== undefined ? prev : { ...prev, [activeConvId]: [] }));
        }
      }
    };

    loadMessagesFromSql();
    return () => { cancelled = true; };
  }, [activeConvId, activeModelObj, messagesByConv, loadingConvIds]);

  const executeChatQuery = async (textToSend: string, overridePersonaId?: string) => {
    const promptText = textToSend.trim();
    if (!promptText) return;

    const activePersona = overridePersonaId || selectedPersona;
    const personaObj = personas.find(p => p.id === activePersona) || activePersonaObj;

    // Verifica saldo ANTES de enviar (sem debitar aqui). O débito real dos 5
    // OmniCoins acontece uma única vez no servidor (/api/chat → recordChatMetrics),
    // que possui a sessão e o tenant corretos. Debitar também no cliente causava
    // cobrança dupla.
    const selectedCompanyId = typeof window !== "undefined"
      ? (localStorage.getItem("omnizeus_active_company_id") || "")
      : "";
    const activeCompany = selectedCompanyId || "comp_zenitus";
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

    try {
      const settings = await fetchServerSettings();
      const savedKey = settings?.openrouter_api_key || null;
      const activeCompanyId = selectedCompanyId;

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(savedKey ? { "x-openrouter-key": savedKey } : {}),
          ...(activeCompanyId ? { "x-company-id": activeCompanyId } : {})
        },
        body: JSON.stringify({
          messages: [
            ...priorMessages.map(m => ({
              role: m.sender === 'user' ? 'user' : 'assistant',
              content: m.text
            })),
            { role: "user", content: promptText }
          ],
          model: personaObj.modelLlm || selectedModel,
          temperature: personaObj.temperature !== undefined ? personaObj.temperature : undefined,
          persona: activePersona,
          personaPrompt: personaObj.systemPrompt,
          clientApiKey: savedKey || undefined,
          conversationId: targetConvId
        }),
      });

      let aiResponseText = "";
      if (res.ok) {
        aiResponseText = await res.text();
      } else {
        throw new Error("Falha na rota de streaming");
      }

      // O servidor debitou os 5 coins; sincroniza o saldo em cache para a UI refletir.
      fetchCoinBalanceFromServer(activeCompany)
        .then(() => window.dispatchEvent(new Event("omnizeus_coins_change")))
        .catch(() => {});

      const aiMsg: Message = {
        id: res.headers.get("x-omni-message-id") || `msg_${Date.now() + 1}`,
        sender: "ai",
        text: sanitizeAiText(aiResponseText),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        model: activeModelObj.name
      };

      // Append to the correct conversation cache regardless of which conversation
      // the user is currently viewing (so responses never get lost).
      setMessagesByConv(prev => ({
        ...prev,
        [targetConvId]: [...(prev[targetConvId] || []), aiMsg]
      }));
    } catch (err) {
      const fallbackText = `Estamos enfrentando uma instabilidade temporária no servidor de IA.`;

      const aiMsg: Message = {
        id: `msg_${Date.now() + 1}`,
        sender: "ai",
        text: fallbackText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        model: activeModelObj.name
      };

      setMessagesByConv(prev => ({
        ...prev,
        [targetConvId]: [...(prev[targetConvId] || []), aiMsg]
      }));
    } finally {
      setLoadingConvIds(prev => ({ ...prev, [targetConvId]: false }));
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
    <div className="h-[calc(100vh-7rem)] flex bg-white rounded-xl border border-slate-200/80 overflow-hidden shadow-xs relative">
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

      {/* History Drawer Sidebar */}
      {showHistorySidebar && (
        <div className="w-72 border-r border-slate-200/80 bg-slate-50 flex flex-col z-20">
          <div className="p-3 border-b border-slate-200/80 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-primary" />
              Histórico
            </span>
            <button
              onClick={() => setShowHistorySidebar(false)}
              className="p-1 hover:bg-slate-200 rounded text-slate-500 transition-colors"
              title="Recolher histórico"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="p-3 border-b border-slate-200/80 bg-slate-100/50 space-y-3">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Nova Conversa</label>
              
              {/* Model Selector Dropdown Grouped by Provider */}
              <div className="flex items-center gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200/80 text-[11px] font-medium hover:border-slate-300 transition-colors">
                <Cpu className="w-3.5 h-3.5 text-primary shrink-0" />
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="bg-transparent font-bold text-slate-900 focus:outline-none flex-1 min-w-0 truncate cursor-pointer"
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

              {/* Persona Selector */}
              <div className="flex items-center gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200/80 text-[11px] font-medium hover:border-slate-300 transition-colors">
                <BookOpen className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                <select
                  value={selectedPersona}
                  onChange={(e) => setSelectedPersona(e.target.value)}
                  className="bg-transparent font-bold text-slate-900 focus:outline-none flex-1 min-w-0 cursor-pointer"
                >
                  {personas.map(p => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={handleNewConversation}
              className="w-full py-2 px-3 bg-primary hover:opacity-90 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-2 shadow-xs transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Iniciar Nova Consulta</span>
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {sortedConversations.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400">
                Nenhuma consulta salva. Clique acima em "Iniciar Nova Consulta".
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
                    className={`group relative p-2.5 rounded-lg text-xs font-medium cursor-pointer transition-all border ${
                      activeConvId === c.id 
                        ? 'bg-white border-slate-200/90 text-slate-900 shadow-xs font-bold' 
                        : 'bg-transparent border-transparent text-slate-600 hover:bg-white hover:border-slate-200/60'
                    }`}
                  >
                    {editingConvId === c.id ? (
                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          className="w-full px-2 py-1 bg-slate-50 border border-slate-300 rounded text-xs font-medium focus:outline-none focus:border-primary"
                          autoFocus
                          onKeyDown={(e) => e.key === 'Enter' && saveEditedTitle(c.id, e as any)}
                        />
                        <button 
                          onClick={(e) => saveEditedTitle(c.id, e)} 
                          className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                          title="Salvar"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setEditingConvId(null); }} 
                          className="p-1 text-slate-400 hover:bg-slate-100 rounded"
                          title="Cancelar"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between gap-1">
                          <div className="truncate flex-1 pr-2 flex items-center gap-1.5">
                            {c.isPinned && (
                              <Pin className="w-3 h-3 text-primary fill-[#1E6FD9] shrink-0" strokeWidth={1.75} />
                            )}
                            <span className="truncate">{c.title}</span>
                            {isConvLoading && (
                              <span className="relative flex h-2 w-2 shrink-0 ml-1" title="Processando análise em segundo plano...">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-[10px] text-slate-400 font-normal mt-0.5">{c.model}</div>

                        <div className="absolute right-2 top-2 hidden group-hover:flex items-center gap-1 bg-white/90 backdrop-blur-xs px-1 py-0.5 rounded border border-slate-200 shadow-xs">
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
                            <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
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

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Toolbar */}
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-0">
            {!showHistorySidebar && (
              <button
                onClick={() => setShowHistorySidebar(true)}
                className="p-2.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors text-xs font-semibold flex items-center justify-center shadow-xs"
                title="Abrir histórico de conversas"
              >
                <div className="flex flex-col justify-center items-center gap-[3px] w-4 h-4">
                  <span className="w-full h-[2px] bg-slate-600 rounded-full"></span>
                  <span className="w-full h-[2px] bg-slate-600 rounded-full"></span>
                  <span className="w-full h-[2px] bg-slate-600 rounded-full"></span>
                </div>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 px-2.5 py-1.5 rounded-lg border border-amber-200/60">
              <Coins className="w-3.5 h-3.5 text-amber-600" />
              <span>5 Coins / Consulta</span>
            </div>
          </div>
        </div>

        {/* Main Content Area: Welcome Cards Grid when no active chat/empty, or Chat Messages when active */}
        {!activeConvId || messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-xl mx-auto space-y-6 my-auto">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center shadow-2xs">
              <Sparkles className="w-8 h-8 text-primary" />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-lg font-bold text-[#0F172A]">Workspace Omni IA Hub</h2>
              <p className="text-xs text-slate-500 leading-relaxed">
                Consulte especialistas em contabilidade, fiscal/SPED, contratos e apresentações em linguagem natural com modelos de IA de ponta.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full pt-2">
              {SPECIALIST_CARDS.map(agent => (
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
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 shrink-0 mt-0.5" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex-1 px-4 sm:px-6 py-5 overflow-y-auto space-y-5 bg-[#FAFBFC]">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 max-w-2xl ${msg.sender === 'user' ? 'ml-auto flex-row-reverse' : ''}`}
              >
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs shrink-0 shadow-xs ${
                  msg.sender === 'user' ? 'bg-primary text-white' : 'bg-slate-900 text-white'
                }`}>
                  {msg.sender === 'user' ? <User className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
                </div>

                <div className="min-w-0 flex-1">
                  <div className={`p-4 rounded-xl text-sm leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-primary text-white rounded-tr-sm'
                      : 'bg-white border border-slate-200/80 text-slate-800 rounded-tl-sm shadow-xs'
                  }`}>
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                  </div>

                  <div className={`flex items-center gap-2.5 mt-1.5 text-[10px] text-slate-400 font-medium ${
                    msg.sender === 'user' ? 'justify-end' : ''
                  }`}>
                    <span>{msg.timestamp}</span>
                    {msg.model && (
                      <>
                        <span className="w-0.5 h-0.5 rounded-full bg-slate-300" />
                        <span>{msg.model}</span>
                      </>
                    )}
                    <button onClick={() => navigator.clipboard.writeText(msg.text)} className="p-1 hover:bg-slate-100 rounded transition-colors ml-2" title="Copiar texto">
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {Boolean(loadingConvIds[activeConvId]) && (
              <div className="flex gap-3 max-w-2xl">
                <div className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center text-xs shrink-0 shadow-xs">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <div className="p-4 rounded-xl bg-white border border-slate-200/80 text-xs text-slate-500 flex items-center gap-2 shadow-xs rounded-tl-sm">
                  <span className="flex gap-1 items-center h-4">
                    <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                    <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                    <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce"></span>
                  </span>
                  <span className="ml-1 text-slate-400 font-medium">Processando análise...</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Input Form Bar */}
        <div className="p-4 bg-white border-t border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="flex-1 relative">
              <input
                type="text"
                value={inputMessage}
                disabled={Boolean(loadingConvIds[activeConvId])}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !loadingConvIds[activeConvId] && inputMessage.trim()) {
                    handleSendMessage();
                  }
                }}
                placeholder={loadingConvIds[activeConvId] ? "Processando resposta... por favor aguarde." : "Digite sua dúvida tributária, fiscal ou operacional..."}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-primary focus:bg-white transition-all placeholder:text-slate-400 disabled:bg-slate-100 disabled:cursor-not-allowed"
              />
            </div>
            <button
              onClick={handleSendMessage}
              disabled={Boolean(loadingConvIds[activeConvId]) || !inputMessage.trim()}
              className="px-4 py-2.5 bg-primary hover:opacity-90 text-white text-xs font-semibold rounded-lg flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-xs"
            >
              <span className="hidden sm:inline">{loadingConvIds[activeConvId] ? "Gerando..." : "Enviar"}</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
