"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  FileText, Plus, Search, Filter, Calendar, TrendingUp, AlertTriangle, 
  CheckCircle2, DollarSign, Clock, RefreshCw, FileCheck, Edit2, ShieldAlert, ArrowUpRight, Download, Users, ArrowRight, Trash2, X
} from "lucide-react";
import { getActiveRole, UserRole } from "@/lib/auth/roles";
import { fetchContracts, insertContract, updateContract, deleteContract } from "@/lib/db/serverDb";

export interface BpoContract {
  id: string;
  contractNumber: string;
  clientName: string;
  cnpj: string;
  monthlyFeeBrl: number;
  adjustmentIndex: 'IPCA' | 'IGP-M' | 'Fixo' | 'INPC';
  lastAdjustmentDate: string;
  nextAdjustmentDate: string;
  startDate: string;
  endDate: string;
  entriesLimit: number; // Ex: limite de 150 lançamentos/mês
  costCenter: 'Fiscal' | 'Departamento Pessoal' | 'BPO Financeiro' | 'Contábil' | 'Societário';
  allocatedHoursMonth: number; // Horas gastas da equipe este mês
  hourlyRateBrl: number; // Custo hora médio da equipe (ex: R$ 45,00/h)
  status: 'Ativo' | 'Em Reajuste' | 'Vencendo' | 'Cancelado';
}

const DEFAULT_CONTRACTS: BpoContract[] = [
  {
    id: "ct_301",
    contractNumber: "CTR-2026-001",
    clientName: "Atacadão das Tintas Salvador Ltda",
    cnpj: "12.345.678/0001-90",
    monthlyFeeBrl: 4850.00,
    adjustmentIndex: "IPCA",
    lastAdjustmentDate: "2025-08-01",
    nextAdjustmentDate: "2026-08-01",
    startDate: "2025-08-01",
    endDate: "2026-08-01",
    entriesLimit: 500,
    costCenter: "BPO Financeiro",
    allocatedHoursMonth: 24,
    hourlyRateBrl: 55.00,
    status: "Em Reajuste"
  },
  {
    id: "ct_302",
    contractNumber: "CTR-2026-002",
    clientName: "Supermercado Nova Era Eireli",
    cnpj: "98.765.432/0001-10",
    monthlyFeeBrl: 7200.00,
    adjustmentIndex: "IGP-M",
    lastAdjustmentDate: "2025-09-15",
    nextAdjustmentDate: "2026-08-15",
    startDate: "2025-08-15",
    endDate: "2026-08-15",
    entriesLimit: 800,
    costCenter: "Contábil",
    allocatedHoursMonth: 35,
    hourlyRateBrl: 60.00,
    status: "Vencendo"
  },
  {
    id: "ct_303",
    contractNumber: "CTR-2026-003",
    clientName: "Clínica Médica Vida & Saúde S/S",
    cnpj: "45.678.912/0001-33",
    monthlyFeeBrl: 3900.00,
    adjustmentIndex: "IPCA",
    lastAdjustmentDate: "2025-10-01",
    nextAdjustmentDate: "2026-10-01",
    startDate: "2025-10-01",
    endDate: "2026-10-01",
    entriesLimit: 350,
    costCenter: "Fiscal",
    allocatedHoursMonth: 18,
    hourlyRateBrl: 50.00,
    status: "Ativo"
  },
  {
    id: "ct_304",
    contractNumber: "CTR-2026-004",
    clientName: "Alfa Logística Ltda",
    cnpj: "11.222.333/0001-44",
    monthlyFeeBrl: 3500.00,
    adjustmentIndex: "IPCA",
    lastAdjustmentDate: "2025-11-01",
    nextAdjustmentDate: "2026-11-01",
    startDate: "2025-11-01",
    endDate: "2026-11-01",
    entriesLimit: 250,
    costCenter: "BPO Financeiro",
    allocatedHoursMonth: 20,
    hourlyRateBrl: 50.00,
    status: "Ativo"
  },
  {
    id: "ct_305",
    contractNumber: "CTR-2026-005",
    clientName: "Beta Distribuidora de Alimentos S.A.",
    cnpj: "22.333.444/0001-55",
    monthlyFeeBrl: 5200.00,
    adjustmentIndex: "IGP-M",
    lastAdjustmentDate: "2025-12-01",
    nextAdjustmentDate: "2026-12-01",
    startDate: "2025-12-01",
    endDate: "2026-12-01",
    entriesLimit: 400,
    costCenter: "Contábil",
    allocatedHoursMonth: 30,
    hourlyRateBrl: 55.00,
    status: "Ativo"
  },
  {
    id: "ct_306",
    contractNumber: "CTR-2026-006",
    clientName: "Delta Tecnologia & Inovação Ltda",
    cnpj: "33.444.555/0001-88",
    monthlyFeeBrl: 3800.00,
    adjustmentIndex: "INPC",
    lastAdjustmentDate: "2025-01-05",
    nextAdjustmentDate: "2026-01-05",
    startDate: "2025-01-05",
    endDate: "2026-01-05",
    entriesLimit: 300,
    costCenter: "Departamento Pessoal",
    allocatedHoursMonth: 22,
    hourlyRateBrl: 52.00,
    status: "Cancelado"
  }
];


function normalizeContract(item: any): BpoContract {
  return {
    id: item.id || `ct_${Date.now()}_${Math.random()}`,
    contractNumber: item.contractNumber || item.contract_number || `CTR-2026-${Math.floor(Math.random()*900+100)}`,
    clientName: item.clientName || item.client_name || "Cliente Sem Nome",
    cnpj: item.cnpj || "00.000.000/0001-00",
    monthlyFeeBrl: Number(item.monthlyFeeBrl ?? item.monthly_fee_brl ?? 0),
    adjustmentIndex: item.adjustmentIndex || item.adjustment_index || "IPCA",
    lastAdjustmentDate: item.lastAdjustmentDate || item.last_adjustment_date || new Date().toISOString().split("T")[0],
    nextAdjustmentDate: item.nextAdjustmentDate || item.next_adjustment_date || new Date(Date.now() + 365*86400000).toISOString().split("T")[0],
    startDate: item.startDate || item.start_date || new Date().toISOString().split("T")[0],
    endDate: item.endDate || item.end_date || new Date(Date.now() + 365*86400000).toISOString().split("T")[0],
    entriesLimit: Number(item.entriesLimit ?? item.entries_limit ?? 200),
    costCenter: item.costCenter || item.cost_center || "BPO Financeiro",
    allocatedHoursMonth: Number(item.allocatedHoursMonth ?? item.allocated_hours_month ?? 15),
    hourlyRateBrl: Number(item.hourlyRateBrl ?? item.hourly_rate_brl ?? 50),
    status: item.status || "Ativo"
  };
}

export default function ContratosPage() {
  const [role, setRole] = useState<UserRole>("gestor");
  const [contracts, setContracts] = useState<BpoContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("Todos");
  const [costCenterFilter, setCostCenterFilter] = useState<string>("Todos");
  const [indexFilter, setIndexFilter] = useState<string>("Todos");

  // New & Edit Contract Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingContractId, setEditingContractId] = useState<string | null>(null);
  const [clientNameInput, setClientNameInput] = useState("");
  const [cnpjInput, setCnpjInput] = useState("");
  const [monthlyFeeInput, setMonthlyFeeInput] = useState("3500,00");
  const [indexInput, setIndexInput] = useState<'IPCA' | 'IGP-M' | 'Fixo' | 'INPC'>("IPCA");
  const [costCenterInput, setCostCenterInput] = useState<'Fiscal' | 'Departamento Pessoal' | 'BPO Financeiro' | 'Contábil' | 'Societário'>("BPO Financeiro");
  const [entriesLimitInput, setEntriesLimitInput] = useState(200);
  const [allocatedHoursInput, setAllocatedHoursInput] = useState(20);
  const [hourlyRateInput, setHourlyRateInput] = useState("50,00");
  const [statusInput, setStatusInput] = useState<'Ativo' | 'Em Reajuste' | 'Vencendo' | 'Cancelado'>("Ativo");
  const [startDateInput, setStartDateInput] = useState(new Date().toISOString().split('T')[0]);
  const [endDateInput, setEndDateInput] = useState(new Date(Date.now() + 365*24*3600*1000).toISOString().split('T')[0]);
  const [nextAdjustmentDateInput, setNextAdjustmentDateInput] = useState(new Date(Date.now() + 365*24*3600*1000).toISOString().split('T')[0]);

  // Adjustment Modal State
  const [adjustingContract, setAdjustingContract] = useState<BpoContract | null>(null);
  const [adjustmentPercentage, setAdjustmentPercentage] = useState("4.85");

  // Delete Confirmation State
  const [deletingContractId, setDeletingContractId] = useState<string | null>(null);

  // Success Notice
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

  useEffect(() => {
    setRole(getActiveRole());
    loadContracts();

    const handleRoleChange = () => {
      setRole(getActiveRole());
      loadContracts();
    };
    const handleContextChange = () => {
      loadContracts();
    };

    window.addEventListener("omnizeus_role_change", handleRoleChange);
    window.addEventListener("omnizeus_company_context_change", handleContextChange);
    window.addEventListener("omnizeus_sql_db_change", handleContextChange);

    return () => {
      window.removeEventListener("omnizeus_role_change", handleRoleChange);
      window.removeEventListener("omnizeus_company_context_change", handleContextChange);
      window.removeEventListener("omnizeus_sql_db_change", handleContextChange);
    };
  }, []);

  const loadContracts = async () => {
    setLoading(true);
    try {
      const data = await fetchContracts();
      if (Array.isArray(data)) {
        setContracts(data.map(normalizeContract));
      } else {
        setContracts([]);
      }
    } catch (e) {
      console.error("Error loading contracts from serverDb:", e);
      setContracts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreateModal = () => {
    setEditingContractId(null);
    setClientNameInput("");
    setCnpjInput("");
    setMonthlyFeeInput("3500,00");
    setIndexInput("IPCA");
    setCostCenterInput("BPO Financeiro");
    setEntriesLimitInput(200);
    setAllocatedHoursInput(20);
    setHourlyRateInput("50,00");
    setStatusInput("Ativo");
    setStartDateInput(new Date().toISOString().split('T')[0]);
    setEndDateInput(new Date(Date.now() + 365*24*3600*1000).toISOString().split('T')[0]);
    setNextAdjustmentDateInput(new Date(Date.now() + 365*24*3600*1000).toISOString().split('T')[0]);
    setShowModal(true);
  };

  const handleOpenEditModal = (c: BpoContract) => {
    setEditingContractId(c.id);
    setClientNameInput(c.clientName);
    setCnpjInput(c.cnpj);
    setMonthlyFeeInput(c.monthlyFeeBrl.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
    setIndexInput(c.adjustmentIndex);
    setCostCenterInput(c.costCenter);
    setEntriesLimitInput(c.entriesLimit);
    setAllocatedHoursInput(c.allocatedHoursMonth);
    setHourlyRateInput(c.hourlyRateBrl.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
    setStatusInput(c.status);
    setStartDateInput(c.startDate || new Date().toISOString().split('T')[0]);
    setEndDateInput(c.endDate || new Date(Date.now() + 365*24*3600*1000).toISOString().split('T')[0]);
    setNextAdjustmentDateInput(c.nextAdjustmentDate || new Date(Date.now() + 365*24*3600*1000).toISOString().split('T')[0]);
    setShowModal(true);
  };

  const handleSaveContract = async () => {
    if (!clientNameInput.trim() || !cnpjInput.trim()) return;

    const feeVal = parseFloat(monthlyFeeInput.replace(/\./g, '').replace(',', '.')) || 0;
    const rateVal = parseFloat(hourlyRateInput.replace(/\./g, '').replace(',', '.')) || 50;

    if (editingContractId) {
      const existing = contracts.find(c => c.id === editingContractId);
      const updatedContract: BpoContract = {
        ...existing!,
        clientName: clientNameInput.trim(),
        cnpj: cnpjInput.trim(),
        monthlyFeeBrl: feeVal,
        adjustmentIndex: indexInput,
        costCenter: costCenterInput,
        entriesLimit: entriesLimitInput,
        allocatedHoursMonth: allocatedHoursInput,
        hourlyRateBrl: rateVal,
        status: statusInput,
        startDate: startDateInput,
        endDate: endDateInput,
        nextAdjustmentDate: nextAdjustmentDateInput
      };

      await updateContract(updatedContract);
      setContracts(prev => prev.map(c => c.id === editingContractId ? updatedContract : c));
      setNoticeMessage(`Contrato ${updatedContract.contractNumber} atualizado com sucesso!`);
    } else {
      const count = contracts.length + 88;
      const ctrNum = `CTR-2026-${String(count).padStart(3, '0')}`;

      const newCtr: BpoContract = {
        id: `ct_${Date.now()}`,
        contractNumber: ctrNum,
        clientName: clientNameInput.trim(),
        cnpj: cnpjInput.trim(),
        monthlyFeeBrl: feeVal,
        adjustmentIndex: indexInput,
        lastAdjustmentDate: new Date().toISOString().split('T')[0],
        nextAdjustmentDate: nextAdjustmentDateInput || new Date(Date.now() + 365*24*3600*1000).toISOString().split('T')[0],
        startDate: startDateInput || new Date().toISOString().split('T')[0],
        endDate: endDateInput || new Date(Date.now() + 365*24*3600*1000).toISOString().split('T')[0],
        entriesLimit: entriesLimitInput,
        costCenter: costCenterInput,
        allocatedHoursMonth: allocatedHoursInput,
        hourlyRateBrl: rateVal,
        status: statusInput
      };

      await insertContract(newCtr);
      setContracts(prev => [newCtr, ...prev]);
      setNoticeMessage(`Contrato ${ctrNum} registrado e salvo no servidor SQLite!`);
    }

    setShowModal(false);
    setTimeout(() => setNoticeMessage(null), 3000);
  };

  const handleApplyAdjustment = async () => {
    if (!adjustingContract) return;

    const pct = parseFloat(adjustmentPercentage.replace(',', '.')) || 0;
    const oldFee = adjustingContract.monthlyFeeBrl;
    const newFee = oldFee * (1 + pct / 100);

    const updatedContract: BpoContract = {
      ...adjustingContract,
      monthlyFeeBrl: newFee,
      lastAdjustmentDate: new Date().toISOString().split('T')[0],
      nextAdjustmentDate: new Date(Date.now() + 365*24*3600*1000).toISOString().split('T')[0],
      status: 'Ativo'
    };

    await updateContract(updatedContract);
    setContracts(prev => prev.map(c => c.id === adjustingContract.id ? updatedContract : c));
    setAdjustingContract(null);
    setNoticeMessage(`Reajuste de +${pct}% aplicado! Novo valor: R$ ${newFee.toFixed(2)}.`);
    setTimeout(() => setNoticeMessage(null), 3000);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingContractId) return;
    await deleteContract(deletingContractId);
    setContracts(prev => prev.filter(c => c.id !== deletingContractId));
    setDeletingContractId(null);
    setNoticeMessage("Contrato removido com sucesso!");
    setTimeout(() => setNoticeMessage(null), 3000);
  };

  const filteredContracts = contracts.filter(c => {
    const matchesStatus = statusFilter === 'Todos' || c.status === statusFilter;
    const matchesCostCenter = costCenterFilter === 'Todos' || c.costCenter === costCenterFilter;
    const matchesIndex = indexFilter === 'Todos' || c.adjustmentIndex === indexFilter;
    const matchesSearch = c.clientName.toLowerCase().includes(search.toLowerCase()) ||
                          c.cnpj.includes(search) ||
                          c.contractNumber.toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesCostCenter && matchesIndex && matchesSearch;
  });

  // Calculate Portfolio Totals
  const totalMrrBrl = contracts.filter(c => c.status !== 'Cancelado').reduce((acc, c) => acc + c.monthlyFeeBrl, 0);
  const totalAllocatedHours = contracts.reduce((acc, c) => acc + c.allocatedHoursMonth, 0);

  return (
    <div className="space-y-6 text-slate-900 font-sans">
      {/* Module Navigation Breadcrumbs Bar */}
      <div className="flex items-center justify-between bg-slate-50 border border-slate-200/80 rounded-xl px-4 py-2 text-xs">
        <div className="flex items-center gap-2 text-slate-600 font-medium">
          <span className="text-slate-400">Módulos Financeiros:</span>
          <span className="font-bold text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">Contratos BPO</span>
          <span className="text-slate-300">•</span>
          <Link href="/financeiro" className="hover:text-primary transition-colors flex items-center gap-1">
            <span>Financeiro & Payables</span>
          </Link>
          <span className="text-slate-300">•</span>
          <Link href="/solicitacoes" className="hover:text-primary transition-colors flex items-center gap-1">
            <span>Solicitações & Compras</span>
          </Link>
          <span className="text-slate-300">•</span>
          <Link href="/contaazul" className="hover:text-primary transition-colors flex items-center gap-1">
            <span>Integração ContaAzul</span>
          </Link>
        </div>
      </div>

      {/* Readjustment Modal */}
      {adjustingContract && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 p-6 max-w-md w-full shadow-lg relative space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-purple-600" />
                <span>Simular / Aplicar Reajuste de Contrato</span>
              </h3>
              <button onClick={() => setAdjustingContract(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-600">
                Cliente: <strong className="text-slate-900">{adjustingContract.clientName}</strong> ({adjustingContract.contractNumber})
              </p>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Valor Atual:</span>
                  <span className="font-extrabold text-slate-900 text-sm">
                    R$ {adjustingContract.monthlyFeeBrl.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <span className="px-2 py-1 rounded bg-purple-100 text-purple-700 font-bold text-[10px]">
                  Índice: {adjustingContract.adjustmentIndex}
                </span>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Percentual de Reajuste Anual (%):
                </label>
                <input
                  type="text"
                  value={adjustmentPercentage}
                  onChange={(e) => setAdjustmentPercentage(e.target.value)}
                  className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-bold focus:outline-none focus:border-purple-600"
                />
              </div>

              <div className="p-3 bg-emerald-50 border border-emerald-200/60 rounded-lg">
                <span className="text-[10px] text-emerald-800 uppercase font-bold block mb-0.5">Novo Valor Calculado:</span>
                <span className="text-base font-extrabold text-emerald-700">
                  R$ {(adjustingContract.monthlyFeeBrl * (1 + (parseFloat(adjustmentPercentage.replace(',', '.'))||0)/100)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} /mês
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setAdjustingContract(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleApplyAdjustment}
                className="px-5 py-2 bg-purple-700 hover:bg-purple-800 text-white text-xs font-semibold rounded-lg shadow-xs"
              >
                Confirmar & Aplicar Reajuste
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingContractId && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 p-6 max-w-sm w-full shadow-lg space-y-4">
            <div className="flex items-center gap-2 text-red-600 font-bold text-sm">
              <AlertTriangle className="w-5 h-5" />
              <span>Confirmar Exclusão</span>
            </div>
            <p className="text-xs text-slate-600">
              Tem certeza que deseja remover permanentemente este contrato de honorários? Esta ação não pode ser desfeita.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setDeletingContractId(null)}
                className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg"
              >
                Excluir Contrato
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New / Edit Contract Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 p-6 max-w-md w-full shadow-lg relative space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                <span>{editingContractId ? 'Editar Contrato BPO' : 'Novo Contrato de Honorários BPO'}</span>
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Cliente / Razão Social:</label>
                <input
                  type="text"
                  placeholder="Ex: Alfa Logística Ltda"
                  value={clientNameInput}
                  onChange={(e) => setClientNameInput(e.target.value)}
                  className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-medium focus:outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">CNPJ:</label>
                  <input
                    type="text"
                    placeholder="00.000.000/0001-00"
                    value={cnpjInput}
                    onChange={(e) => setCnpjInput(e.target.value)}
                    className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-medium focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Honorário Mensal (R$):</label>
                  <input
                    type="text"
                    value={monthlyFeeInput}
                    onChange={(e) => setMonthlyFeeInput(e.target.value)}
                    className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-bold focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Índice de Reajuste:</label>
                  <select
                    value={indexInput}
                    onChange={(e) => setIndexInput(e.target.value as any)}
                    className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-bold focus:outline-none focus:border-primary cursor-pointer"
                  >
                    <option value="IPCA">IPCA (IBGE)</option>
                    <option value="IGP-M">IGP-M (FGV)</option>
                    <option value="INPC">INPC</option>
                    <option value="Fixo">Fixo Sem Reajuste</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Centro de Custo Principal:</label>
                  <select
                    value={costCenterInput}
                    onChange={(e) => setCostCenterInput(e.target.value as any)}
                    className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-bold focus:outline-none focus:border-primary cursor-pointer"
                  >
                    <option value="BPO Financeiro">BPO Financeiro</option>
                    <option value="Fiscal">Escrituração Fiscal</option>
                    <option value="Contábil">Contabilidade Geral</option>
                    <option value="Departamento Pessoal">Departamento Pessoal</option>
                    <option value="Societário">Societário & Legal</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Horas Alocadas:</label>
                  <input
                    type="number"
                    value={allocatedHoursInput}
                    onChange={(e) => setAllocatedHoursInput(Number(e.target.value))}
                    className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-medium focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Custo Hora (R$):</label>
                  <input
                    type="text"
                    value={hourlyRateInput}
                    onChange={(e) => setHourlyRateInput(e.target.value)}
                    className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-medium focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Status:</label>
                  <select
                    value={statusInput}
                    onChange={(e) => setStatusInput(e.target.value as any)}
                    className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-bold focus:outline-none focus:border-primary cursor-pointer"
                  >
                    <option value="Ativo">Ativo</option>
                    <option value="Vencendo">Vencendo</option>
                    <option value="Em Reajuste">Em Reajuste</option>
                    <option value="Cancelado">Cancelado</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Início Vigência:</label>
                  <input
                    type="date"
                    value={startDateInput}
                    onChange={(e) => setStartDateInput(e.target.value)}
                    className="w-full h-9 px-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-medium focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Vencimento Contrato:</label>
                  <input
                    type="date"
                    value={endDateInput}
                    onChange={(e) => setEndDateInput(e.target.value)}
                    className="w-full h-9 px-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-medium focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Próx. Reajuste:</label>
                  <input
                    type="date"
                    value={nextAdjustmentDateInput}
                    onChange={(e) => setNextAdjustmentDateInput(e.target.value)}
                    className="w-full h-9 px-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-medium focus:outline-none focus:border-primary"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveContract}
                className="px-5 py-2 bg-primary hover:opacity-90 text-white text-xs font-semibold rounded-lg shadow-xs"
              >
                {editingContractId ? 'Salvar Alterações' : 'Cadastrar Contrato'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-5 lg:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-slate-900 tracking-tight">
            Central de Contratos de Honorários BPO
          </h1>
          <p className="text-xs lg:text-sm text-slate-500 mt-1">
            Gestão de vigência, reajustes anuais (IPCA/IGP-M) e apuração de rentabilidade por cliente (TOTVS Architecture)
          </p>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="px-5 py-2.5 bg-primary hover:opacity-90 text-white text-xs font-semibold rounded-lg flex items-center gap-2 transition-all shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>Novo Contrato</span>
        </button>
      </div>

      {noticeMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200/60 text-emerald-800 text-xs font-semibold rounded-xl flex items-center gap-2 shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{noticeMessage}</span>
        </div>
      )}

      {/* Contract KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Faturamento Carteira (MRR)</span>
            <span className="text-2xl font-extrabold text-slate-900">
              R$ {totalMrrBrl.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 block mb-1">Reajustes Pendentes</span>
            <span className="text-2xl font-extrabold text-slate-900">
              {contracts.filter(c => c.status === 'Vencendo' || c.status === 'Em Reajuste').length} Clientes
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <RefreshCw className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 block mb-1">Horas Alocadas Equipe</span>
            <span className="text-2xl font-extrabold text-slate-900">{totalAllocatedHours} h/mês</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 block mb-1">Margem Média da Carteira</span>
            <span className="text-2xl font-extrabold text-emerald-700">
              {contracts.length > 0
                ? (contracts.reduce((acc, c) => acc + ((c.monthlyFeeBrl - (c.allocatedHoursMonth * c.hourlyRateBrl)) / c.monthlyFeeBrl * 100), 0) / contracts.length).toFixed(1)
                : '0.0'}%
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Table & Advanced Filter Bar */}
      <div className="bg-white p-5 lg:p-6 rounded-xl border border-slate-200/80 shadow-xs space-y-4">
        {/* Filters */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex flex-wrap items-center gap-2">
            {/* Status Filter */}
            <div className="flex items-center gap-1 bg-slate-50 border border-slate-200/80 p-1 rounded-lg">
              <span className="text-[10px] font-bold text-slate-400 uppercase px-1">Status:</span>
              {(['Todos', 'Ativo', 'Vencendo', 'Em Reajuste', 'Cancelado'] as const).map(st => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                    statusFilter === st 
                      ? 'bg-primary text-white shadow-xs' 
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            {/* Cost Center Filter */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/80 px-2 py-1 rounded-lg text-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Centro de Custo:</span>
              <select
                value={costCenterFilter}
                onChange={(e) => setCostCenterFilter(e.target.value)}
                className="bg-transparent font-semibold text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="Todos">Todos os Centros</option>
                <option value="BPO Financeiro">BPO Financeiro</option>
                <option value="Fiscal">Fiscal</option>
                <option value="Contábil">Contábil</option>
                <option value="Departamento Pessoal">Departamento Pessoal</option>
                <option value="Societário">Societário</option>
              </select>
            </div>

            {/* Index Filter */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/80 px-2 py-1 rounded-lg text-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Índice:</span>
              <select
                value={indexFilter}
                onChange={(e) => setIndexFilter(e.target.value)}
                className="bg-transparent font-semibold text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="Todos">Todos os Índices</option>
                <option value="IPCA">IPCA</option>
                <option value="IGP-M">IGP-M</option>
                <option value="INPC">INPC</option>
                <option value="Fixo">Fixo</option>
              </select>
            </div>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar cliente, CNPJ ou contrato..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full lg:w-64 h-8 pl-8 pr-3 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider text-[10px] bg-slate-50">
                <th className="py-3 px-4">Contrato</th>
                <th className="py-3 px-4">Cliente / CNPJ</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Centro de Custo</th>
                <th className="py-3 px-4 text-right">Honorário Mensal</th>
                <th className="py-3 px-4 text-center">Vigência / Vencimento</th>
                <th className="py-3 px-4 text-center">Índice / Próx. Reajuste</th>
                <th className="py-3 px-4 text-right">Rentabilidade (Margem)</th>
                <th className="py-3 px-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    Carregando contratos via servidor SQLite...
                  </td>
                </tr>
              ) : filteredContracts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    Nenhum contrato encontrado para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredContracts.map(c => {
                  const teamCostBrl = c.allocatedHoursMonth * c.hourlyRateBrl;
                  const profitBrl = c.monthlyFeeBrl - teamCostBrl;
                  const marginPct = c.monthlyFeeBrl > 0 ? (profitBrl / c.monthlyFeeBrl) * 100 : 0;

                  return (
                    <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">{c.contractNumber}</td>
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-slate-900 block">{c.clientName}</span>
                        <span className="text-[10px] text-slate-500 font-mono">{c.cnpj}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border inline-flex items-center gap-1 ${
                          c.status === 'Ativo' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          c.status === 'Vencendo' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                          c.status === 'Em Reajuste' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                          'bg-slate-100 text-slate-500 border-slate-200'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            c.status === 'Ativo' ? 'bg-emerald-500' :
                            c.status === 'Vencendo' ? 'bg-amber-500 animate-pulse' :
                            c.status === 'Em Reajuste' ? 'bg-purple-500' :
                            'bg-slate-400'
                          }`} />
                          {c.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-bold border border-slate-200">
                          {c.costCenter}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-extrabold text-slate-900">
                        R$ {c.monthlyFeeBrl.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`font-bold block text-[11px] ${c.status === 'Vencendo' ? 'text-amber-700 font-extrabold' : 'text-slate-800'}`}>
                          Até: {c.endDate || 'N/I'}
                        </span>
                        <span className="text-[10px] text-slate-400">De: {c.startDate || 'N/I'}</span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="font-bold text-purple-700 block">{c.adjustmentIndex}</span>
                        <span className="text-[10px] text-slate-500">{c.nextAdjustmentDate}</span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <span className={`font-extrabold block ${marginPct >= 50 ? 'text-emerald-700' : 'text-amber-600'}`}>
                          {marginPct.toFixed(1)}% Margem
                        </span>
                        <span className="text-[10px] text-slate-500">{c.allocatedHoursMonth}h gastas (Custo R$ {teamCostBrl.toFixed(0)})</span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setAdjustingContract(c)}
                            className="px-2 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded text-[10px] font-bold transition-colors inline-flex items-center gap-1"
                            title="Simular e Aplicar Reajuste Anual"
                          >
                            <RefreshCw className="w-3 h-3" />
                            <span>Reajustar</span>
                          </button>
                          <button
                            onClick={() => handleOpenEditModal(c)}
                            className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
                            title="Editar Contrato"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeletingContractId(c.id)}
                            className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Excluir Contrato"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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
      </div>
    </div>
  );
}
