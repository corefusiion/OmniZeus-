"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  FileCheck, Plus, CheckCircle2, XCircle, Clock, Search, Filter, 
  ShoppingBag, Coins, ShieldAlert, ArrowUpRight, Check, X, FileText, Edit2, MessageSquare, Trash2
} from "lucide-react";
import { getActiveRole, UserRole } from "@/lib/auth/roles";
import { addCoins } from "@/lib/coins/store";
import { fetchPurchaseRequests, insertPurchaseRequest, updatePurchaseRequest, deletePurchaseRequest } from "@/lib/db/serverDb";

export interface PurchaseRequest {
  id: string;
  reqNumber: string;
  requesterName: string;
  requesterRole: 'gestor' | 'funcionario';
  department: string;
  type: 'compra_material' | 'recarga_coins' | 'servico_terceiro';
  description: string;
  valueBrl: number;
  coinsAmount?: number;
  status: 'Pendente' | 'Aprovado' | 'Recusado';
  createdAt: string;
  approvedBy?: string;
  approvedAt?: string;
  managerObservation?: string;
  rejectionReason?: string;
  rejectedBy?: string;
  rejectedAt?: string;
}

const DEFAULT_REQUESTS: PurchaseRequest[] = [
  {
    id: "req_201",
    reqNumber: "REQ-2026-001",
    requesterName: "Juliana Lima",
    requesterRole: "funcionario",
    department: "Operações Tributárias",
    type: "compra_material",
    description: "Aquisição de Certificado Digital A1 e leitor de cartão para cliente Alfa Logística",
    valueBrl: 250.00,
    status: "Pendente",
    createdAt: new Date(Date.now() - 86400000).toISOString()
  },
  {
    id: "req_202",
    reqNumber: "REQ-2026-002",
    requesterName: "Carlos Mendes",
    requesterRole: "gestor",
    department: "Diretoria Fiscal",
    type: "recarga_coins",
    description: "Inclusão de Pacote de 5.000 OmniCoins para análises de SPED e relatórios fiscais",
    valueBrl: 490.00,
    coinsAmount: 5000,
    status: "Aprovado",
    createdAt: new Date(Date.now() - 172800000).toISOString(),
    approvedBy: "Carlos Mendes (Gestor)",
    approvedAt: new Date(Date.now() - 170000000).toISOString(),
    managerObservation: "Aprovado verba para consumo dos assistentes fiscais."
  },
  {
    id: "req_203",
    reqNumber: "REQ-2026-003",
    requesterName: "Juliana Lima",
    requesterRole: "funcionario",
    department: "Operações Tributárias",
    type: "servico_terceiro",
    description: "Consultoria jurídica societária externa para alteração de contrato social complexa",
    valueBrl: 1200.00,
    status: "Pendente",
    createdAt: new Date(Date.now() - 43200000).toISOString()
  }
];

function normalizeRequest(item: any): PurchaseRequest {
  let rawStatus = String(item.status || "Pendente").trim();
  let status: 'Pendente' | 'Aprovado' | 'Recusado' = 'Pendente';
  if (rawStatus.toLowerCase() === 'aprovado') status = 'Aprovado';
  else if (rawStatus.toLowerCase() === 'recusado' || rawStatus.toLowerCase() === 'reprovado') status = 'Recusado';
  else status = 'Pendente';

  return {
    id: item.id || `req_${Date.now()}_${Math.random()}`,
    reqNumber: item.reqNumber || item.req_number || `REQ-2026-${Math.floor(Math.random()*900+100)}`,
    requesterName: item.requesterName || item.requester_name || "Solicitante",
    requesterRole: item.requesterRole || item.requester_role || "gestor",
    department: item.department || "Operações Tributárias",
    type: item.type || "compra_material",
    description: item.description || "",
    valueBrl: Number(item.valueBrl ?? item.value_brl ?? 0),
    coinsAmount: item.coinsAmount ?? item.coins_amount,
    status: status,
    createdAt: item.createdAt || item.created_at || new Date().toISOString(),
    approvedBy: item.approvedBy || item.approved_by,
    approvedAt: item.approvedAt || item.approved_at,
    managerObservation: item.managerObservation || item.manager_observation,
    rejectionReason: item.rejectionReason || item.rejection_reason,
    rejectedBy: item.rejectedBy || item.rejected_by,
    rejectedAt: item.rejectedAt || item.rejected_at
  };
}

export default function SolicitacoesPage() {
  const [role, setRole] = useState<UserRole>("gestor");
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  // Filters
  const [filterStatus, setFilterStatus] = useState<'Todos' | 'Pendente' | 'Aprovado' | 'Recusado'>('Todos');
  const [filterDepartment, setFilterDepartment] = useState<string>('Todos');
  const [filterType, setFilterType] = useState<string>('Todos');
  const [search, setSearch] = useState("");

  // Drawer Details State
  const [selectedDetailReq, setSelectedDetailReq] = useState<PurchaseRequest | null>(null);

  // Approval Modal State
  const [approvingReqId, setApprovingReqId] = useState<string | null>(null);
  const [managerObservationInput, setManagerObservationInput] = useState("");

  // Rejection Modal State (Mandatory Reason)
  const [rejectingReqId, setRejectingReqId] = useState<string | null>(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState("");
  const [rejectionObsInput, setRejectionObsInput] = useState("");

  // New & Edit Request State
  const [showNewModal, setShowNewModal] = useState(false);
  const [editingReqId, setEditingReqId] = useState<string | null>(null);
  const [reqType, setReqType] = useState<'compra_material' | 'recarga_coins' | 'servico_terceiro'>('recarga_coins');
  const [reqDepartment, setReqDepartment] = useState('Operações Tributárias');
  const [reqDesc, setReqDesc] = useState("");
  const [reqValue, setReqValue] = useState("490,00");
  const [reqCoins, setReqCoins] = useState(5000);

  // Success Notification
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

  useEffect(() => {
    setRole(getActiveRole());
    loadRequests();

    const handleRoleChange = () => setRole(getActiveRole());
    window.addEventListener("omnizeus_role_change", handleRoleChange);
    return () => window.removeEventListener("omnizeus_role_change", handleRoleChange);
  }, []);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const data = await fetchPurchaseRequests();
      if (Array.isArray(data) && data.length > 0) {
        const uniqueMap = new Map<string, PurchaseRequest>();
        data.forEach((item: any) => {
          const norm = normalizeRequest(item);
          const key = `${norm.reqNumber}_${norm.requesterName}_${norm.description}`;
          if (!uniqueMap.has(key)) {
            uniqueMap.set(key, norm);
          }
        });
        setRequests(Array.from(uniqueMap.values()));
      } else {
        for (const req of DEFAULT_REQUESTS) {
          await insertPurchaseRequest(req);
        }
        setRequests(DEFAULT_REQUESTS);
      }
    } catch (e) {
      console.error("Error loading purchase requests from serverDb:", e);
      setRequests(DEFAULT_REQUESTS);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreateModal = () => {
    setEditingReqId(null);
    setReqType('recarga_coins');
    setReqDepartment(role === 'gestor' ? 'Diretoria Fiscal' : 'Operações Tributárias');
    setReqDesc('');
    setReqValue('490,00');
    setReqCoins(5000);
    setShowNewModal(true);
  };

  const handleOpenEditModal = (req: PurchaseRequest) => {
    setEditingReqId(req.id);
    setReqType(req.type);
    setReqDepartment(req.department);
    setReqDesc(req.description);
    setReqValue(req.valueBrl.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
    if (req.coinsAmount) setReqCoins(req.coinsAmount);
    setShowNewModal(true);
  };

  const handleSaveRequest = async () => {
    if (!reqDesc.trim()) return;

    const valNum = parseFloat(reqValue.replace(/\./g, '').replace(',', '.')) || 0;

    if (editingReqId) {
      const existing = requests.find(r => r.id === editingReqId);
      const updatedReq: PurchaseRequest = {
        ...existing!,
        type: reqType,
        department: reqDepartment,
        description: reqDesc.trim(),
        valueBrl: valNum,
        coinsAmount: reqType === 'recarga_coins' ? reqCoins : undefined
      };

      await updatePurchaseRequest(updatedReq);
      setRequests(prev => prev.map(r => r.id === editingReqId ? updatedReq : r));
      setNoticeMessage("Solicitação atualizada e salva no servidor SQLite!");
    } else {
      const count = requests.length + 1;
      const reqNum = `REQ-2026-${String(count).padStart(3, '0')}`;

      const newReq: PurchaseRequest = {
        id: `req_${Date.now()}`,
        reqNumber: reqNum,
        requesterName: role === 'gestor' ? 'Carlos Mendes' : 'Juliana Lima',
        requesterRole: role === 'gestor' ? 'gestor' : 'funcionario',
        department: reqDepartment,
        type: reqType,
        description: reqDesc.trim(),
        valueBrl: valNum,
        coinsAmount: reqType === 'recarga_coins' ? reqCoins : undefined,
        status: 'Pendente',
        createdAt: new Date().toISOString()
      };

      await insertPurchaseRequest(newReq);
      setRequests(prev => [newReq, ...prev]);
      setNoticeMessage(`Solicitação ${reqNum} enviada e registrada no servidor SQLite!`);
    }

    setReqDesc("");
    setShowNewModal(false);
    setTimeout(() => setNoticeMessage(null), 3000);
  };

  const handleConfirmApproval = async () => {
    if (!approvingReqId) return;

    const reqToApprove = requests.find(r => r.id === approvingReqId);
    if (!reqToApprove) return;

    if (reqToApprove.type === 'recarga_coins' && reqToApprove.coinsAmount) {
      addCoins(reqToApprove.coinsAmount);
    }

    const updatedReq: PurchaseRequest = {
      ...reqToApprove,
      status: 'Aprovado',
      approvedBy: 'Carlos Mendes (Gestor)',
      approvedAt: new Date().toISOString(),
      managerObservation: managerObservationInput.trim() || undefined
    };

    await updatePurchaseRequest(updatedReq);
    setRequests(prev => prev.map(r => r.id === approvingReqId ? updatedReq : r));
    setApprovingReqId(null);
    setManagerObservationInput("");
    setNoticeMessage("Solicitação APROVADA! Registro salvo no servidor SQLite.");
    setTimeout(() => setNoticeMessage(null), 3000);
  };

  // Mandatory Rejection Handler
  const handleOpenRejectModal = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRejectingReqId(id);
    setRejectionReasonInput("");
    setRejectionObsInput("");
  };

  const handleConfirmRejection = async () => {
    if (!rejectingReqId || !rejectionReasonInput.trim()) return;

    const reqToReject = requests.find(r => r.id === rejectingReqId);
    if (!reqToReject) return;

    const updatedReq: PurchaseRequest = {
      ...reqToReject,
      status: 'Recusado',
      rejectionReason: rejectionReasonInput.trim(),
      managerObservation: rejectionObsInput.trim() || undefined,
      rejectedBy: 'Carlos Mendes (Gestor)',
      rejectedAt: new Date().toISOString()
    };

    await updatePurchaseRequest(updatedReq);
    setRequests(prev => prev.map(r => r.id === rejectingReqId ? updatedReq : r));
    setRejectingReqId(null);
    setRejectionReasonInput("");
    setRejectionObsInput("");
    setNoticeMessage("Solicitação REPROVADA. Motivo registrado com sucesso no histórico SQLite.");
    setTimeout(() => setNoticeMessage(null), 3000);
  };

  const handleDeleteRequest = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deletePurchaseRequest(id);
    setRequests(prev => prev.filter(r => r.id !== id));
    setNoticeMessage("Solicitação excluída com sucesso.");
    setTimeout(() => setNoticeMessage(null), 3000);
  };

  // RBAC Filtering Rules:
  // - Funcionario: Views their requests (Juliana Lima or role 'funcionario')
  // - Gestor: Views ALL requests
  const visibleRequests = requests.filter(r => {
    if (role === 'funcionario') {
      return r.requesterName === 'Juliana Lima' || r.requesterRole === 'funcionario';
    }
    return true;
  });

  const filteredRequests = visibleRequests.filter(r => {
    const matchesStatus = filterStatus === 'Todos' || r.status.toLowerCase().trim() === filterStatus.toLowerCase().trim();
    const matchesDepartment = filterDepartment === 'Todos' || r.department === filterDepartment;
    const matchesType = filterType === 'Todos' || r.type === filterType;
    const matchesSearch = r.reqNumber.toLowerCase().includes(search.toLowerCase()) ||
                          r.requesterName.toLowerCase().includes(search.toLowerCase()) ||
                          r.description.toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesDepartment && matchesType && matchesSearch;
  });

  const approvedTotalBrl = requests
    .filter(r => r.status === 'Aprovado')
    .reduce((acc, r) => acc + r.valueBrl, 0);

  return (
    <div className="space-y-6 text-slate-900 font-sans">
      {/* Navigation Breadcrumbs Bar */}
      <div className="flex items-center justify-between bg-slate-50 border border-slate-200/80 rounded-xl px-4 py-2 text-xs">
        <div className="flex items-center gap-2 text-slate-600 font-medium">
          <span className="text-slate-400">Módulos Financeiros:</span>
          <Link href="/contratos" className="hover:text-[#1E6FD9] transition-colors">
            <span>Contratos BPO</span>
          </Link>
          <span className="text-slate-300">•</span>
          <Link href="/financeiro" className="hover:text-[#1E6FD9] transition-colors">
            <span>Financeiro & Payables</span>
          </Link>
          <span className="text-slate-300">•</span>
          <span className="font-bold text-[#1E6FD9] bg-blue-50 px-2 py-0.5 rounded border border-blue-200">Solicitações & Compras</span>
          <span className="text-slate-300">•</span>
          <Link href="/contaazul" className="hover:text-[#1E6FD9] transition-colors">
            <span>Integração ContaAzul</span>
          </Link>
        </div>
      </div>

      {/* Approval Modal with Manager Observation Input */}
      {approvingReqId && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 p-6 max-w-md w-full shadow-lg relative space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>Aprovar Solicitação BPO</span>
              </h3>
              <button onClick={() => setApprovingReqId(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              Você está aprovando a solicitação <strong>{requests.find(r => r.id === approvingReqId)?.reqNumber}</strong>. Deseja adicionar uma observação de aprovação para o solicitante e o setor de RH?
            </p>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                Observação do Gestor (Opcional):
              </label>
              <textarea
                rows={3}
                placeholder="Ex: Aprovado conforme orçamento do setor de TI. Liberado para faturamento."
                value={managerObservationInput}
                onChange={(e) => setManagerObservationInput(e.target.value)}
                className="w-full p-3 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:outline-none focus:border-emerald-600"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setApprovingReqId(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmApproval}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-xs"
              >
                Confirmar Aprovação
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New / Edit Request Modal */}
      {showNewModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 p-6 max-w-md w-full shadow-lg relative space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-[#1E6FD9]" />
                <span>{editingReqId ? 'Editar Solicitação BPO' : 'Nova Solicitação de Compra / Saldo'}</span>
              </h3>
              <button onClick={() => setShowNewModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Tipo de Solicitação:
                  </label>
                  <select
                    value={reqType}
                    onChange={(e) => setReqType(e.target.value as any)}
                    className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-bold focus:outline-none focus:border-[#1E6FD9] cursor-pointer"
                  >
                    <option value="recarga_coins">Inclusão de Saldo de OmniCoins</option>
                    <option value="compra_material">Compra de Suprimento / Equipamento</option>
                    <option value="servico_terceiro">Serviço Terceirizado</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Departamento:
                  </label>
                  <select
                    value={reqDepartment}
                    onChange={(e) => setReqDepartment(e.target.value)}
                    className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-bold focus:outline-none focus:border-[#1E6FD9] cursor-pointer"
                  >
                    <option value="Operações Tributárias">Operações Tributárias</option>
                    <option value="Diretoria Fiscal">Diretoria Fiscal</option>
                    <option value="BPO Financeiro">BPO Financeiro</option>
                    <option value="Departamento Pessoal">Departamento Pessoal</option>
                    <option value="Contabilidade">Contabilidade</option>
                  </select>
                </div>
              </div>

              {reqType === 'recarga_coins' && (
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Quantidade de OmniCoins Solicitada:
                  </label>
                  <select
                    value={reqCoins}
                    onChange={(e) => setReqCoins(Number(e.target.value))}
                    className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-bold focus:outline-none focus:border-[#1E6FD9] cursor-pointer"
                  >
                    <option value={2000}>+2.000 Coins (R$ 200,00)</option>
                    <option value={5000}>+5.000 Coins (R$ 490,00)</option>
                    <option value={15000}>+15.000 Coins (R$ 1.350,00)</option>
                  </select>
                </div>
              )}

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Valor Estimado (R$):
                </label>
                <input
                  type="text"
                  value={reqValue}
                  onChange={(e) => setReqValue(e.target.value)}
                  className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-bold focus:outline-none focus:border-[#1E6FD9]"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Justificativa & Detalhes da Solicitação:
                </label>
                <textarea
                  rows={3}
                  placeholder="Explique a necessidade da compra ou verba para aprovação do gestor..."
                  value={reqDesc}
                  onChange={(e) => setReqDesc(e.target.value)}
                  className="w-full p-3 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:outline-none focus:border-[#1E6FD9]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowNewModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveRequest}
                className="px-5 py-2 bg-[#1E6FD9] hover:bg-blue-600 text-white text-xs font-semibold rounded-lg shadow-xs"
              >
                {editingReqId ? 'Salvar Alterações' : 'Enviar Solicitação'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-5 lg:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-slate-900 tracking-tight">
            Central de Solicitações & Aprovações BPO
          </h1>
          <p className="text-xs lg:text-sm text-slate-500 mt-1">
            Fluxo formal de autorização de compras, inclusão de verba/Coins e suprimentos (Visão {role === 'funcionario' ? 'Meus Pedidos' : 'Gestão & RH'})
          </p>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="px-5 py-2.5 bg-[#1E6FD9] hover:bg-blue-600 text-white text-xs font-semibold rounded-lg flex items-center gap-2 transition-all shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>Nova Solicitação</span>
        </button>
      </div>

      {noticeMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200/60 text-emerald-800 text-xs font-semibold rounded-xl flex items-center gap-2 shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{noticeMessage}</span>
        </div>
      )}

      {/* Status Counters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 block mb-1">Aguardando Aprovação</span>
            <span className="text-2xl font-extrabold text-slate-900">
              {visibleRequests.filter(r => r.status === 'Pendente').length} Pendentes
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 block mb-1">Total Aprovado (Refletido no Dashboard)</span>
            <span className="text-2xl font-extrabold text-slate-900">
              R$ {approvedTotalBrl.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Solicitações Registradas</span>
            <span className="text-2xl font-extrabold text-slate-900">{visibleRequests.length} Registros</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#1E6FD9] flex items-center justify-center">
            <FileText className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Table & Filter Bar */}
      <div className="bg-white p-5 lg:p-6 rounded-xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex flex-wrap items-center gap-2">
            {/* Status Tabs */}
            <div className="flex items-center gap-1 bg-slate-50 border border-slate-200/80 p-1 rounded-lg">
              <span className="text-[10px] font-bold text-slate-400 uppercase px-1">Status:</span>
              {(['Todos', 'Pendente', 'Aprovado', 'Recusado'] as const).map(st => (
                <button
                  key={st}
                  onClick={() => setFilterStatus(st)}
                  className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                    filterStatus === st 
                      ? 'bg-[#1E6FD9] text-white shadow-xs' 
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            {/* Department Dropdown Filter */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/80 px-2 py-1 rounded-lg text-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Setor:</span>
              <select
                value={filterDepartment}
                onChange={(e) => setFilterDepartment(e.target.value)}
                className="bg-transparent font-semibold text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="Todos">Todos os Setores</option>
                <option value="Operações Tributárias">Operações Tributárias</option>
                <option value="Diretoria Fiscal">Diretoria Fiscal</option>
                <option value="BPO Financeiro">BPO Financeiro</option>
                <option value="Departamento Pessoal">Departamento Pessoal</option>
                <option value="Contabilidade">Contabilidade</option>
              </select>
            </div>

            {/* Type Dropdown Filter */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/80 px-2 py-1 rounded-lg text-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Tipo:</span>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="bg-transparent font-semibold text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="Todos">Todos os Tipos</option>
                <option value="recarga_coins">Inclusão de Coins</option>
                <option value="compra_material">Compra de Suprimento</option>
                <option value="servico_terceiro">Serviço Terceirizado</option>
              </select>
            </div>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por código, nome ou palavra..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full lg:w-64 h-8 pl-8 pr-3 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#1E6FD9]"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider text-[10px] bg-slate-50">
                <th className="py-3 px-4">Código</th>
                <th className="py-3 px-4">Solicitante / Setor</th>
                <th className="py-3 px-4">Tipo & Descrição</th>
                <th className="py-3 px-4 text-right">Valor (R$)</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Ação do Gestor / RH</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Carregando solicitações via servidor SQLite...
                  </td>
                </tr>
              ) : filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    Nenhuma solicitação encontrada com os filtros atuais.
                  </td>
                </tr>
              ) : (
                filteredRequests
                  .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                  .map(req => (
                  <tr 
                    key={req.id} 
                    onClick={() => setSelectedDetailReq(req)}
                    className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                  >
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">{req.reqNumber}</td>
                    <td className="py-3.5 px-4">
                      <span className="font-bold text-slate-900 block">{req.requesterName}</span>
                      <span className="text-[10px] text-slate-500">{req.department}</span>
                    </td>
                    <td className="py-3.5 px-4 max-w-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#1E6FD9]">
                          {req.type === 'recarga_coins' ? 'Inclusão de Coins' : req.type === 'compra_material' ? 'Compra de Suprimento' : 'Serviço Terceiro'}
                        </span>
                        {req.status === 'Pendente' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleOpenEditModal(req); }}
                            className="p-1 text-slate-400 hover:text-slate-700 rounded transition-colors"
                            title="Editar Solicitação"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-600 line-clamp-2 mt-0.5">{req.description}</p>
                      {req.rejectionReason && (
                        <div className="mt-1.5 p-2 bg-red-50 border border-red-200/80 rounded-lg text-[10px] font-medium text-red-700 flex items-start gap-1.5">
                          <XCircle className="w-3 h-3 text-red-600 shrink-0 mt-0.5" />
                          <span><strong>Motivo Reprovação:</strong> "{req.rejectionReason}"</span>
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right font-extrabold text-slate-900">
                      R$ {req.valueBrl.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        req.status === 'Aprovado' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        req.status === 'Pendente' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-red-50 text-red-700 border-red-200'
                      }`}>
                        {req.status === 'Aprovado' && <CheckCircle2 className="w-3 h-3" />}
                        {req.status === 'Pendente' && <Clock className="w-3 h-3" />}
                        {req.status === 'Recusado' && <XCircle className="w-3 h-3" />}
                        {req.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {role !== 'funcionario' && req.status === 'Pendente' ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={(e) => { e.stopPropagation(); setApprovingReqId(req.id); }}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold flex items-center gap-1 transition-colors shadow-xs"
                            title="Aprovar com Observação"
                          >
                            <Check className="w-3 h-3" />
                            <span>Aprovar</span>
                          </button>
                          <button
                            onClick={(e) => handleOpenRejectModal(req.id, e)}
                            className="px-2 py-1 bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-700 rounded text-[10px] font-bold transition-colors"
                            title="Reprovar Solicitação"
                          >
                            <X className="w-3 h-3" />
                            <span>Reprovar</span>
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-[10px] text-slate-400 font-medium">
                            {req.approvedBy ? req.approvedBy : req.rejectedBy ? req.rejectedBy : '—'}
                          </span>
                          <button
                            onClick={(e) => handleDeleteRequest(req.id, e)}
                            className="p-1 text-slate-300 hover:text-red-600 rounded transition-colors"
                            title="Excluir Registro"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Minimalist Pagination Bar (15 itens/página) */}
        {filteredRequests.length > pageSize && (
          <div className="flex items-center justify-between pt-4 border-t border-slate-100 text-xs text-slate-500">
            <span>
              Exibindo <strong>{(currentPage - 1) * pageSize + 1}</strong> a <strong>{Math.min(currentPage * pageSize, filteredRequests.length)}</strong> de <strong>{filteredRequests.length}</strong> solicitações
            </span>
            <div className="flex items-center gap-1">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className="px-3 py-1 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 rounded-md font-semibold transition-colors"
              >
                Anterior
              </button>
              <span className="px-2 font-mono font-bold text-slate-800">
                Página {currentPage} de {Math.ceil(filteredRequests.length / pageSize)}
              </span>
              <button
                disabled={currentPage >= Math.ceil(filteredRequests.length / pageSize)}
                onClick={() => setCurrentPage(p => p + 1)}
                className="px-3 py-1 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 rounded-md font-semibold transition-colors"
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Mandatory Rejection Modal */}
      {rejectingReqId && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-red-600 flex items-center gap-2">
                <XCircle className="w-5 h-5" />
                Reprovar Solicitação
              </h3>
              <button onClick={() => setRejectingReqId(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Motivo da Reprovação * (Obrigatório)</label>
                <textarea
                  rows={3}
                  placeholder="Informe o motivo da recusa (ex: Verba orçamentária excedida para o setor)..."
                  value={rejectionReasonInput}
                  onChange={(e) => setRejectionReasonInput(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-red-500 font-medium"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Observações Adicionais (Opcional)</label>
                <input
                  type="text"
                  placeholder="Orientações ao solicitante..."
                  value={rejectionObsInput}
                  onChange={(e) => setRejectionObsInput(e.target.value)}
                  className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-red-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setRejectingReqId(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-xs font-semibold rounded-lg text-slate-700"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmRejection}
                disabled={!rejectionReasonInput.trim()}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-xs flex items-center gap-1.5"
              >
                <XCircle className="w-4 h-4" />
                <span>Confirmar Reprovação</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modern Slide-over Drawer for Request Details */}
      {selectedDetailReq && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex justify-end animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-lg h-full shadow-2xl flex flex-col justify-between p-6 space-y-6 animate-in slide-in-from-right duration-200 overflow-y-auto">
            <div className="space-y-5">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <span className="text-[10px] font-bold text-[#1E6FD9] uppercase tracking-wider block">Detalhes da Solicitação</span>
                  <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
                    {selectedDetailReq.reqNumber}
                  </h2>
                </div>
                <button
                  onClick={() => setSelectedDetailReq(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Status & General Info */}
              <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Status Atual</span>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border mt-1 ${
                    selectedDetailReq.status === 'Aprovado' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                    selectedDetailReq.status === 'Pendente' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-red-50 text-red-700 border-red-200'
                  }`}>
                    {selectedDetailReq.status}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Data de Solicitação</span>
                  <span className="font-semibold text-slate-800 mt-1 block">
                    {new Date(selectedDetailReq.createdAt).toLocaleDateString('pt-BR')} às {new Date(selectedDetailReq.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>

              {/* Requester Info */}
              <div className="space-y-2 text-xs">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-1">Solicitante & Empresa</h4>
                <div className="grid grid-cols-2 gap-2 text-slate-700">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Nome do Solicitante:</span>
                    <strong className="text-slate-900 font-bold">{selectedDetailReq.requesterName}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Departamento:</span>
                    <span className="font-semibold">{selectedDetailReq.department}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Empresa Associada:</span>
                    <span className="font-semibold">Zenitus Inteligência Contábil Ltda</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">CNPJ:</span>
                    <span className="font-mono">42.189.902/0001-55</span>
                  </div>
                </div>
              </div>

              {/* Items & Values */}
              <div className="space-y-2 text-xs">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-1">Valores & Justificativa</h4>
                <div className="p-4 bg-blue-50/40 rounded-xl border border-blue-100 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-700">Tipo de Recurso:</span>
                    <span className="font-bold text-[#1E6FD9]">
                      {selectedDetailReq.type === 'recarga_coins' ? 'Inclusão de OmniCoins' : selectedDetailReq.type === 'compra_material' ? 'Compra de Material' : 'Serviço de Terceiros'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-700">Valor Bruto Solicitado:</span>
                    <span className="font-extrabold text-slate-900 text-sm">
                      R$ {selectedDetailReq.valueBrl.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  {selectedDetailReq.coinsAmount && (
                    <div className="flex justify-between items-center text-amber-700 font-bold">
                      <span>OmniCoins Solicitadas:</span>
                      <span>{selectedDetailReq.coinsAmount.toLocaleString('pt-BR')} Coins</span>
                    </div>
                  )}
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Descrição / Justificativa Completa</span>
                  <p className="text-slate-700 leading-relaxed font-medium">
                    {selectedDetailReq.description}
                  </p>
                </div>
              </div>

              {/* Audit & Movement History */}
              <div className="space-y-2 text-xs">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-1">Histórico de Movimentações & Aprovações</h4>
                
                <div className="space-y-2">
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/60 flex items-start gap-2">
                    <Clock className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-slate-800 block">Solicitação criada no sistema</strong>
                      <span className="text-[10px] text-slate-500">Por {selectedDetailReq.requesterName} em {new Date(selectedDetailReq.createdAt).toLocaleDateString('pt-BR')}</span>
                    </div>
                  </div>

                  {selectedDetailReq.status === 'Aprovado' && (
                    <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-emerald-900 block">Aprovado pelo Gestor</strong>
                        <span className="text-[10px] text-emerald-700">Por {selectedDetailReq.approvedBy || 'Carlos Mendes (Gestor)'}</span>
                        {selectedDetailReq.managerObservation && (
                          <p className="mt-1 text-[11px] text-emerald-800 italic">
                            "{selectedDetailReq.managerObservation}"
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {selectedDetailReq.status === 'Recusado' && (
                    <div className="p-3 bg-red-50 rounded-lg border border-red-200 flex items-start gap-2">
                      <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-red-900 block">Reprovado pelo Gestor</strong>
                        <span className="text-[10px] text-red-700">Por {selectedDetailReq.rejectedBy || 'Carlos Mendes (Gestor)'}</span>
                        {selectedDetailReq.rejectionReason && (
                          <p className="mt-1 text-[11px] text-red-800 font-semibold">
                            Motivo: "{selectedDetailReq.rejectionReason}"
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedDetailReq(null)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-xs"
              >
                Fechar Painel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
