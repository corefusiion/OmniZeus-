"use client";

import { useState, useEffect } from "react";
import { 
  MessageSquare, 
  QrCode, 
  Kanban, 
  List, 
  Pin, 
  Trash2, 
  ArrowRightLeft, 
  ShieldAlert, 
  Search,
  Send,
  Sliders,
  Zap,
  Clock,
  X,
  FileText,
  CheckCircle2
} from "lucide-react";
import { getActiveRole, UserRole } from "@/lib/auth/roles";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

interface ChatConversation {
  id: string;
  clientName: string;
  cnpj: string;
  sector: string;
  stage: 'aguardando' | 'atendimento' | 'transferido' | 'finalizado';
  lastMessage: string;
  time: string;
  waitTime: string;
  isPinned: boolean;
  unreadCount: number;
}

const initialChats: ChatConversation[] = [
  { id: "c1", clientName: "Posto Shell Alvorada", cnpj: "12.345.678/0001-90", sector: "Fiscal", stage: "atendimento", lastMessage: "Enviei o comprovante do DAS em anexo.", time: "10:14", waitTime: "4m atrás", isPinned: true, unreadCount: 2 },
  { id: "c2", clientName: "Construtora Horizonte", cnpj: "98.765.432/0001-11", sector: "Jurídico", stage: "aguardando", lastMessage: "Preciso da minuta do contrato ajustada.", time: "09:45", waitTime: "32m atrás", isPinned: true, unreadCount: 1 },
  { id: "c3", clientName: "Restaurante Sabor Real", cnpj: "44.555.666/0001-22", sector: "DP / Folha", stage: "transferido", lastMessage: "Transferido para o setor de Folha de Pagamento.", time: "09:20", waitTime: "1h atrás", isPinned: false, unreadCount: 0 },
  { id: "c4", clientName: "Mercado Vila Nova", cnpj: "33.222.111/0001-44", sector: "Contábil", stage: "finalizado", lastMessage: "Balanço trimestral enviado com sucesso.", time: "Ontem", waitTime: "1d atrás", isPinned: false, unreadCount: 0 },
];

const BASE64_QR_SAMPLE = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160'><rect width='160' height='160' fill='%23ffffff'/><rect x='10' y='10' width='40' height='40' fill='%230F172A'/><rect x='20' y='20' width='20' height='20' fill='%23ffffff'/><rect x='110' y='10' width='40' height='40' fill='%230F172A'/><rect x='120' y='20' width='20' height='20' fill='%23ffffff'/><rect x='10' y='110' width='40' height='40' fill='%230F172A'/><rect x='20' y='120' width='20' height='20' fill='%23ffffff'/><rect x='60' y='20' width='20' height='10' fill='%231E6FD9'/><rect x='80' y='50' width='30' height='20' fill='%230F172A'/><rect x='60' y='80' width='40' height='20' fill='%231E6FD9'/><rect x='110' y='110' width='20' height='30' fill='%230F172A'/></svg>";

export default function WhatsAppBotPage() {
  const [role, setRole] = useState<UserRole>("gestor");
  const [viewMode, setViewMode] = useState<'lista' | 'kanban'>('kanban');
  const [activeTab, setActiveTab] = useState<'atendimento' | 'persona' | 'disparos'>('atendimento');
  const [chats, setChats] = useState<ChatConversation[]>(initialChats);
  const [selectedChatId, setSelectedChatId] = useState<string>("c1");
  const [inputMessage, setInputMessage] = useState("");
  const [showQrModal, setShowQrModal] = useState(false);
  const [deletingChatId, setDeletingChatId] = useState<string | null>(null);

  const [systemPrompt, setSystemPrompt] = useState("Você é o assistente virtual da Zenitus Contábil. Atenda os clientes com profissionalismo, solicitando o CNPJ e tirando dúvidas de impostos (DAS/DARF).");
  const [businessHours, setBusinessHours] = useState("08:00 - 18:00 (Segunda a Sexta)");
  const [autoReply, setAutoReply] = useState("Olá! O escritório Zenitus agradece seu contato. Nosso assistente de IA registrará seu atendimento imediatamente.");
  const [personaSavedNotice, setPersonaSavedNotice] = useState(false);

  const [dispatchType, setDispatchType] = useState<'das' | 'darf' | 'folha'>('das');
  const [targetClient, setTargetClient] = useState("Posto Shell Alvorada");
  const [dispatchSuccess, setDispatchSuccess] = useState(false);

  useEffect(() => {
    setRole(getActiveRole());
    const handleRoleChange = () => setRole(getActiveRole());
    window.addEventListener("omnizeus_role_change", handleRoleChange);
    return () => window.removeEventListener("omnizeus_role_change", handleRoleChange);
  }, []);

  const togglePin = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setChats(chats.map(c => c.id === id ? { ...c, isPinned: !c.isPinned } : c));
  };

  const openDeleteModal = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingChatId(id);
  };

  const confirmDeleteChat = () => {
    if (!deletingChatId) return;
    const updated = chats.filter(c => c.id !== deletingChatId);
    setChats(updated);
    if (selectedChatId === deletingChatId) setSelectedChatId(updated[0]?.id || "");
    setDeletingChatId(null);
  };

  const transferSector = (id: string, newSector: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setChats(chats.map(c => c.id === id ? { ...c, sector: newSector, stage: 'transferido' } : c));
  };

  const handleSendDirectMessage = () => {
    if (!inputMessage.trim()) return;
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setChats(chats.map(c => c.id === selectedChatId ? { 
      ...c, 
      lastMessage: inputMessage, 
      time: now,
      waitTime: "Agora",
      stage: 'atendimento'
    } : c));
    setInputMessage("");
  };

  const handleSimulateDispatch = () => {
    setDispatchSuccess(true);
    setTimeout(() => setDispatchSuccess(false), 3000);
  };

  const handleSavePersona = () => {
    setPersonaSavedNotice(true);
    setTimeout(() => setPersonaSavedNotice(false), 2500);
  };

  const activeChat = chats.find(c => c.id === selectedChatId);

  return (
    <div className="space-y-6 text-slate-900 font-sans">
      {/* Elegant Deletion Confirmation Modal */}
      <ConfirmModal
        isOpen={deletingChatId !== null}
        onClose={() => setDeletingChatId(null)}
        onConfirm={confirmDeleteChat}
        title="Excluir Atendimento do WhatsApp?"
        description="Esta conversa e o histórico de mensagens serão removidos permanentemente do fluxo do Kanban."
        confirmText="Excluir Atendimento"
        cancelText="Cancelar"
        variant="danger"
      />

      {/* Header Toolbar */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs transition-all hover:border-slate-300 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
            WhatsApp Bot & Live Chat Multi-Setor
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Evolution API, leitor QR Code, gestão Kanban por estágios e automação de disparos tributários
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-2">
          <div className="bg-slate-50 border border-slate-200/80 p-1 rounded-xl flex items-center gap-1">
            <button
              onClick={() => setActiveTab('atendimento')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
                activeTab === 'atendimento' ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <MessageSquare className="w-4 h-4" strokeWidth={1.75} />
              <span>Atendimentos</span>
            </button>
            <button
              onClick={() => setActiveTab('persona')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
                activeTab === 'persona' ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Sliders className="w-4 h-4" strokeWidth={1.75} />
              <span>Persona IA</span>
            </button>
            <button
              onClick={() => setActiveTab('disparos')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
                activeTab === 'disparos' ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Zap className="w-4 h-4" strokeWidth={1.75} />
              <span>Disparos Automáticos</span>
            </button>
          </div>

          {activeTab === 'atendimento' && (
            <div className="bg-slate-50 border border-slate-200/80 p-1 rounded-xl flex items-center gap-1">
              <button
                onClick={() => setViewMode('kanban')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
                  viewMode === 'kanban' ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Kanban className="w-4 h-4" strokeWidth={1.75} />
                <span>Kanban</span>
              </button>
              <button
                onClick={() => setViewMode('lista')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
                  viewMode === 'lista' ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <List className="w-4 h-4" strokeWidth={1.75} />
                <span>Lista</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* QR Code & Evolution API Status Banner */}
      {role !== "funcionario" ? (
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-slate-900 text-white rounded-xl p-2 flex flex-col items-center justify-center shadow-xs">
              <QrCode className="w-6 h-6 text-emerald-400" strokeWidth={1.75} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-xs" />
                <h3 className="text-sm font-bold">Instância Evolution API Conectada</h3>
                <span className="text-[10px] bg-slate-50 border border-slate-200 text-slate-600 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Gestão
                </span>
              </div>
              <p className="text-xs font-medium text-slate-500 mt-1 flex items-center gap-1.5">
                Instância: <code className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 font-mono text-slate-800">zenitus-whatsapp-prod</code> • Número: +55 (71) 99882-1020 • Status: CONNECTED
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowQrModal(true)}
            className="px-4 py-2 bg-slate-50 border border-slate-200/80 hover:bg-slate-100 text-slate-900 text-xs font-semibold rounded-lg flex items-center gap-2 transition-all shadow-xs"
          >
            <QrCode className="w-4 h-4 text-slate-600" strokeWidth={1.75} />
            <span>Ver QR Code Base64</span>
          </button>
        </div>
      ) : (
        <div className="bg-slate-50 border border-slate-200/80 p-4 rounded-xl text-xs font-medium text-slate-500 flex items-center gap-2 shadow-xs">
          <ShieldAlert className="w-4 h-4 text-amber-500" strokeWidth={1.75} />
          <span>Informação de segurança: Os parâmetros da instância Evolution API e leitor de QR Code são visíveis apenas para a Gestão.</span>
        </div>
      )}

      {/* Base64 QR Code Modal */}
      {showQrModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200/80 p-6 max-w-md w-full shadow-lg relative">
            <button
              onClick={() => setShowQrModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-900 transition-colors"
            >
              <X className="w-5 h-5" strokeWidth={1.75} />
            </button>
            <h3 className="text-base font-bold flex items-center gap-2">
              <QrCode className="w-5 h-5 text-primary" strokeWidth={1.75} />
              <span>Leitor de QR Code Base64</span>
            </h3>
            <p className="text-xs font-medium text-slate-500 mt-1">Escaneie com o WhatsApp da empresa para re-autenticar a sessão.</p>

            <div className="my-6 flex justify-center bg-slate-50 p-6 rounded-xl border border-slate-200/80 shadow-inner">
              <img src={BASE64_QR_SAMPLE} alt="Evolution QR Code Base64" className="w-40 h-40 border border-slate-200 rounded-lg shadow-xs bg-white" />
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 text-xs font-mono space-y-1 text-slate-500">
              <p>State: <strong className="text-emerald-600">open</strong></p>
              <p>Endpoint: <span className="text-slate-900">https://api.whatsapp.zenitus.com.br</span></p>
            </div>

            <button
              onClick={() => setShowQrModal(false)}
              className="mt-5 w-full py-2 bg-primary hover:opacity-90 text-white text-xs font-semibold rounded-lg shadow-xs transition-all"
            >
              Fechar Modal
            </button>
          </div>
        </div>
      )}

      {/* Main Tab Views */}
      {activeTab === 'atendimento' && (
        viewMode === 'kanban' ? (
          /* Kanban Board View */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {(['aguardando', 'atendimento', 'transferido', 'finalizado'] as const).map((stage) => {
              const stageLabels = {
                aguardando: { title: "Aguardando", color: "border-amber-400 bg-amber-50/50 text-amber-700" },
                atendimento: { title: "Em Atendimento", color: "border-blue-400 bg-primary/10/50 text-primary" },
                transferido: { title: "Transferido", color: "border-purple-400 bg-purple-50/50 text-purple-700" },
                finalizado: { title: "Finalizado", color: "border-emerald-400 bg-emerald-50/50 text-emerald-700" }
              };
              const filtered = chats.filter(c => c.stage === stage);

              return (
                <div key={stage} className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs flex flex-col gap-3">
                  <div className={`px-3 py-2 rounded-lg border-l-4 flex items-center justify-between ${stageLabels[stage].color}`}>
                    <span className="text-[10px] font-bold uppercase tracking-wider">{stageLabels[stage].title}</span>
                    <span className="text-xs font-bold bg-white px-2 py-0.5 rounded-full border border-slate-200/80 text-slate-500 shadow-xs">{filtered.length}</span>
                  </div>

                  <div className="space-y-3 flex-1">
                    {filtered.map(chat => (
                      <div
                        key={chat.id}
                        onClick={() => setSelectedChatId(chat.id)}
                        className={`p-4 rounded-xl border cursor-pointer transition-all hover:shadow-md group relative ${
                          selectedChatId === chat.id ? 'border-primary ring-1 ring-[#1E6FD9] bg-slate-50/50' : 'border-slate-200/80 bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-bold text-sm truncate pr-2">{chat.clientName}</span>
                          {chat.isPinned && <Pin className="w-3.5 h-3.5 text-primary fill-[#1E6FD9]" strokeWidth={1.75} />}
                        </div>
                        <span className="text-[10px] font-medium text-slate-500 block mb-3 uppercase tracking-wider">{chat.cnpj} • <strong className="text-slate-700">{chat.sector}</strong></span>
                        <p className="text-xs font-medium text-slate-600 line-clamp-2 leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-200/80">
                          "{chat.lastMessage}"
                        </p>

                        {/* Controls & Wait Time Badge */}
                        <div className="mt-4 pt-3 border-t border-slate-200/80 flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          <span className="flex items-center gap-1 text-slate-500">
                            <Clock className="w-3 h-3 text-slate-400" />
                            {chat.waitTime}
                          </span>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={(e) => togglePin(chat.id, e)} title="Fixar Conversa" className="p-1.5 rounded-lg hover:bg-slate-100 hover:text-primary transition-colors">
                              <Pin className="w-3.5 h-3.5" strokeWidth={1.75} />
                            </button>
                            <button onClick={(e) => transferSector(chat.id, "DP / Folha", e)} title="Transferir para Folha" className="p-1.5 rounded-lg hover:bg-slate-100 hover:text-purple-600 transition-colors">
                              <ArrowRightLeft className="w-3.5 h-3.5" strokeWidth={1.75} />
                            </button>
                            <button onClick={(e) => openDeleteModal(chat.id, e)} title="Excluir" className="p-1.5 rounded-lg hover:bg-red-50 hover:text-red-600 transition-colors">
                              <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Traditional Chat List View */
          <div className="h-[600px] flex bg-white rounded-xl border border-slate-200/80 overflow-hidden shadow-xs">
            {/* Chat List Sidebar */}
            <div className="w-80 border-r border-slate-200/80 flex flex-col bg-slate-50">
              <div className="p-4 border-b border-slate-200/80">
                <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-slate-200/80 shadow-xs focus-within:border-slate-300 focus-within:ring-1 focus-within:ring-slate-300 transition-all">
                  <Search className="w-4 h-4 text-slate-400" strokeWidth={1.75} />
                  <input type="text" placeholder="Buscar cliente..." className="w-full text-xs font-medium placeholder:text-slate-400 focus:outline-none" />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-slate-200/80">
                {chats.map(chat => (
                  <div
                    key={chat.id}
                    onClick={() => setSelectedChatId(chat.id)}
                    className={`p-4 cursor-pointer transition-all hover:bg-white ${
                      selectedChatId === chat.id ? 'bg-white border-l-4 border-l-[#1E6FD9]' : 'border-l-4 border-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-sm truncate">{chat.clientName}</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0">{chat.time}</span>
                    </div>
                    <p className="text-xs font-medium text-slate-500 truncate">{chat.lastMessage}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Active Conversation Detail */}
            <div className="flex-1 flex flex-col bg-white">
              {activeChat ? (
                <>
                  <div className="p-5 border-b border-slate-200/80 flex items-center justify-between bg-white shadow-xs z-10">
                    <div>
                      <h3 className="font-bold text-base">{activeChat.clientName}</h3>
                      <p className="text-xs font-medium text-slate-500 mt-0.5">{activeChat.cnpj} • Setor: {activeChat.sector}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold uppercase tracking-wider rounded-full shadow-xs">
                        Persona IA Ativa
                      </span>
                    </div>
                  </div>

                  <div className="flex-1 p-5 space-y-4 overflow-y-auto bg-slate-50/50">
                    <div className="max-w-md p-4 bg-white border border-slate-200/80 rounded-xl shadow-xs">
                      <p className="text-sm font-medium leading-relaxed">{activeChat.lastMessage}</p>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mt-2">{activeChat.time} • Cliente</span>
                    </div>
                  </div>

                  <div className="p-4 border-t border-slate-200/80 bg-white flex items-center gap-3">
                    <input
                      type="text"
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendDirectMessage()}
                      placeholder="Escreva uma resposta oficial no WhatsApp..."
                      className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200/80 rounded-lg text-sm font-medium focus:outline-none focus:border-slate-300 focus:ring-1 focus:ring-slate-300 transition-all shadow-inner"
                    />
                    <button 
                      onClick={handleSendDirectMessage}
                      className="px-5 py-2.5 bg-primary hover:opacity-90 text-white text-xs font-semibold rounded-lg flex items-center gap-2 shadow-xs transition-colors"
                    >
                      <span>Enviar</span>
                      <Send className="w-4 h-4" strokeWidth={1.75} />
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-sm font-medium text-slate-400 bg-slate-50/50">
                  Selecione uma conversa para visualizar
                </div>
              )}
            </div>
          </div>
        )
      )}

      {/* Tab 2: Persona IA Config */}
      {activeTab === 'persona' && (
        <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all space-y-6">
          <h2 className="text-base font-extrabold border-b border-slate-200/80 pb-4 flex items-center gap-2">
            <Sliders className="w-5 h-5 text-primary" strokeWidth={1.75} />
            <span>Configuração da Persona de Atendimento do WhatsApp Bot</span>
          </h2>

          {personaSavedNotice && (
            <div className="p-3 bg-emerald-50 border border-emerald-200/60 text-emerald-800 text-xs font-semibold rounded-xl flex items-center gap-2 shadow-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Persona de IA do WhatsApp atualizada com sucesso no banco de dados!</span>
            </div>
          )}

          <div className="space-y-5 max-w-3xl">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-2">System Prompt da Persona IA (Comportamento):</label>
              <textarea
                rows={4}
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200/80 rounded-xl text-sm font-medium focus:outline-none focus:border-slate-300 focus:ring-1 focus:ring-slate-300 transition-all shadow-inner"
              />
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-2">Horário Oficial de Atendimento:</label>
              <input
                type="text"
                value={businessHours}
                onChange={(e) => setBusinessHours(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200/80 rounded-lg text-sm font-medium focus:outline-none focus:border-slate-300 focus:ring-1 focus:ring-slate-300 transition-all shadow-inner"
              />
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-2">Resposta Automática Inicial:</label>
              <textarea
                rows={2}
                value={autoReply}
                onChange={(e) => setAutoReply(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200/80 rounded-xl text-sm font-medium focus:outline-none focus:border-slate-300 focus:ring-1 focus:ring-slate-300 transition-all shadow-inner"
              />
            </div>

            <button
              onClick={handleSavePersona}
              className="px-5 py-2.5 bg-primary hover:opacity-90 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
            >
              Salvar Alterações da Persona
            </button>
          </div>
        </div>
      )}

      {/* Tab 3: Disparos Automáticos Simulator */}
      {activeTab === 'disparos' && (
        <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all space-y-6">
          <h2 className="text-base font-extrabold border-b border-slate-200/80 pb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" strokeWidth={1.75} />
            <span>Simulador de Disparos Automáticos de Impostos & Folha</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-5">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-2">Tipo de Disparo Automático:</label>
                <select
                  value={dispatchType}
                  onChange={(e) => setDispatchType(e.target.value as any)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200/80 rounded-lg text-sm font-semibold focus:outline-none focus:border-slate-300 focus:ring-1 focus:ring-slate-300 transition-all shadow-inner"
                >
                  <option value="das">Disparo Guia DAS (Simples Nacional)</option>
                  <option value="darf">Disparo DARF (Lucro Presumido)</option>
                  <option value="folha">Disparo Holerites & Folha de Pagamento</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-2">Cliente Destinatário:</label>
                <select
                  value={targetClient}
                  onChange={(e) => setTargetClient(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200/80 rounded-lg text-sm font-medium focus:outline-none focus:border-slate-300 focus:ring-1 focus:ring-slate-300 transition-all shadow-inner"
                >
                  <option value="Posto Shell Alvorada">Posto Shell Alvorada Ltda</option>
                  <option value="Construtora Horizonte">Construtora Horizonte S/A</option>
                  <option value="Restaurante Sabor Real">Restaurante Sabor Real</option>
                </select>
              </div>

              <button
                onClick={handleSimulateDispatch}
                className="w-full py-3 bg-primary hover:opacity-90 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-all shadow-xs"
              >
                <Send className="w-4 h-4" strokeWidth={1.75} />
                <span>Simular Disparo via Evolution API</span>
              </button>

              {dispatchSuccess && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center gap-3 shadow-xs">
                  <span className="text-sm font-semibold">Mensagem e PDF disparados com sucesso para {targetClient}!</span>
                </div>
              )}
            </div>

            {/* Preview Card */}
            <div className="bg-slate-50 p-5 rounded-xl border border-slate-200/80 shadow-inner">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-3 flex items-center gap-2">
                <FileText className="w-3.5 h-3.5" strokeWidth={1.75} />
                Pré-visualização da Mensagem WhatsApp
              </span>
              <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs space-y-3">
                <p className="font-semibold text-sm">Prezado(a) responsável por {targetClient},</p>
                <p className="text-sm font-medium text-slate-600 leading-relaxed">
                  Sua guia do <strong>{dispatchType.toUpperCase()}</strong> referente ao período atual foi gerada com sucesso pela equipe da <strong>Zenitus Contábil</strong>.
                </p>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400 pt-2 border-t border-slate-100">Documento PDF anexado via Evolution API. Vencimento em 20/08/2026.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
