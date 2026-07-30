"use client";

import { useState, useEffect } from "react";
import { 
  Download, Coins, ShieldAlert, 
  TrendingDown, Wallet, BarChart3, Search,
  CreditCard, CheckCircle2, Clock, AlertCircle, Link as LinkIcon, Plus, Trash2, Edit, Filter, Calendar, X, Check, User
} from "lucide-react";
import { getActiveRole, UserRole } from "@/lib/auth/roles";
import { getCoinBalance, addCoins } from "@/lib/coins/store";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { fetchPayables, insertPayable, updatePayable, deletePayable, fetchContracts } from "@/lib/db/serverDb";

export interface PayableItem {
  id: string;
  description: string;
  desc?: string;
  vendor: string;
  fornecedor?: string;
  value_brl: number;
  valor?: number;
  due_date: string;
  vencimento?: string;
  status: 'Pago' | 'Pendente' | 'Agendado' | 'Vencido';
  category?: string;
  cost_center?: string;
  paid_at?: string | null;
  paid_by_user?: string | null;
  payment_method?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

function normalizePayable(item: any): PayableItem {
  const desc = item.description || item.desc || "Sem Descrição";
  const vendor = item.vendor || item.fornecedor || "Não especificado";
  const val = Number(item.value_brl ?? item.valor ?? 0);
  const due = item.due_date || item.vencimento || new Date().toISOString().split("T")[0];
  
  return {
    id: item.id || `pag_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    description: desc,
    desc: desc,
    vendor: vendor,
    fornecedor: vendor,
    value_brl: val,
    valor: val,
    due_date: due,
    vencimento: due,
    status: (item.status as any) || "Pendente",
    category: item.category || "Outros",
    cost_center: item.cost_center || "Administrativo",
    paid_at: item.paid_at || null,
    paid_by_user: item.paid_by_user || null,
    payment_method: item.payment_method || null,
    notes: item.notes || null,
    created_at: item.created_at || new Date().toISOString(),
    updated_at: item.updated_at
  };
}

const DEFAULT_PAYABLES = [
  {
    id: "pag_1",
    description: "Licença Software Contábil Dominio",
    desc: "Licença Software Contábil Dominio",
    vendor: "Thomson Reuters Brasil",
    fornecedor: "Thomson Reuters Brasil",
    value_brl: 1850.00,
    valor: 1850.00,
    due_date: "2026-08-10",
    vencimento: "2026-08-10",
    status: "Pendente",
    category: "Software & Licenças",
    cost_center: "TI & Sistemas",
    created_at: new Date().toISOString()
  },
  {
    id: "pag_2",
    description: "DAS Simples Nacional Escritório",
    desc: "DAS Simples Nacional Escritório",
    vendor: "Receita Federal do Brasil",
    fornecedor: "Receita Federal do Brasil",
    value_brl: 3420.50,
    valor: 3420.50,
    due_date: "2026-08-20",
    vencimento: "2026-08-20",
    status: "Agendado",
    category: "Tributos",
    cost_center: "Administrativo",
    created_at: new Date().toISOString()
  },
  {
    id: "pag_3",
    description: "Aluguel Sede Empresarial",
    desc: "Aluguel Sede Empresarial",
    vendor: "Imobiliária Salvador Prime",
    fornecedor: "Imobiliária Salvador Prime",
    value_brl: 5200.00,
    valor: 5200.00,
    due_date: "2026-07-05",
    vencimento: "2026-07-05",
    status: "Pago",
    category: "Infraestrutura",
    cost_center: "Administrativo",
    paid_at: "2026-07-04",
    paid_by_user: "Carlos Mendes (Gestor)",
    payment_method: "PIX",
    created_at: new Date().toISOString()
  },
  {
    id: "pag_4",
    description: "Emissão Certificados Digitais A1",
    desc: "Emissão Certificados Digitais A1",
    vendor: "Certisign Certificadora Digital",
    fornecedor: "Certisign Certificadora Digital",
    value_brl: 450.00,
    valor: 450.00,
    due_date: "2026-07-15",
    vencimento: "2026-07-15",
    status: "Pago",
    category: "Suprimentos",
    cost_center: "Operações Contábeis",
    paid_at: "2026-07-14",
    paid_by_user: "Carlos Mendes (Gestor)",
    payment_method: "Cartão de Crédito",
    created_at: new Date().toISOString()
  },
  {
    id: "pag_5",
    description: "Link Dedicado Fibra Optica 500MB",
    desc: "Link Dedicado Fibra Optica 500MB",
    vendor: "Vivo Empresas Telecom",
    fornecedor: "Vivo Empresas Telecom",
    value_brl: 680.00,
    valor: 680.00,
    due_date: "2026-07-25",
    vencimento: "2026-07-25",
    status: "Vencido",
    category: "Telecom",
    cost_center: "TI & Infraestrutura",
    created_at: new Date().toISOString()
  }
];

const CATEGORIES = [
  "Software & Licenças",
  "Tributos",
  "Infraestrutura",
  "Suprimentos",
  "Telecom",
  "Folha & Encargos",
  "Serviços Terceirizados",
  "Outros"
];

export default function FinanceiroPage() {
  const [role, setRole] = useState<UserRole>("gestor");
  const [balance, setBalance] = useState<number>(14250);
  const [isMounted, setIsMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [contaAzulConnected, setContaAzulConnected] = useState(false);
  const [isSyncingContaAzul, setIsSyncingContaAzul] = useState(false);
  const [activeTab, setActiveTab] = useState<'financeiro' | 'dre' | 'contaazul' | 'historico_coins'>('financeiro');
  const [rechargeSuccessAmount, setRechargeSuccessAmount] = useState<number | null>(null);

  // Payables list state (loaded directly from SQLite serverDb)
  const [payables, setPayables] = useState<PayableItem[]>([]);

  // Filter states
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;
  const [tableSearch, setTableSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [categoryFilter, setCategoryFilter] = useState<string>("todas");
  const [vendorFilter, setVendorFilter] = useState<string>("todos");
  const [startDateFilter, setStartDateFilter] = useState<string>("");
  const [endDateFilter, setEndDateFilter] = useState<string>("");

  // Modal states
  const [showAddEditModal, setShowAddEditModal] = useState(false);
  const [editingPayable, setEditingPayable] = useState<PayableItem | null>(null);
  
  // Add/Edit Form states
  const [formDesc, setFormDesc] = useState("");
  const [formVendor, setFormVendor] = useState("");
  const [formValue, setFormValue] = useState("");
  const [formDueDate, setFormDueDate] = useState("");
  const [formStatus, setFormStatus] = useState<'Pago' | 'Pendente' | 'Agendado' | 'Vencido'>('Pendente');
  const [formCategory, setFormCategory] = useState("Software & Licenças");
  const [formCostCenter, setFormCostCenter] = useState("Administrativo");
  const [formNotes, setFormNotes] = useState("");

  // Payment Confirmation Modal state
  const [confirmPaymentPayable, setConfirmPaymentPayable] = useState<PayableItem | null>(null);
  const [paymentDate, setPaymentDate] = useState("");
  const [paymentUser, setPaymentUser] = useState("Carlos Mendes (Gestor)");
  const [paymentMethod, setPaymentMethod] = useState("PIX");
  const [paymentNotes, setPaymentNotes] = useState("");

  // Delete confirmation state
  const [deletingPayableId, setDeletingPayableId] = useState<string | null>(null);

  // Dynamic contracts revenue for DRE calculation
  const [contractsTotalMonthlyRevenue, setContractsTotalMonthlyRevenue] = useState<number>(28450);

  // Load payables and contracts from SQLite via serverDb
  const loadPayablesFromDb = async () => {
    setIsLoading(true);
    try {
      const data = await fetchPayables();
      if (Array.isArray(data) && data.length > 0) {
        setPayables(data.map(normalizePayable));
      } else {
        for (const item of DEFAULT_PAYABLES) {
          await insertPayable(item);
        }
        const fresh = await fetchPayables();
        setPayables((fresh.length > 0 ? fresh : DEFAULT_PAYABLES).map(normalizePayable));
      }

      // Calculate real total monthly contract revenue from SQLite
      const contractsData = await fetchContracts();
      if (Array.isArray(contractsData) && contractsData.length > 0) {
        const sum = contractsData.reduce((acc: number, c: any) => {
          const fee = Number(c.monthlyFeeBrl ?? c.monthly_fee_brl ?? 0);
          return acc + fee;
        }, 0);
        if (sum > 0) setContractsTotalMonthlyRevenue(sum);
      }
    } catch (err) {
      console.error("Erro ao carregar contas a pagar e contratos do banco SQLite:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setIsMounted(true);
    const userRole = getActiveRole();
    setRole(userRole);
    setBalance(getCoinBalance());

    loadPayablesFromDb();

    const handleRoleChange = () => setRole(getActiveRole());
    const handleCoinsChange = () => setBalance(getCoinBalance());
    window.addEventListener("omnizeus_role_change", handleRoleChange);
    window.addEventListener("omnizeus_coins_change", handleCoinsChange);
    return () => {
      window.removeEventListener("omnizeus_role_change", handleRoleChange);
      window.removeEventListener("omnizeus_coins_change", handleCoinsChange);
    };
  }, []);

  // Handlers for Add/Edit Modal
  const handleOpenAddModal = () => {
    setEditingPayable(null);
    setFormDesc("");
    setFormVendor("");
    setFormValue("");
    setFormDueDate(new Date().toISOString().split("T")[0]);
    setFormStatus("Pendente");
    setFormCategory("Software & Licenças");
    setFormCostCenter("Administrativo");
    setFormNotes("");
    setShowAddEditModal(true);
  };

  const handleOpenEditModal = (item: PayableItem) => {
    setEditingPayable(item);
    setFormDesc(item.description || item.desc || "");
    setFormVendor(item.vendor || item.fornecedor || "");
    setFormValue((item.value_brl || item.valor || 0).toString());
    setFormDueDate(item.due_date || item.vencimento || "");
    setFormStatus(item.status);
    setFormCategory(item.category || "Software & Licenças");
    setFormCostCenter(item.cost_center || "Administrativo");
    setFormNotes(item.notes || "");
    setShowAddEditModal(true);
  };

  const handleSavePayable = async () => {
    if (!formDesc.trim() || !formVendor.trim()) return;
    
    const valNum = parseFloat(formValue.replace(/\./g, '').replace(',', '.')) || parseFloat(formValue) || 0;
    
    if (editingPayable) {
      const isPago = formStatus === "Pago";
      const updatedRecord: PayableItem = {
        ...editingPayable,
        description: formDesc.trim(),
        desc: formDesc.trim(),
        vendor: formVendor.trim(),
        fornecedor: formVendor.trim(),
        value_brl: valNum,
        valor: valNum,
        due_date: formDueDate || new Date().toISOString().split("T")[0],
        vencimento: formDueDate || new Date().toISOString().split("T")[0],
        status: formStatus,
        category: formCategory,
        cost_center: formCostCenter,
        notes: formNotes,
        paid_at: isPago ? (editingPayable.paid_at || new Date().toISOString().split("T")[0]) : null,
        paid_by_user: isPago ? (editingPayable.paid_by_user || paymentUser) : null,
        payment_method: isPago ? (editingPayable.payment_method || paymentMethod) : null,
        updated_at: new Date().toISOString()
      };
      
      await updatePayable(updatedRecord);
    } else {
      const isPago = formStatus === "Pago";
      const newRecord: PayableItem = {
        id: `pag_${Date.now()}`,
        description: formDesc.trim(),
        desc: formDesc.trim(),
        vendor: formVendor.trim(),
        fornecedor: formVendor.trim(),
        value_brl: valNum,
        valor: valNum,
        due_date: formDueDate || new Date().toISOString().split("T")[0],
        vencimento: formDueDate || new Date().toISOString().split("T")[0],
        status: formStatus,
        category: formCategory,
        cost_center: formCostCenter,
        notes: formNotes,
        paid_at: isPago ? new Date().toISOString().split("T")[0] : null,
        paid_by_user: isPago ? paymentUser : null,
        payment_method: isPago ? paymentMethod : null,
        created_at: new Date().toISOString()
      };

      await insertPayable(newRecord);
    }

    await loadPayablesFromDb();
    setShowAddEditModal(false);
  };

  // Handler for Confirm Payment Modal
  const handleOpenConfirmPaymentModal = (item: PayableItem) => {
    setConfirmPaymentPayable(item);
    setPaymentDate(new Date().toISOString().split("T")[0]);
    setPaymentUser(role === "super_adm" ? "Super ADM Master" : "Carlos Mendes (Gestor)");
    setPaymentMethod("PIX");
    setPaymentNotes("");
  };

  const handleExecutePayment = async () => {
    if (!confirmPaymentPayable) return;

    const updatedRecord: PayableItem = {
      ...confirmPaymentPayable,
      status: "Pago",
      paid_at: paymentDate || new Date().toISOString().split("T")[0],
      paid_by_user: paymentUser,
      payment_method: paymentMethod,
      notes: paymentNotes || confirmPaymentPayable.notes || null,
      updated_at: new Date().toISOString()
    };

    await updatePayable(updatedRecord);
    await loadPayablesFromDb();
    setConfirmPaymentPayable(null);
  };

  // Handler for Delete
  const handleConfirmDelete = async () => {
    if (!deletingPayableId) return;
    await deletePayable(deletingPayableId);
    await loadPayablesFromDb();
    setDeletingPayableId(null);
  };

  const handleExportPDF = () => {
    window.print();
  };

  const handleConnectContaAzul = () => {
    setIsSyncingContaAzul(true);
    setTimeout(() => {
      setContaAzulConnected(true);
      setIsSyncingContaAzul(false);
    }, 1500);
  };

  // Extract unique vendors for vendor filter dropdown
  const uniqueVendors = Array.from(new Set(payables.map(p => p.vendor || p.fornecedor).filter(Boolean)));

  // Filter Payables List
  const filteredPayables = payables.filter((p) => {
    const descStr = (p.description || p.desc || "").toLowerCase();
    const vendorStr = (p.vendor || p.fornecedor || "").toLowerCase();
    const catStr = (p.category || "").toLowerCase();
    const searchLower = tableSearch.toLowerCase().trim();

    if (searchLower && !descStr.includes(searchLower) && !vendorStr.includes(searchLower) && !catStr.includes(searchLower)) {
      return false;
    }
    if (statusFilter !== "todos" && p.status !== statusFilter) {
      return false;
    }
    if (categoryFilter !== "todas" && (p.category || "Outros") !== categoryFilter) {
      return false;
    }
    if (vendorFilter !== "todos" && (p.vendor || p.fornecedor) !== vendorFilter) {
      return false;
    }
    const itemDate = p.due_date || p.vencimento || "";
    if (startDateFilter && itemDate < startDateFilter) {
      return false;
    }
    if (endDateFilter && itemDate > endDateFilter) {
      return false;
    }
    return true;
  });

  const resetFilters = () => {
    setTableSearch("");
    setStatusFilter("todos");
    setCategoryFilter("todas");
    setVendorFilter("todos");
    setStartDateFilter("");
    setEndDateFilter("");
  };

  const hasActiveFilters = tableSearch !== "" || statusFilter !== "todos" || categoryFilter !== "todas" || vendorFilter !== "todos" || startDateFilter !== "" || endDateFilter !== "";

  // Executive Financial KPIs Calculation (Dynamic: recalculates when filters are applied)
  const targetPayables = hasActiveFilters ? filteredPayables : payables;

  const pendingPayables = targetPayables.filter(p => p.status === "Pendente" || p.status === "Vencido");
  const totalPendente = pendingPayables.reduce((acc, p) => acc + (p.value_brl || p.valor || 0), 0);

  const paidPayables = targetPayables.filter(p => p.status === "Pago");
  const totalPago = paidPayables.reduce((acc, p) => acc + (p.value_brl || p.valor || 0), 0);

  const scheduledPayables = targetPayables.filter(p => p.status === "Agendado");
  const totalAgendado = scheduledPayables.reduce((acc, p) => acc + (p.value_brl || p.valor || 0), 0);

  const totalGastosExibidos = targetPayables.reduce((acc, p) => acc + (p.value_brl || p.valor || 0), 0);

  if (role === "funcionario") {
    return (
      <div className="p-12 bg-white border border-gray-200 rounded-xl text-center">
        <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-base font-semibold text-gray-900">Acesso Restrito ao Módulo Financeiro</h2>
        <p className="text-xs text-gray-500 mt-2 max-w-sm mx-auto leading-relaxed">
          De acordo com as políticas de governança do OmniZeus, a visualização de relatórios financeiros e contas a pagar é restrita aos perfis de Gestor e Super ADM.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-gray-900 font-sans">
      {/* Recharge Success Modal */}
      <ConfirmModal
        isOpen={rechargeSuccessAmount !== null}
        onClose={() => setRechargeSuccessAmount(null)}
        onConfirm={() => setRechargeSuccessAmount(null)}
        title="Recarga Concluída"
        description={`Foram adicionadas ${rechargeSuccessAmount?.toLocaleString('pt-BR')} OmniCoins ao saldo.`}
        confirmText="Concluir"
        cancelText="Fechar"
        variant="success"
      />

      {/* Confirm Delete Modal */}
      <ConfirmModal
        isOpen={deletingPayableId !== null}
        onClose={() => setDeletingPayableId(null)}
        onConfirm={handleConfirmDelete}
        title="Excluir Conta a Pagar"
        description="Tem certeza que deseja excluir esta conta a pagar? Esta operação será salva diretamente no banco de dados SQLite."
        confirmText="Excluir"
        cancelText="Cancelar"
        variant="danger"
      />

      {/* Add / Edit Payable Modal */}
      {showAddEditModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-lg w-full shadow-xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-bold text-gray-900">
                {editingPayable ? "Editar Conta a Pagar" : "Adicionar Conta a Pagar"}
              </h3>
              <button onClick={() => setShowAddEditModal(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 block mb-1">Descrição do Título</label>
                <input
                  type="text"
                  placeholder="Ex: Licença Software Contábil Dominio"
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  className="w-full h-9 px-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 block mb-1">Fornecedor / Credor</label>
                  <input
                    type="text"
                    placeholder="Ex: Thomson Reuters"
                    value={formVendor}
                    onChange={(e) => setFormVendor(e.target.value)}
                    className="w-full h-9 px-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 block mb-1">Categoria</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full h-9 px-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:border-primary"
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 block mb-1">Valor (R$)</label>
                  <input
                    type="text"
                    placeholder="1250,00"
                    value={formValue}
                    onChange={(e) => setFormValue(e.target.value)}
                    className="w-full h-9 px-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 font-bold focus:outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 block mb-1">Vencimento</label>
                  <input
                    type="date"
                    value={formDueDate}
                    onChange={(e) => setFormDueDate(e.target.value)}
                    className="w-full h-9 px-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 block mb-1">Status</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                    className="w-full h-9 px-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:border-primary"
                  >
                    <option value="Pendente">Pendente</option>
                    <option value="Agendado">Agendado</option>
                    <option value="Pago">Pago</option>
                    <option value="Vencido">Vencido</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 block mb-1">Centro de Custo</label>
                <input
                  type="text"
                  placeholder="Ex: TI & Sistemas / Operações"
                  value={formCostCenter}
                  onChange={(e) => setFormCostCenter(e.target.value)}
                  className="w-full h-9 px-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 block mb-1">Observações</label>
                <textarea
                  placeholder="Observações adicionais ou notas de pagamento..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  rows={2}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowAddEditModal(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-xs font-medium rounded-lg text-gray-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSavePayable}
                className="px-5 py-2 bg-primary hover:bg-blue-700 text-white text-xs font-medium rounded-lg shadow-xs transition-colors"
              >
                Salvar Lançamento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Payment Modal */}
      {confirmPaymentPayable && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-md w-full shadow-xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-gray-900">Confirmar Pagamento</h3>
              </div>
              <button onClick={() => setConfirmPaymentPayable(null)} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200/70 p-3 rounded-lg text-xs space-y-1">
              <p className="font-semibold text-slate-900">{confirmPaymentPayable.description || confirmPaymentPayable.desc}</p>
              <div className="flex justify-between text-slate-500">
                <span>Fornecedor: {confirmPaymentPayable.vendor || confirmPaymentPayable.fornecedor}</span>
                <span className="font-bold text-emerald-700">
                  R$ {(confirmPaymentPayable.value_brl || confirmPaymentPayable.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 block mb-1">Data do Pagamento</label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full h-9 px-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 block mb-1">Usuário Responsável</label>
                <input
                  type="text"
                  value={paymentUser}
                  onChange={(e) => setPaymentUser(e.target.value)}
                  className="w-full h-9 px-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 block mb-1">Forma de Pagamento</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full h-9 px-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:border-emerald-600"
                >
                  <option value="PIX">PIX</option>
                  <option value="Transferência Bancária">Transferência Bancária</option>
                  <option value="Boleto Bancário">Boleto Bancário</option>
                  <option value="Cartão de Crédito">Cartão de Crédito</option>
                  <option value="Cheque / Outros">Cheque / Outros</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 block mb-1">Observações / N° Comprovante</label>
                <input
                  type="text"
                  placeholder="Ex: Autenticação bancária 9812739182"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="w-full h-9 px-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:border-emerald-600"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setConfirmPaymentPayable(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-xs font-medium rounded-lg text-gray-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleExecutePayment}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Confirmar Pagamento</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Page Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 lg:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900 tracking-tight">
            Gestão Financeira & Contas a Pagar BPO
          </h1>
          <p className="text-xs lg:text-sm text-gray-500 mt-1">
            Controle executivo de títulos, agendamentos, DRE gerencial e integração fiscal
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="bg-gray-50 border border-gray-200 p-1 rounded-xl flex items-center gap-1">
            <button
              onClick={() => setActiveTab('financeiro')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'financeiro' ? 'bg-white text-gray-900 shadow-xs border border-gray-200' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Financeiro
            </button>
            <button
              onClick={() => setActiveTab('dre')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                activeTab === 'dre' ? 'bg-white text-gray-900 shadow-xs border border-gray-200' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5 text-gray-600" />
              <span>DRE Gerencial</span>
            </button>

            {role !== 'super_adm' && (
              <button
                onClick={() => setActiveTab('historico_coins')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                  activeTab === 'historico_coins' ? 'bg-white text-gray-900 shadow-xs border border-gray-200' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                <Coins className="w-3.5 h-3.5 text-amber-500" />
                <span>Extrato Coins</span>
              </button>
            )}
          </div>

          <button
            onClick={handleExportPDF}
            className="px-4 py-2 bg-white border border-gray-200 hover:border-gray-300 text-gray-800 text-xs font-medium rounded-lg flex items-center gap-2 transition-all shadow-xs"
          >
            <Download className="w-4 h-4 text-gray-500" />
            <span>Exportar PDF</span>
          </button>
        </div>
      </div>

      {activeTab === 'financeiro' && (
        <>
          {/* Executive Financial KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Pendente */}
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Total Pendente</span>
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-bold text-gray-900 tracking-tight">
                R$ {totalPendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-[11px] text-gray-400 mt-2 flex items-center gap-1">
                <span className="font-medium text-amber-600">{pendingPayables.length}</span> títulos pendentes/vencidos
              </p>
            </div>

            {/* Total Pago */}
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Total Pago</span>
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-bold text-gray-900 tracking-tight">
                R$ {totalPago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-[11px] text-gray-400 mt-2 flex items-center gap-1">
                <span className="font-medium text-emerald-600">{paidPayables.length}</span> contas liquidadas
              </p>
            </div>

            {/* Total Agendado */}
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Total Agendado</span>
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center border border-blue-100">
                  <Calendar className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-bold text-gray-900 tracking-tight">
                R$ {totalAgendado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-[11px] text-gray-400 mt-2 flex items-center gap-1">
                <span className="font-medium text-primary">{scheduledPayables.length}</span> pagamentos agendados
              </p>
            </div>

            {/* Gastos Totais / Período */}
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Total do Período</span>
                <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center border border-slate-200">
                  <TrendingDown className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-bold text-gray-900 tracking-tight">
                R$ {totalGastosExibidos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-[11px] text-gray-400 mt-2 flex items-center gap-1">
                <span className="font-medium text-slate-700">{targetPayables.length}</span> lançamentos {hasActiveFilters ? "filtrados" : "no total"}
              </p>
            </div>
          </div>

          {/* Payables Main Table Section */}
          <div className="bg-white p-5 lg:p-6 rounded-xl border border-gray-200 space-y-4 shadow-xs">
            {/* Table Header & Controls */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-gray-900">Contas a Pagar & Despesas</h3>
                <p className="text-xs text-gray-500">Gestão completa de obrigações financeiras e fornecedores com persistência SQLite</p>
              </div>
              <button
                onClick={handleOpenAddModal}
                className="px-4 py-2 bg-primary hover:bg-blue-700 text-white text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors shadow-xs self-start md:self-auto"
              >
                <Plus className="w-4 h-4" />
                <span>Adicionar Conta</span>
              </button>
            </div>

            {/* Complete Filter Bar */}
            <div className="bg-slate-50 border border-slate-200/80 p-3.5 rounded-xl text-xs space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
                {/* Search */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Buscar descrição ou fornecedor..."
                    value={tableSearch}
                    onChange={(e) => setTableSearch(e.target.value)}
                    className="w-full h-8 pl-8 pr-3 bg-white border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:border-primary"
                  />
                </div>

                {/* Status Dropdown */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="h-8 px-3 bg-white border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:border-primary"
                >
                  <option value="todos">Todos os Status</option>
                  <option value="Pendente">Pendente</option>
                  <option value="Agendado">Agendado</option>
                  <option value="Pago">Pago</option>
                  <option value="Vencido">Vencido</option>
                </select>

                {/* Category Dropdown */}
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="h-8 px-3 bg-white border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:border-primary"
                >
                  <option value="todas">Todas as Categorias</option>
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>

                {/* Vendor Dropdown */}
                <select
                  value={vendorFilter}
                  onChange={(e) => setVendorFilter(e.target.value)}
                  className="h-8 px-3 bg-white border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:border-primary"
                >
                  <option value="todos">Todos os Fornecedores</option>
                  {uniqueVendors.map(v => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>

                {/* Date Range Inputs */}
                <div className="flex items-center gap-1.5">
                  <input
                    type="date"
                    value={startDateFilter}
                    onChange={(e) => setStartDateFilter(e.target.value)}
                    className="w-full h-8 px-2 bg-white border border-gray-200 rounded-lg text-gray-900 text-[11px] focus:outline-none focus:border-primary"
                    title="Data Inicial"
                  />
                  <span className="text-gray-400 text-[10px]">até</span>
                  <input
                    type="date"
                    value={endDateFilter}
                    onChange={(e) => setEndDateFilter(e.target.value)}
                    className="w-full h-8 px-2 bg-white border border-gray-200 rounded-lg text-gray-900 text-[11px] focus:outline-none focus:border-primary"
                    title="Data Final"
                  />
                </div>
              </div>

              {hasActiveFilters && (
                <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                  <span className="text-[11px] text-slate-500">
                    Exibindo {filteredPayables.length} de {payables.length} lançamentos
                  </span>
                  <button
                    onClick={resetFilters}
                    className="text-[11px] font-medium text-primary hover:underline flex items-center gap-1"
                  >
                    <X className="w-3 h-3" />
                    <span>Limpar Filtros</span>
                  </button>
                </div>
              )}
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-500 font-semibold uppercase tracking-wider text-[10px] bg-slate-50">
                    <th className="py-3 px-4">Descrição & Categoria</th>
                    <th className="py-3 px-4">Fornecedor</th>
                    <th className="py-3 px-4 text-right">Valor (R$)</th>
                    <th className="py-3 px-4">Vencimento</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-700 bg-white">
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-gray-400">
                        Carregando lançamentos do banco de dados...
                      </td>
                    </tr>
                  ) : filteredPayables.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-gray-400">
                        {hasActiveFilters ? "Nenhum resultado encontrado com os filtros aplicados." : "Nenhuma conta a pagar registrada no banco. Clique em 'Adicionar Conta' para cadastrar."}
                      </td>
                    </tr>
                  ) : (
                    filteredPayables
                      .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                      .map((item) => {
                      const descStr = item.description || item.desc || "Sem Descrição";
                      const vendorStr = item.vendor || item.fornecedor || "Não especificado";
                      const valNum = item.value_brl || item.valor || 0;
                      const dueDateStr = item.due_date || item.vencimento || "-";

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-gray-900">{descStr}</div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                {item.category || "Outros"}
                              </span>
                              {item.cost_center && (
                                <span className="text-[10px] text-slate-400">
                                  • {item.cost_center}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-gray-800 font-medium">{vendorStr}</td>
                          <td className="py-3.5 px-4 text-right font-bold text-gray-900">
                            R$ {valNum.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3.5 px-4 text-gray-600 font-medium">
                            {dueDateStr}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                              item.status === 'Pago' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                              item.status === 'Agendado' ? 'bg-primary/10 text-primary border-primary/20' :
                              item.status === 'Vencido' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                              'bg-amber-50 text-amber-700 border-amber-200'
                            }`}>
                              {item.status}
                            </span>
                            {item.status === 'Pago' && item.paid_at && (
                              <div className="text-[9px] text-emerald-600 mt-0.5 font-medium">
                                Pago em {item.paid_at}
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {item.status !== "Pago" && (
                                <button
                                  onClick={() => handleOpenConfirmPaymentModal(item)}
                                  className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                  title="Confirmar Pagamento / Marcar como Pago"
                                >
                                  <CheckCircle2 className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                onClick={() => handleOpenEditModal(item)}
                                className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                                title="Editar Conta"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setDeletingPayableId(item.id)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Excluir Conta"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {filteredPayables.length > pageSize && (
              <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs text-slate-500">
                <span>
                  Exibindo <strong>{(currentPage - 1) * pageSize + 1}</strong> a <strong>{Math.min(currentPage * pageSize, filteredPayables.length)}</strong> de <strong>{filteredPayables.length}</strong> contas a pagar
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
                    Página {currentPage} de {Math.ceil(filteredPayables.length / pageSize)}
                  </span>
                  <button
                    disabled={currentPage >= Math.ceil(filteredPayables.length / pageSize)}
                    onClick={() => setCurrentPage(p => p + 1)}
                    className="px-3 py-1 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 rounded-md font-semibold transition-colors"
                  >
                    Próxima
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Rich Interactive DRE Gerencial Component */}
      {activeTab === 'dre' && (
        <div className="space-y-6">
          {/* Explanation Header Card */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Demonstração do Resultado do Exercício (DRE Gerencial)</h3>
                <p className="text-xs text-slate-500">Relatório financeiro executivo para apuração da lucratividade do escritório BPO</p>
              </div>
            </div>
            
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-xs text-slate-600 leading-relaxed">
              <strong className="text-slate-900 font-bold block mb-1">💡 O que é a DRE Gerencial e para que serve?</strong>
              A <strong>Demonstração do Resultado do Exercício (DRE)</strong> é o relatório contábil que confronta as <strong>Receitas Brutas</strong> (contratos de honorários de BPO) com as <strong>Despesas Operacionais</strong> (softwares, folha de pagamento, aluguel) para apurar se o escritório obteve <strong>Lucro Líquido Real</strong> ou <strong>Prejuízo</strong> no período.
            </div>
          </div>

          {/* DRE Summary Financial Breakdown */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Estrutura DRE Consolidada (SQLite Data)</h4>
            
            <div className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
              {/* Line 1: Receita Bruta */}
              <div className="py-3 flex items-center justify-between">
                <span className="font-bold text-slate-900">1. Receita Operacional Bruta (Honorários BPO Mensais)</span>
                <span className="font-extrabold text-emerald-600 text-sm">
                  + R$ {contractsTotalMonthlyRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>

              {/* Line 2: Deduções */}
              <div className="py-3 flex items-center justify-between pl-4">
                <span className="text-slate-600">2. (-) Deduções e Impostos sobre Faturamento (Simples Nacional ~6.5%)</span>
                <span className="font-semibold text-rose-600">
                  - R$ {(contractsTotalMonthlyRevenue * 0.065).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>

              {/* Line 3: Receita Líquida */}
              <div className="py-3 flex items-center justify-between bg-slate-50 px-3 rounded-lg font-bold">
                <span className="text-slate-900">3. (=) RECEITA OPERACIONAL LÍQUIDA</span>
                <span className="text-slate-900 text-sm">
                  R$ {(contractsTotalMonthlyRevenue * 0.935).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>

              {/* Line 4: Custos Operacionais & Despesas */}
              <div className="py-3 space-y-2 pl-4">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800">4. (-) Despesas Operacionais & Infraestrutura (Contas a Pagar Liquidadas)</span>
                  <span className="font-semibold text-rose-600">
                    - R$ {totalPago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="pl-4 space-y-1 text-[11px] text-slate-500">
                  <div className="flex justify-between">
                    <span>• Licenças de Software & TI (Alterdata, Cloud AWS, WhatsApp Bot)</span>
                    <span>R$ 5.220,50</span>
                  </div>
                  <div className="flex justify-between">
                    <span>• Aluguel & Infraestrutura Sede</span>
                    <span>R$ 8.500,00</span>
                  </div>
                  <div className="flex justify-between">
                    <span>• Consultoria Jurídica Trabalhista</span>
                    <span>R$ 4.200,00</span>
                  </div>
                </div>
              </div>

              {/* Line 5: Lucro Líquido Real */}
              {(() => {
                const netRevenue = contractsTotalMonthlyRevenue * 0.935;
                const netProfit = netRevenue - totalPago;
                const margin = netRevenue > 0 ? (netProfit / netRevenue) * 100 : 0;
                return (
                  <div className={`py-4 flex items-center justify-between px-4 rounded-xl font-bold border ${
                    netProfit >= 0 ? 'bg-emerald-50 text-emerald-900 border-emerald-200' : 'bg-rose-50 text-rose-900 border-rose-200'
                  }`}>
                    <div>
                      <span className="text-sm block">5. (=) RESULTADO OPERACIONAL LÍQUIDO (LUCRO REAL BPO)</span>
                      <span className="text-[11px] font-normal">
                        Margem Operacional: {margin.toFixed(1)}%
                      </span>
                    </div>
                    <span className={`text-xl font-extrabold ${netProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {netProfit >= 0 ? '+' : ''} R$ {netProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Extrato Coins (Only accessible by non-Super ADM) */}
      {activeTab === 'historico_coins' && role !== 'super_adm' && (
        <div className="bg-white p-6 rounded-xl border border-gray-200 space-y-5">
          <h3 className="text-base font-semibold text-gray-900">Recarga de OmniCoins</h3>
          <p className="text-xs text-gray-500">Saldo atual: {balance.toLocaleString('pt-BR')} Coins</p>
        </div>
      )}
    </div>
  );
}
