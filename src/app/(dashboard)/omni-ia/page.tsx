"use client";

import { useState, useEffect } from "react";
import { 
  Sparkles, Send, Bot, User, RefreshCw, Cpu, BookOpen, Coins, 
  Copy, Trash2, Plus, History, ChevronRight, Layers, Pin, Edit2, Check, X
} from "lucide-react";
import { deductCoins } from "@/lib/coins/store";
import { sqlDb, getLocalSqlDb } from "@/lib/db/sqlite";
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

// 15 Newest 2026 Frontier LLMs organized by Providers (3 top models per provider)
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

export default function OmniIAPage() {
  const [selectedModel, setSelectedModel] = useState(allModelsList[3].id);
  const [personas, setPersonas] = useState<CustomAgent[]>([]);
  const [selectedPersona, setSelectedPersona] = useState<string>("agente_geral");
  const [inputMessage, setInputMessage] = useState("");
  const [loadingConvId, setLoadingConvId] = useState<string | null>(null);
  const [showHistorySidebar, setShowHistorySidebar] = useState(true);
  const [activeConvId, setActiveConvId] = useState<string>("conv_1");

  const [editingConvId, setEditingConvId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string>("");

  // Elegant Confirmation Modal States
  const [deletingConvId, setDeletingConvId] = useState<string | null>(null);
  const [showNoCoinsModal, setShowNoCoinsModal] = useState(false);

  const [conversations, setConversations] = useState<ConversationItem[]>([
    { id: 'conv_1', title: 'Dúvida Simples Nacional - Fator R', model: 'Claude 4.8 Sonnet', isPinned: true }
  ]);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "msg_1",
      sender: "ai",
      text: "Olá, Carlos! Sou o cérebro do OmniIA Hub. Como posso auxiliar o escritório Zenitus Contábil hoje? Selecione um dos modelos de ponta (GPT-5.5, Claude 4.8 Sonnet, Gemini 3.6 Pro, DeepSeek V4) no menu superior.",
      timestamp: "09:00",
      model: "Claude 4.8 Sonnet"
    }
  ]);

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
            if (activeConvs[0].persona) {
              setSelectedPersona(activeConvs[0].persona);
            }
          }
        }
      } catch (err) {
        console.error("Erro ao carregar conversas do SQLite serverDb:", err);
      }
    };

    loadConversationsFromSql();

    // Load dynamic custom agents
    setPersonas(getCustomAgents());
    const handleAgentsChange = () => setPersonas(getCustomAgents());
    window.addEventListener("omnizeus_agents_change", handleAgentsChange);
    return () => window.removeEventListener("omnizeus_agents_change", handleAgentsChange);
  }, []);

  // Listen to Active Conversation Changes and Load Messages & Sync Persona
  useEffect(() => {
    if (!activeConvId) return;

    const loadMessagesFromSql = async () => {
      try {
        const convRecords = await fetchServerTable('conversations');
        const conv = convRecords.find((c: any) => c.id === activeConvId);
        if (conv && conv.persona) {
          setSelectedPersona(conv.persona);
        }

        const msgRecords = await fetchServerTable('messages');
        const msgs = msgRecords.filter((m: any) => m.conversation_id === activeConvId);

        if (msgs.length > 0) {
          const sortedMsgs = [...msgs].sort((a, b) => new Date(a.created_at || Date.now()).getTime() - new Date(b.created_at || Date.now()).getTime());
          setMessages(sortedMsgs.map((m: any) => ({
            id: m.id,
            sender: m.sender as 'user' | 'ai',
            text: m.text,
            timestamp: new Date(m.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            model: m.model || activeModelObj.name
          })));
        } else {
          const modelName = conv?.model || activeModelObj.name;
          setMessages([{
            id: `msg_init_${Date.now()}`,
            sender: "ai",
            text: `Sessão iniciada com o modelo ${modelName}. Como posso ajudar?`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            model: modelName
          }]);
        }
      } catch (err) {
        console.error("Erro ao carregar mensagens da conversa no SQLite serverDb:", err);
      }
    };

    loadMessagesFromSql();
  }, [activeConvId, activeModelObj]);


  const handleSendMessage = async () => {
    if (!inputMessage.trim() || loadingConvId === activeConvId) return;

    // Check & Deduct OmniCoins (5 Coins = R$ 0,50)
    const success = deductCoins(5, `Consulta Chat OmniIA (${activeModelObj.name})`);
    if (!success) {
      setShowNoCoinsModal(true);
      return;
    }

    const currentInput = inputMessage;
    const currentConvId = activeConvId;
    const userMsg: Message = {
      id: `msg_${Date.now()}`,
      sender: "user",
      text: currentInput,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    await insertServerTable('messages', {
      id: userMsg.id,
      conversation_id: currentConvId,
      sender: 'user',
      text: currentInput,
      model: activeModelObj.name,
      created_at: new Date().toISOString()
    });

    setMessages(prev => [...prev, userMsg]);
    setInputMessage("");
    setLoadingConvId(currentConvId);

    try {
      const settings = await fetchServerSettings();
      const savedKey = settings?.openrouter_api_key || null;

      // Call Edge Proxy Endpoint
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...(savedKey ? { "x-openrouter-key": savedKey } : {})
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: currentInput }],
          model: selectedModel,
          persona: selectedPersona,
          personaPrompt: activePersonaObj.systemPrompt,
          clientApiKey: savedKey || undefined,
          conversationId: currentConvId
        }),
      });

      let aiResponseText = "";
      if (res.ok) {
        aiResponseText = await res.text();
      } else {
        throw new Error("Falha na rota de streaming");
      }

      const aiMsg: Message = {
        id: `msg_${Date.now() + 1}`,
        sender: "ai",
        text: aiResponseText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        model: activeModelObj.name
      };

      setMessages(prev => [...prev, aiMsg]);
      
      // O salvamento no banco agora é feito diretamente pelo backend para garantir persistência 
      // mesmo que a página seja atualizada durante o processamento da IA.

    } catch (err) {
      const fallbackText = `Estamos offline no momento.`;

      const aiMsg: Message = {
        id: `msg_${Date.now() + 1}`,
        sender: "ai",
        text: fallbackText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        model: activeModelObj.name
      };

      setMessages(prev => [...prev, aiMsg]);
    } finally {
      setLoadingConvId(prev => prev === currentConvId ? null : prev);
    }
  };

  const handleNewConversation = () => {
    const newId = `conv_${Date.now()}`;
    const newTitle = activePersonaObj.label || `Nova Consulta (${activeModelObj.name})`;
    const newConv: ConversationItem = { id: newId, title: newTitle, model: activeModelObj.name, isPinned: false };
    setConversations([newConv, ...conversations]);
    setActiveConvId(newId);
    sqlDb.insert('conversations', {
      id: newId,
      title: newConv.title,
      model: activeModelObj.name,
      persona: selectedPersona,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    setMessages([{
      id: `msg_${Date.now()}`,
      sender: "ai",
      text: `Nova sessão iniciada com o agente ${activePersonaObj.label}. Como posso ajudar?`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      model: activeModelObj.name
    }]);
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
    
    // Delete in SQL DB local storage
    sqlDb.deleteConversation(deletingConvId);

    const updated = conversations.filter(c => c.id !== deletingConvId);
    setConversations(updated);
    if (activeConvId === deletingConvId && updated.length > 0) {
      setActiveConvId(updated[0].id);
    }
    setDeletingConvId(null);
  };

  // Sort conversations: Pinned items first
  const sortedConversations = [...conversations].sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0));

  return (
    <div className="h-[calc(100vh-7rem)] flex bg-white rounded-xl border border-slate-200/80 overflow-hidden shadow-xs relative">
      {/* Elegant Deletion Confirmation Modal */}
      <ConfirmModal
        isOpen={deletingConvId !== null}
        onClose={() => setDeletingConvId(null)}
        onConfirm={confirmDeleteConversation}
        title="Excluir Consulta do Histórico?"
        description="Esta conversa será removida permanentemente do banco de dados local da Zenitus. Esta ação não poderá ser desfeita."
        confirmText="Excluir Consulta"
        cancelText="Cancelar"
        variant="danger"
      />

      {/* Elegant Insufficient Coins Modal */}
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
              Histórico (SQL Local)
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

              {/* Persona Selector (Dynamic Custom Agents) */}
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
            {sortedConversations.map(c => (
              <div
                key={c.id}
                onClick={() => setActiveConvId(c.id)}
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
                        {loadingConvId === c.id && (
                          <span className="relative flex h-1.5 w-1.5 shrink-0 ml-1" title="Processando resposta...">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary"></span>
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-[10px] text-slate-400 font-normal mt-0.5">{c.model}</div>

                    {/* Quick Action Buttons (Pin, Edit, Delete) on Hover */}
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
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Toolbar */}
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-0">
            <button
              onClick={() => setShowHistorySidebar(!showHistorySidebar)}
              className="p-2 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors text-xs font-semibold flex items-center gap-1.5 shadow-xs"
              title="Alternar histórico de conversas"
            >
              <History className="w-4 h-4 text-primary" />
              <span className="hidden sm:inline">Histórico</span>
            </button>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Cost Badge */}
            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 px-2.5 py-1.5 rounded-lg border border-amber-200/60">
              <Coins className="w-3.5 h-3.5 text-amber-600" />
              <span>5 Coins / Consulta</span>
            </div>
          </div>
        </div>

        {/* Messages Stream Container */}
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

          {loadingConvId === activeConvId && (
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

        {/* Input Form Bar */}
        <div className="p-4 bg-white border-t border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="flex-1 relative">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Digite sua dúvida tributária, fiscal ou operacional..."
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-primary focus:bg-white transition-all placeholder:text-slate-400"
              />
            </div>
            <button
              onClick={handleSendMessage}
              disabled={loadingConvId === activeConvId || !inputMessage.trim()}
              className="px-4 py-2.5 bg-primary hover:opacity-90 text-white text-xs font-semibold rounded-lg flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-xs"
            >
              <span className="hidden sm:inline">Enviar</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
