"use client";

import { useState, useEffect, useMemo } from "react";
import { 
  Users, Plus, Trash2, Briefcase, X, ShieldCheck, Check, 
  CheckCircle2, AlertCircle, UserPlus, Sliders, CheckSquare, Square,
  ChevronDown, ChevronUp, Search, Calendar, ChevronLeft, ChevronRight, 
  Edit3, Save, UserCheck
} from "lucide-react";
import { getActiveRole, UserRole } from "@/lib/auth/roles";
import { 
  getEmployees, saveEmployee, updateEmployee, updateEmployeePermissions, 
  deleteEmployee, EmployeeUser, ALL_SYSTEM_MODULES 
} from "@/lib/company/store";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { fetchCustomJobRoles, saveCustomJobRoles } from "@/lib/db/serverDb";

const DEFAULT_JOB_ROLES = [
  "Gestor de Escritório",
  "Analista Fiscal Sênior",
  "Analista Contábil Pleno",
  "Assistente de Departamento Pessoal",
  "Auxiliar Administrativo & BPO",
  "Consultor Tributário & SPED",
  "Auditor de Compliance Fiscal"
];

const ITEMS_PER_PAGE = 10;

export default function UsuariosPage() {
  const [role, setRole] = useState<UserRole>("gestor");
  const [employees, setEmployees] = useState<EmployeeUser[]>([]);
  const [jobRoles, setJobRoles] = useState<string[]>(DEFAULT_JOB_ROLES);
  
  // Search & Pagination State
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedEmpId, setExpandedEmpId] = useState<string | null>(null);

  // Modals state
  const [showAddRoleModal, setShowAddRoleModal] = useState(false);
  const [newRoleInput, setNewRoleInput] = useState("");
  const [editingEmpPermissions, setEditingEmpPermissions] = useState<EmployeeUser | null>(null);
  const [modalModulesState, setModalModulesState] = useState<string[]>([]);
  
  // Full Edit Modal State
  const [editingEmpFull, setEditingEmpFull] = useState<EmployeeUser | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editBirthDate, setEditBirthDate] = useState("");
  const [editDept, setEditDept] = useState("");
  const [editRole, setEditRole] = useState<'gestor' | 'funcionario'>('funcionario');
  const [editModules, setEditModules] = useState<string[]>([]);

  // Registration state
  const [newEmpName, setNewEmpName] = useState("");
  const [newEmpEmail, setNewEmpEmail] = useState("");
  const [newEmpBirthDate, setNewEmpBirthDate] = useState("");
  const [newEmpDept, setNewEmpDept] = useState("Analista Fiscal Sênior");
  const [newEmpRole, setNewEmpRole] = useState<'gestor' | 'funcionario'>('funcionario');
  const [selectedModules, setSelectedModules] = useState<string[]>(['omni-ia', 'tarefas', 'whatsapp-bot', 'documentos']);
  
  const [deletingEmpId, setDeletingEmpId] = useState<string | null>(null);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    setRole(getActiveRole());
    setEmployees(getEmployees('comp_zenitus'));

    fetchCustomJobRoles().then((savedRoles) => {
      if (savedRoles && savedRoles.length > 0) {
        setJobRoles(savedRoles);
      }
    }).catch(() => {});

    const handleRoleChange = () => setRole(getActiveRole());
    const handleEmployeesChange = () => setEmployees(getEmployees('comp_zenitus'));

    window.addEventListener("omnizeus_role_change", handleRoleChange);
    window.addEventListener("omnizeus_employees_change", handleEmployeesChange);

    return () => {
      window.removeEventListener("omnizeus_role_change", handleRoleChange);
      window.removeEventListener("omnizeus_employees_change", handleEmployeesChange);
    };
  }, []);

  // Filter & Pagination Logic
  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        emp.name.toLowerCase().includes(q) ||
        emp.email.toLowerCase().includes(q) ||
        emp.department.toLowerCase().includes(q)
      );
    });
  }, [employees, searchQuery]);

  const totalPages = Math.ceil(filteredEmployees.length / ITEMS_PER_PAGE) || 1;

  const paginatedEmployees = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredEmployees.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredEmployees, currentPage]);

  const handleCreateNewRole = () => {
    if (!newRoleInput.trim()) {
      setWarningMessage("Por favor, digite o nome do novo cargo.");
      return;
    }
    const roleTitle = newRoleInput.trim();
    if (!jobRoles.includes(roleTitle)) {
      const updated = [...jobRoles, roleTitle];
      setJobRoles(updated);
      saveCustomJobRoles(updated).catch(() => {});
      setNewEmpDept(roleTitle);
      if (editingEmpFull) setEditDept(roleTitle);
    }
    setNewRoleInput("");
    setShowAddRoleModal(false);
  };

  const handleCreateEmployee = () => {
    if (!newEmpName.trim() || !newEmpEmail.trim()) {
      setWarningMessage("Por favor, preencha o Nome e o E-mail do novo colaborador.");
      return;
    }

    saveEmployee({
      companyId: 'comp_zenitus',
      name: newEmpName.trim(),
      email: newEmpEmail.trim(),
      department: newEmpDept,
      role: newEmpRole,
      birthDate: newEmpBirthDate || undefined,
      allowedModules: selectedModules,
      status: 'Ativo'
    });

    setNewEmpName("");
    setNewEmpEmail("");
    setNewEmpBirthDate("");
    setSuccessMessage(`Colaborador ${newEmpName} cadastrado com sucesso!`);
    setTimeout(() => setSuccessMessage(null), 3500);
  };

  const openFullEditModal = (emp: EmployeeUser) => {
    setEditingEmpFull(emp);
    setEditName(emp.name);
    setEditEmail(emp.email);
    setEditBirthDate(emp.birthDate || "");
    setEditDept(emp.department);
    setEditRole(emp.role);
    setEditModules(emp.allowedModules || []);
  };

  const handleSaveFullEdit = () => {
    if (!editingEmpFull) return;
    if (!editName.trim() || !editEmail.trim()) {
      setWarningMessage("Por favor, preencha Nome e E-mail.");
      return;
    }

    updateEmployee({
      id: editingEmpFull.id,
      name: editName.trim(),
      email: editEmail.trim(),
      birthDate: editBirthDate || undefined,
      department: editDept,
      role: editRole,
      allowedModules: editModules
    });

    setEditingEmpFull(null);
    setSuccessMessage(`Dados de ${editName} atualizados com sucesso!`);
    setTimeout(() => setSuccessMessage(null), 3500);
  };

  const confirmDeleteEmp = () => {
    if (!deletingEmpId) return;
    deleteEmployee(deletingEmpId);
    setDeletingEmpId(null);
  };

  const toggleEmpPermission = (empId: string, modId: string) => {
    const targetEmp = employees.find(e => e.id === empId);
    if (!targetEmp) return;
    const current = targetEmp.allowedModules || [];
    const updated = current.includes(modId)
      ? current.filter(m => m !== modId)
      : [...current, modId];
    updateEmployeePermissions(empId, updated);
  };

  const openPermissionModal = (emp: EmployeeUser) => {
    setEditingEmpPermissions(emp);
    setModalModulesState(emp.allowedModules || []);
  };

  const handleSaveModalPermissions = () => {
    if (!editingEmpPermissions) return;
    updateEmployeePermissions(editingEmpPermissions.id, modalModulesState);
    setEditingEmpPermissions(null);
    setSuccessMessage(`Permissões de ${editingEmpPermissions.name} atualizadas!`);
    setTimeout(() => setSuccessMessage(null), 3500);
  };

  // Quick Select Helpers for Registration Form
  const handleRegSelectAll = () => setSelectedModules(ALL_SYSTEM_MODULES.map(m => m.id));
  const handleRegDeselectAll = () => setSelectedModules([]);

  // Quick Select Helpers for Edit Modals
  const handleModalSelectAll = () => setModalModulesState(ALL_SYSTEM_MODULES.map(m => m.id));
  const handleModalDeselectAll = () => setModalModulesState([]);
  const handleEditSelectAll = () => setEditModules(ALL_SYSTEM_MODULES.map(m => m.id));
  const handleEditDeselectAll = () => setEditModules([]);

  if (role === "funcionario") {
    return (
      <div className="p-6 text-center text-slate-500 font-medium">
        Acesso restrito a Gestores.
      </div>
    );
  }

  return (
    <div className="space-y-6 text-slate-900 font-sans pb-12">
      {/* Modal for Creating New Custom Job Role */}
      {showAddRoleModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5 max-w-md w-full shadow-lg space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-[#1E6FD9]" />
                <span>Criar Novo Cargo / Departamento</span>
              </h3>
              <button onClick={() => setShowAddRoleModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                Nome do Novo Cargo / Função:
              </label>
              <input
                type="text"
                placeholder="Ex: Coordenador de BPO & Controladoria"
                value={newRoleInput}
                onChange={(e) => setNewRoleInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateNewRole()}
                className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-bold focus:outline-none focus:border-[#1E6FD9]"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddRoleModal(false)}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCreateNewRole}
                className="px-4 py-1.5 bg-[#1E6FD9] hover:bg-blue-600 text-white text-xs font-semibold rounded-lg shadow-xs"
              >
                Adicionar Cargo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULL EDIT EMPLOYEE MODAL (Editar Todos os Dados do Colaborador) */}
      {editingEmpFull && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 p-6 max-w-xl w-full shadow-xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Edit3 className="w-5 h-5 text-[#1E6FD9]" />
                  <span>Editar Cadastro Completo do Colaborador</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Atualize o nome, e-mail, departamento, função e permissões de acesso.
                </p>
              </div>
              <button onClick={() => setEditingEmpFull(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Nome Completo:</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-bold focus:outline-none focus:border-[#1E6FD9]"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">E-mail Corporativo:</label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-medium focus:outline-none focus:border-[#1E6FD9]"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Data de Nascimento:</label>
                <input
                  type="date"
                  value={editBirthDate}
                  onChange={(e) => setEditBirthDate(e.target.value)}
                  className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-medium focus:outline-none focus:border-[#1E6FD9]"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Cargo / Departamento:</label>
                <div className="flex items-center gap-1.5">
                  <select
                    value={editDept}
                    onChange={(e) => setEditDept(e.target.value)}
                    className="flex-1 h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-bold focus:outline-none focus:border-[#1E6FD9] cursor-pointer truncate"
                  >
                    {jobRoles.map(jr => (
                      <option key={jr} value={jr}>{jr}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowAddRoleModal(true)}
                    className="w-9 h-9 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg flex items-center justify-center transition-colors shrink-0"
                    title="Criar Novo Cargo"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Função de Acesso:</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as any)}
                  className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-bold focus:outline-none focus:border-[#1E6FD9] cursor-pointer"
                >
                  <option value="funcionario">Funcionário Operacional</option>
                  <option value="gestor">Gestor do Escritório</option>
                </select>
              </div>
            </div>

            {/* Módulos Permitidos no Edição Completa */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Permissão por Módulos ({editModules.length}/7):
                </label>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={handleEditSelectAll} className="text-[10px] font-bold text-blue-600 hover:underline">Permitir Todos</button>
                  <span className="text-slate-300">|</span>
                  <button type="button" onClick={handleEditDeselectAll} className="text-[10px] font-bold text-slate-500 hover:underline">Desmarcar Todos</button>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {ALL_SYSTEM_MODULES.map(mod => {
                  const isSelected = editModules.includes(mod.id);
                  return (
                    <button
                      key={mod.id}
                      type="button"
                      onClick={() => {
                        setEditModules(prev => 
                          prev.includes(mod.id) ? prev.filter(m => m !== mod.id) : [...prev, mod.id]
                        );
                      }}
                      className={`px-2.5 py-1 rounded text-xs font-bold border transition-colors ${
                        isSelected
                          ? 'bg-blue-50 text-[#1E6FD9] border-[#1E6FD9]/40'
                          : 'bg-slate-50 text-slate-400 border-slate-200 hover:text-slate-700'
                      }`}
                    >
                      {isSelected ? `✓ ${mod.label}` : `+ ${mod.label}`}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingEmpFull(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveFullEdit}
                className="px-5 py-2 bg-[#1E6FD9] hover:bg-blue-600 text-white text-xs font-semibold rounded-lg shadow-xs flex items-center gap-1.5"
              >
                <Save className="w-4 h-4" />
                <span>Salvar Alterações</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal for Managing Employee Module Permissions */}
      {editingEmpPermissions && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 p-6 max-w-lg w-full shadow-xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-[#1E6FD9]" />
                  <span>Permissões de Acesso aos Módulos</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Colaborador: <strong className="text-slate-900">{editingEmpPermissions.name}</strong> ({editingEmpPermissions.email})
                </p>
              </div>
              <button onClick={() => setEditingEmpPermissions(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Batch Actions */}
            <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-lg border border-slate-200/80">
              <span className="text-xs font-bold text-slate-600">Ações Rápidas:</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleModalSelectAll}
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-md flex items-center gap-1.5 transition-all shadow-xs"
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  <span>Permitir Todos ({ALL_SYSTEM_MODULES.length})</span>
                </button>

                <button
                  type="button"
                  onClick={handleModalDeselectAll}
                  className="px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-all"
                >
                  <Square className="w-3.5 h-3.5" />
                  <span>Desmarcar Todos</span>
                </button>
              </div>
            </div>

            {/* Module Checkboxes */}
            <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
              {ALL_SYSTEM_MODULES.map(mod => {
                const checked = modalModulesState.includes(mod.id);
                return (
                  <label
                    key={mod.id}
                    onClick={() => {
                      setModalModulesState(prev => 
                        prev.includes(mod.id) ? prev.filter(m => m !== mod.id) : [...prev, mod.id]
                      );
                    }}
                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${
                      checked 
                        ? 'bg-blue-50/60 border-[#1E6FD9] text-slate-900 shadow-xs' 
                        : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                        checked ? 'bg-[#1E6FD9] border-[#1E6FD9] text-white' : 'border-slate-300 bg-white'
                      }`}>
                        {checked && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                      <span className="text-xs font-bold">{mod.label}</span>
                    </div>
                    <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded ${
                      checked ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-400'
                    }`}>
                      {checked ? 'Permitido' : 'Bloqueado'}
                    </span>
                  </label>
                );
              })}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingEmpPermissions(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveModalPermissions}
                className="px-5 py-2 bg-[#1E6FD9] hover:bg-blue-600 text-white text-xs font-semibold rounded-lg shadow-xs flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Salvar Permissões</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modals */}
      <ConfirmModal
        isOpen={deletingEmpId !== null}
        onClose={() => setDeletingEmpId(null)}
        onConfirm={confirmDeleteEmp}
        title="Revogar Acesso do Colaborador?"
        description="Esta ação removerá as permissões e a conta do colaborador selecionado."
        confirmText="Remover Colaborador"
        cancelText="Cancelar"
        variant="danger"
      />

      <ConfirmModal
        isOpen={warningMessage !== null}
        onClose={() => setWarningMessage(null)}
        onConfirm={() => setWarningMessage(null)}
        title="Atenção — Dados Incompletos"
        description={warningMessage || ""}
        confirmText="Entendi"
        cancelText="Fechar"
        variant="warning"
      />

      {/* Header Banner */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-5 lg:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-slate-900 tracking-tight">
            Gestão de Usuários e Equipe
          </h1>
          <p className="text-xs lg:text-sm text-slate-500 mt-1">
            Administre a equipe do escritório, edite cadastros, defina atribuições e gerencie permissões por módulos.
          </p>
        </div>
      </div>

      {successMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl flex items-center gap-2 shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Split Dual-Column Layout: Form on Left, List on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Form Cadastrar Novo Colaborador (Organizado Verticalmente) */}
        <div className="lg:col-span-4 bg-white p-5 lg:p-6 rounded-xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-[#1E6FD9]" />
              <span>Cadastrar Novo Colaborador</span>
            </h2>
          </div>

          <div className="space-y-3.5">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Nome Completo:</label>
              <input
                type="text"
                placeholder="Ex: Mariana Castro"
                value={newEmpName}
                onChange={(e) => setNewEmpName(e.target.value)}
                className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-bold focus:outline-none focus:border-[#1E6FD9]"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">E-mail Corporativo:</label>
              <input
                type="email"
                placeholder="mariana@zenitus.com.br"
                value={newEmpEmail}
                onChange={(e) => setNewEmpEmail(e.target.value)}
                className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-medium focus:outline-none focus:border-[#1E6FD9]"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Data de Nascimento (Opcional):</label>
              <input
                type="date"
                value={newEmpBirthDate}
                onChange={(e) => setNewEmpBirthDate(e.target.value)}
                className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-medium focus:outline-none focus:border-[#1E6FD9]"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Cargo / Departamento:</label>
              <div className="flex items-center gap-1.5">
                <select
                  value={newEmpDept}
                  onChange={(e) => setNewEmpDept(e.target.value)}
                  className="flex-1 h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-bold focus:outline-none focus:border-[#1E6FD9] cursor-pointer truncate"
                >
                  {jobRoles.map(jr => (
                    <option key={jr} value={jr}>{jr}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowAddRoleModal(true)}
                  className="w-9 h-9 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg flex items-center justify-center transition-colors shrink-0"
                  title="Criar Novo Cargo Personalizado"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Função de Acesso:</label>
              <select
                value={newEmpRole}
                onChange={(e) => setNewEmpRole(e.target.value as any)}
                className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-bold focus:outline-none focus:border-[#1E6FD9] cursor-pointer"
              >
                <option value="funcionario">Funcionário Operacional</option>
                <option value="gestor">Gestor do Escritório</option>
              </select>
            </div>

            {/* Módulos Permitidos Inicialmente */}
            <div className="pt-2 space-y-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Módulos Iniciais:
                </label>
                <div className="flex items-center gap-1.5 text-[10px] font-bold">
                  <button type="button" onClick={handleRegSelectAll} className="text-blue-600 hover:underline">Todos</button>
                  <span className="text-slate-300">|</span>
                  <button type="button" onClick={handleRegDeselectAll} className="text-slate-400 hover:underline">Nenhum</button>
                </div>
              </div>

              <div className="flex flex-wrap gap-1 max-h-[140px] overflow-y-auto pr-1">
                {ALL_SYSTEM_MODULES.map(mod => {
                  const isSelected = selectedModules.includes(mod.id);
                  return (
                    <button
                      key={mod.id}
                      type="button"
                      onClick={() => {
                        setSelectedModules(prev => 
                          prev.includes(mod.id) ? prev.filter(m => m !== mod.id) : [...prev, mod.id]
                        );
                      }}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                        isSelected
                          ? 'bg-blue-50 text-[#1E6FD9] border-[#1E6FD9]/40'
                          : 'bg-slate-50 text-slate-400 border-slate-200 hover:text-slate-700'
                      }`}
                    >
                      {isSelected ? `✓ ${mod.label}` : `+ ${mod.label}`}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={handleCreateEmployee}
              className="w-full py-2.5 bg-[#1E6FD9] hover:bg-blue-600 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-all shadow-xs mt-2"
            >
              <UserPlus className="w-4 h-4" />
              <span>Cadastrar Colaborador</span>
            </button>
          </div>
        </div>

        {/* Right Column: List of Registered Team Members (Com Edição Completa) */}
        <div className="lg:col-span-8 bg-white p-5 lg:p-6 rounded-xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-[#1E6FD9]" />
              <span>Colaboradores Cadastrados</span>
            </h2>

            {/* Search Bar Input */}
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Buscar por nome, e-mail..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full h-8 pl-8 pr-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-[#1E6FD9]"
              />
            </div>
          </div>

          {/* Compact 1-Line Table */}
          <div className="overflow-x-auto border border-slate-200/80 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider text-[10px] bg-slate-50">
                  <th className="py-2.5 px-3">Colaborador / E-mail</th>
                  <th className="py-2.5 px-3">Cargo / Departamento</th>
                  <th className="py-2.5 px-3">Função</th>
                  <th className="py-2.5 px-3">Permissões</th>
                  <th className="py-2.5 px-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {paginatedEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-400 font-medium">
                      Nenhum colaborador encontrado.
                    </td>
                  </tr>
                ) : (
                  paginatedEmployees.map(emp => {
                    const isExpanded = expandedEmpId === emp.id;
                    const allowedCount = emp.allowedModules?.length || 0;
                    return (
                      <>
                        <tr 
                          key={emp.id} 
                          className={`hover:bg-slate-50/80 transition-colors cursor-pointer ${isExpanded ? 'bg-blue-50/30' : ''}`}
                          onClick={() => setExpandedEmpId(isExpanded ? null : emp.id)}
                        >
                          <td className="py-3 px-3">
                            <span className="font-bold text-slate-900 block">{emp.name}</span>
                            <span className="text-[10px] text-slate-500">{emp.email}</span>
                          </td>

                          <td className="py-3 px-3 font-semibold text-slate-800">
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded-md border border-slate-200/80 font-bold text-[11px] inline-block truncate max-w-[180px]">
                              {emp.department}
                            </span>
                          </td>

                          <td className="py-3 px-3">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase border ${
                              emp.role === 'gestor' 
                                ? 'bg-amber-50 text-amber-800 border-amber-200' 
                                : 'bg-blue-50 text-blue-800 border-blue-200'
                            }`}>
                              {emp.role === 'gestor' ? 'Gestor' : 'Funcionário'}
                            </span>
                          </td>

                          <td className="py-3 px-3">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 ${
                              allowedCount === 7 
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                : allowedCount > 0
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : 'bg-slate-100 text-slate-500 border-slate-200'
                            }`}>
                              <ShieldCheck className="w-3 h-3 shrink-0" />
                              <span>{allowedCount} / 7 Módulos</span>
                            </span>
                          </td>

                          <td className="py-3 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => openFullEditModal(emp)}
                                className="p-1.5 hover:bg-blue-50 text-slate-500 hover:text-[#1E6FD9] rounded transition-colors"
                                title="Editar Cadastro Completo (Nome, E-mail, Cargo, Função)"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>

                              <button
                                onClick={() => openPermissionModal(emp)}
                                className="p-1.5 hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 rounded transition-colors"
                                title="Editar Módulos de Permissão"
                              >
                                <ShieldCheck className="w-4 h-4" />
                              </button>

                              <button
                                onClick={() => setDeletingEmpId(emp.id)}
                                className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded transition-colors"
                                title="Remover Colaborador"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* Expandable Detail Panel */}
                        {isExpanded && (
                          <tr key={`${emp.id}-details`} className="bg-slate-50/90 border-b border-slate-200">
                            <td colSpan={5} className="p-4 space-y-3">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 pb-2">
                                <div className="flex items-center gap-4 text-xs">
                                  {emp.birthDate && (
                                    <span className="flex items-center gap-1.5 text-slate-600 font-medium">
                                      <Calendar className="w-3.5 h-3.5 text-[#1E6FD9]" />
                                      <strong>Data Nasc:</strong> {new Date(emp.birthDate + 'T00:00:00').toLocaleDateString('pt-BR')}
                                    </span>
                                  )}
                                  <span className="text-slate-500">
                                    <strong>Status:</strong> <span className="text-emerald-600 font-bold">Ativo</span>
                                  </span>
                                </div>

                                <button
                                  onClick={() => openFullEditModal(emp)}
                                  className="px-3.5 py-1.5 bg-[#1E6FD9] hover:bg-blue-600 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-xs shrink-0"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                  <span>Editar Todos os Dados</span>
                                </button>
                              </div>

                              <div>
                                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                                  Módulos com Acesso Liberado ({emp.allowedModules?.length || 0}/7):
                                </label>
                                <div className="flex flex-wrap items-center gap-1.5">
                                  {ALL_SYSTEM_MODULES.map(mod => {
                                    const isAllowed = emp.allowedModules?.includes(mod.id);
                                    return (
                                      <button
                                        key={mod.id}
                                        onClick={() => toggleEmpPermission(emp.id, mod.id)}
                                        className={`px-2.5 py-1 rounded text-[10px] font-bold border transition-colors ${
                                          isAllowed
                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                            : 'bg-slate-100 text-slate-400 border-slate-200 hover:text-slate-700 opacity-60'
                                        }`}
                                      >
                                        {isAllowed ? `✓ ${mod.label}` : mod.label}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls (10 Itens por Página) */}
          {filteredEmployees.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 text-xs text-slate-500">
              <span>
                Exibindo <strong>{(currentPage - 1) * ITEMS_PER_PAGE + 1}</strong> a <strong>{Math.min(currentPage * ITEMS_PER_PAGE, filteredEmployees.length)}</strong> de <strong>{filteredEmployees.length}</strong> colaboradores
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg disabled:opacity-40 flex items-center gap-1 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Anterior</span>
                </button>

                <span className="font-bold text-slate-800 px-2">
                  {currentPage} / {totalPages}
                </span>

                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg disabled:opacity-40 flex items-center gap-1 transition-colors"
                >
                  <span>Próximo</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
