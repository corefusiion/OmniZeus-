"use client";

import { useState, useEffect, useMemo } from "react";
import { 
  Users, Plus, Trash2, Briefcase, X, ShieldCheck, Check, 
  CheckCircle2, AlertCircle, UserPlus, Sliders, CheckSquare, Square,
  ChevronDown, ChevronUp, Search, Calendar, ChevronLeft, ChevronRight, 
  Edit3, Save, UserCheck, KeyRound, Copy, Lock, ShieldAlert, RefreshCw, Power
} from "lucide-react";
import { getActiveRole, UserRole, getActiveCompanyId } from "@/lib/auth/roles";
import { 
  getEmployees, saveEmployee, updateEmployee, updateEmployeePermissions, 
  deleteEmployee, EmployeeUser, ALL_SYSTEM_MODULES 
} from "@/lib/company/store";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { fetchCustomJobRoles, saveCustomJobRoles, insertAuditLog } from "@/lib/db/serverDb";
import { generateTemporaryPassword, hashPassword } from "@/lib/auth/passwordUtils";
import BatchUserUpload from "@/components/employees/BatchUserUpload";

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
  const [activeCompanyId, setActiveCompanyId] = useState<string>("global");
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
  
  // Temporary Password Modal State
  const [createdTempPassModal, setCreatedTempPassModal] = useState<{ password: string; name: string; email: string; title: string } | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  // Reset Password Confirm Modal State
  const [resetConfirmEmp, setResetConfirmEmp] = useState<EmployeeUser | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  const [deletingEmpId, setDeletingEmpId] = useState<string | null>(null);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    setRole(getActiveRole());
    const compId = getActiveCompanyId();
    setActiveCompanyId(compId);
    setEmployees(getEmployees(compId === 'global' ? undefined : compId));

    fetchCustomJobRoles().then((savedRoles) => {
      if (savedRoles && savedRoles.length > 0) {
        setJobRoles(savedRoles);
      }
    }).catch(() => {});

    const handleRoleChange = () => {
      setRole(getActiveRole());
      const currentCompId = getActiveCompanyId();
      setActiveCompanyId(currentCompId);
      setEmployees(getEmployees(currentCompId === 'global' ? undefined : currentCompId));
    };
    const handleEmployeesChange = () => {
      const currentCompId = getActiveCompanyId();
      setEmployees(getEmployees(currentCompId === 'global' ? undefined : currentCompId));
    };

    window.addEventListener("omnizeus_role_change", handleRoleChange);
    window.addEventListener("omnizeus_employees_change", handleEmployeesChange);
    window.addEventListener("omnizeus_company_context_change", handleRoleChange);

    return () => {
      window.removeEventListener("omnizeus_role_change", handleRoleChange);
      window.removeEventListener("omnizeus_employees_change", handleEmployeesChange);
      window.removeEventListener("omnizeus_company_context_change", handleRoleChange);
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

  const handleCreateEmployee = async () => {
    if (!newEmpName.trim() || !newEmpEmail.trim()) {
      setWarningMessage("Por favor, preencha o Nome e o E-mail do novo colaborador.");
      return;
    }

    // Generate random secure temporary password
    const tempPass = generateTemporaryPassword();
    const hashedPass = await hashPassword(tempPass);

    const targetCompanyId = activeCompanyId === 'global' ? 'comp_default' : activeCompanyId;

    const newEmp = saveEmployee({
      companyId: targetCompanyId,
      name: newEmpName.trim(),
      email: newEmpEmail.trim(),
      department: newEmpDept,
      role: newEmpRole,
      birthDate: newEmpBirthDate || undefined,
      allowedModules: selectedModules,
      status: 'Primeiro acesso pendente',
      mustChangePassword: true,
      passwordHash: hashedPass
    });

    insertAuditLog({
      company_id: targetCompanyId,
      user_name: newEmpName.trim(),
      action: `Colaborador ${newEmpName.trim()} (${newEmpEmail.trim()}) criado com senha temporária`,
      resource: "Usuários & Equipe"
    }).catch(() => {});

    setNewEmpName("");
    setNewEmpEmail("");
    setNewEmpBirthDate("");

    // Display temporary password modal to Gestor
    setCreatedTempPassModal({
      password: tempPass,
      name: newEmp.name,
      email: newEmp.email,
      title: "Senha Temporária Gerada para Cadastro"
    });
  };

  const handleResetPasswordConfirmed = async () => {
    if (!resetConfirmEmp) return;
    setIsResetting(true);

    try {
      const response = await fetch('/api/employees/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: resetConfirmEmp.id })
      });

      const data = await response.json();
      setIsResetting(false);

      if (!response.ok || !data.success) {
        alert(data.error || "Erro ao resetar senha.");
        setResetConfirmEmp(null);
        return;
      }

      setResetConfirmEmp(null);
      setCreatedTempPassModal({
        password: data.temporaryPassword,
        name: resetConfirmEmp.name,
        email: resetConfirmEmp.email,
        title: "Nova Senha Temporária Gerada (Reset)"
      });
    } catch (err: any) {
      setIsResetting(false);
      alert(err.message || "Erro de conexão ao resetar senha.");
      setResetConfirmEmp(null);
    }
  };

  const handleToggleEmployeeStatus = (emp: EmployeeUser) => {
    const newStatus = emp.status === 'Ativo' ? 'Bloqueado' : 'Ativo';
    updateEmployee({
      id: emp.id,
      status: newStatus
    });

    insertAuditLog({
      company_id: emp.companyId,
      user_name: emp.name,
      action: `Status do colaborador ${emp.name} alterado para ${newStatus}`,
      resource: "Usuários & Equipe"
    }).catch(() => {});

    setSuccessMessage(`Status do colaborador ${emp.name} alterado para ${newStatus}!`);
    setTimeout(() => setSuccessMessage(null), 3000);
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
    if (!editName.trim()) {
      setWarningMessage("Por favor, preencha o Nome.");
      return;
    }

    updateEmployee({
      id: editingEmpFull.id,
      name: editName.trim(),
      birthDate: editBirthDate || undefined,
      department: editDept,
      role: editRole,
      allowedModules: editModules
    });

    insertAuditLog({
      company_id: editingEmpFull.companyId,
      user_name: editName.trim(),
      action: `Cadastro do colaborador ${editName.trim()} editado pelo Gestor`,
      resource: "Usuários & Equipe"
    }).catch(() => {});

    setEditingEmpFull(null);
    setSuccessMessage(`Dados de ${editName} atualizados com sucesso!`);
    setTimeout(() => setSuccessMessage(null), 3500);
  };

  const confirmDeleteEmp = () => {
    if (!deletingEmpId) return;
    const emp = employees.find(e => e.id === deletingEmpId);
    if (emp) {
      insertAuditLog({
        company_id: emp.companyId,
        user_name: emp.name,
        action: `Colaborador ${emp.name} (${emp.email}) excluído pelo Gestor`,
        resource: "Usuários & Equipe"
      }).catch(() => {});
    }
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
    
    insertAuditLog({
      company_id: editingEmpPermissions.companyId,
      user_name: editingEmpPermissions.name,
      action: `Permissões de módulos alteradas para ${editingEmpPermissions.name}`,
      resource: "Usuários & Equipe"
    }).catch(() => {});

    setEditingEmpPermissions(null);
    setSuccessMessage(`Permissões de ${editingEmpPermissions.name} atualizadas!`);
    setTimeout(() => setSuccessMessage(null), 3500);
  };

  const copyPasswordToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
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
      <div className="p-6 text-center text-slate-500 font-medium bg-white rounded-xl border border-slate-200">
        Acesso restrito exclusivamente a Gestores de Escritório.
      </div>
    );
  }

  return (
    <div className="space-y-6 text-slate-900 font-sans pb-12">
      {/* Modal for Temporary Password Display */}
      {createdTempPassModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-amber-600" />
                <h3 className="text-base font-bold text-slate-900">{createdTempPassModal.title}</h3>
              </div>
              <button onClick={() => setCreatedTempPassModal(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 font-medium space-y-1">
              <p><strong>Colaborador:</strong> {createdTempPassModal.name} ({createdTempPassModal.email})</p>
              <p className="text-[11px] text-amber-700">O colaborador deverá trocar essa senha obrigatoriamente no primeiro acesso.</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Senha Temporária Gerada:</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={createdTempPassModal.password}
                  className="w-full h-10 px-3 bg-slate-100 border border-slate-300 rounded-lg font-mono text-sm font-bold text-slate-900 tracking-wider text-center"
                />
                <button
                  onClick={() => copyPasswordToClipboard(createdTempPassModal.password)}
                  className="px-4 h-10 bg-primary hover:bg-primary/90 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 shrink-0 transition-colors shadow-xs"
                >
                  <Copy className="w-4 h-4" />
                  <span>{copySuccess ? "Copiado!" : "Copiar"}</span>
                </button>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setCreatedTempPassModal(null)}
                className="px-4 py-2 bg-slate-900 text-white font-bold text-xs rounded-lg hover:bg-slate-800 transition-colors"
              >
                Concluir & Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Confirmation Modal */}
      {resetConfirmEmp && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 p-6 max-w-md w-full shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-amber-600" />
                <span>Resetar Senha do Colaborador</span>
              </h3>
              <button onClick={() => setResetConfirmEmp(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Você deseja gerar uma nova senha temporária para o colaborador <strong>{resetConfirmEmp.name}</strong> ({resetConfirmEmp.email})?
            </p>
            <p className="text-[11px] text-amber-700 font-semibold bg-amber-50 p-2.5 border border-amber-200 rounded-lg">
              A senha atual será invalidada e o colaborador deverá cadastrar uma nova senha no próximo login.
            </p>

            <div className="pt-2 border-t border-slate-100 flex justify-end gap-2">
              <button
                onClick={() => setResetConfirmEmp(null)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={handleResetPasswordConfirmed}
                disabled={isResetting}
                className="px-4 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-xs flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin' : ''}`} />
                <span>{isResetting ? "Gerando..." : "Gerar Nova Senha"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal for Creating New Custom Job Role */}
      {showAddRoleModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5 max-w-md w-full shadow-lg space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-primary" />
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
                placeholder="Ex: Coordenador de BPO Financeiro"
                value={newRoleInput}
                onChange={(e) => setNewRoleInput(e.target.value)}
                className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-bold focus:outline-none focus:border-primary"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAddRoleModal(false)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCreateNewRole}
                className="px-4 py-1.5 text-xs font-bold text-white bg-primary hover:opacity-90 rounded-lg shadow-xs"
              >
                Adicionar Cargo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal for Full Edit of Employee */}
      {editingEmpFull && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 p-6 max-w-xl w-full shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-primary" />
                <span>Editar Dados do Colaborador</span>
              </h3>
              <button onClick={() => setEditingEmpFull(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Nome Completo:</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-bold focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">E-mail Corporativo (Apenas Leitura):</label>
                <div className="h-9 px-3 bg-slate-100 border border-slate-200 rounded-lg text-slate-500 font-medium text-xs flex items-center cursor-not-allowed">
                  {editEmail}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Data de Nascimento:</label>
                <input
                  type="date"
                  value={editBirthDate}
                  onChange={(e) => setEditBirthDate(e.target.value)}
                  className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-semibold focus:outline-none focus:border-primary cursor-pointer"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Cargo / Função:</label>
                <select
                  value={editDept}
                  onChange={(e) => setEditDept(e.target.value)}
                  className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-bold focus:outline-none focus:border-primary cursor-pointer"
                >
                  {jobRoles.map((roleTitle) => (
                    <option key={roleTitle} value={roleTitle}>{roleTitle}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Perfil de Acesso no Sistema:</label>
              <select
                value={editRole}
                onChange={(e) => setEditRole(e.target.value as any)}
                className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-bold focus:outline-none focus:border-primary cursor-pointer"
              >
                <option value="funcionario">Funcionário Operacional (Acesso restrito a módulos)</option>
                <option value="gestor">Gestor do Escritório (Acesso total administrativo)</option>
              </select>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
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
                className="px-5 py-2 bg-primary hover:opacity-90 text-white text-xs font-semibold rounded-lg shadow-xs flex items-center gap-1.5"
              >
                <Save className="w-4 h-4" />
                <span>Salvar Cadastro</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal for Editing Employee Permissions */}
      {editingEmpPermissions && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 p-6 max-w-lg w-full shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-primary" />
                <span>Permissões por Módulo — {editingEmpPermissions.name}</span>
              </h3>
              <button onClick={() => setEditingEmpPermissions(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Select Controls */}
            <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              <span className="text-xs font-bold text-slate-700">Seleção Rápida:</span>
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
                        ? 'bg-primary/10/60 border-primary text-slate-900 shadow-xs' 
                        : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                        checked ? 'bg-primary border-primary text-white' : 'border-slate-300 bg-white'
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
                className="px-5 py-2 bg-primary hover:opacity-90 text-white text-xs font-semibold rounded-lg shadow-xs flex items-center gap-1.5"
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
            Administre a equipe do escritório, cadastre colaboradores com senha temporária gerada automaticamente e gerencie senhas.
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
        {/* Left Column: Form Cadastrar Novo Colaborador */}
        <div className="lg:col-span-4 bg-white p-5 lg:p-6 rounded-xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-primary" />
              <span>Cadastrar Novo Colaborador</span>
            </h2>
            <BatchUserUpload
              companyId={activeCompanyId === 'global' ? 'comp_default' : activeCompanyId}
              companyName={activeCompanyId === 'global' ? 'Empresa Padrão' : undefined}
              jobRoles={jobRoles}
              defaultRole={newEmpRole}
              defaultModules={selectedModules}
              onCreated={() => {
                const compId = getActiveCompanyId();
                setEmployees(getEmployees(compId === 'global' ? undefined : compId));
              }}
            />
          </div>

          <div className="space-y-3.5">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Nome Completo:</label>
              <input
                type="text"
                placeholder="Ex: Mariana Castro"
                value={newEmpName}
                onChange={(e) => setNewEmpName(e.target.value)}
                className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-bold focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">E-mail Corporativo:</label>
              <input
                type="email"
                placeholder="mariana@empresa.com.br"
                value={newEmpEmail}
                onChange={(e) => setNewEmpEmail(e.target.value)}
                className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-medium focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Data de Nascimento (Opcional):</label>
              <input
                type="date"
                value={newEmpBirthDate}
                onChange={(e) => setNewEmpBirthDate(e.target.value)}
                className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-semibold focus:outline-none focus:border-primary cursor-pointer"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Cargo / Departamento:</label>
                <button
                  onClick={() => setShowAddRoleModal(true)}
                  className="text-[10px] font-bold text-primary hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>Novo Cargo</span>
                </button>
              </div>
              <select
                value={newEmpDept}
                onChange={(e) => setNewEmpDept(e.target.value)}
                className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-bold focus:outline-none focus:border-primary cursor-pointer"
              >
                {jobRoles.map((roleTitle) => (
                  <option key={roleTitle} value={roleTitle}>{roleTitle}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Função de Acesso:</label>
              <select
                value={newEmpRole}
                onChange={(e) => setNewEmpRole(e.target.value as any)}
                className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-bold focus:outline-none focus:border-primary cursor-pointer"
              >
                <option value="funcionario">Funcionário Operacional</option>
                <option value="gestor">Gestor de Escritório</option>
              </select>
            </div>

            <div className="pt-2 border-t border-slate-100 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Módulos Iniciais:</label>
                <div className="flex items-center gap-2 text-[10px]">
                  <button onClick={handleRegSelectAll} className="text-primary font-bold hover:underline">Todos</button>
                  <span className="text-slate-300">|</span>
                  <button onClick={handleRegDeselectAll} className="text-slate-500 font-medium hover:underline">Nenhum</button>
                </div>
              </div>

              <div className="space-y-1.5 max-h-[180px] overflow-y-auto pr-1">
                {ALL_SYSTEM_MODULES.map(mod => {
                  const checked = selectedModules.includes(mod.id);
                  return (
                    <label
                      key={mod.id}
                      onClick={() => {
                        setSelectedModules(prev =>
                          prev.includes(mod.id) ? prev.filter(m => m !== mod.id) : [...prev, mod.id]
                        );
                      }}
                      className={`flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                        checked ? 'bg-primary/5 border-primary/40 font-bold text-slate-900' : 'bg-slate-50 border-slate-200 text-slate-500'
                      }`}
                    >
                      <span>{mod.label}</span>
                      <div className={`w-3.5 h-3.5 rounded flex items-center justify-center ${checked ? 'bg-primary text-white' : 'border border-slate-300 bg-white'}`}>
                        {checked && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200/70 rounded-lg text-[11px] text-amber-900 font-medium flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-amber-600 shrink-0" />
              <span>A senha de primeiro acesso será gerada automaticamente e exibida na tela.</span>
            </div>

            <button
              type="button"
              onClick={handleCreateEmployee}
              className="w-full py-2.5 bg-primary hover:opacity-90 text-white text-xs font-bold rounded-lg transition-all shadow-xs flex items-center justify-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              <span>Cadastrar Colaborador & Gerar Senha</span>
            </button>
          </div>
        </div>

        {/* Right Column: Colaboradores Cadastrados Table */}
        <div className="lg:col-span-8 bg-white p-5 lg:p-6 rounded-xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              <span>Colaboradores Cadastrados ({filteredEmployees.length})</span>
            </h2>

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
                className="w-full h-8 pl-8 pr-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          {/* Employee Table */}
          <div className="overflow-x-auto border border-slate-200/80 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider text-[10px] bg-slate-50">
                  <th className="py-2.5 px-3">Colaborador / E-mail</th>
                  <th className="py-2.5 px-3">Cargo / Departamento</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Função</th>
                  <th className="py-2.5 px-3">Último Acesso</th>
                  <th className="py-2.5 px-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {paginatedEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-400 font-medium">
                      Nenhum colaborador encontrado.
                    </td>
                  </tr>
                ) : (
                  paginatedEmployees.map(emp => {
                    const isExpanded = expandedEmpId === emp.id;
                    const allowedCount = emp.allowedModules?.length || 0;
                    const empStatus = emp.status || 'Ativo';

                    return (
                      <>
                        <tr 
                          key={emp.id} 
                          className={`hover:bg-slate-50/80 transition-colors cursor-pointer ${isExpanded ? 'bg-primary/5' : ''}`}
                          onClick={() => setExpandedEmpId(isExpanded ? null : emp.id)}
                        >
                          <td className="py-3 px-3">
                            <span className="font-bold text-slate-900 block">{emp.name}</span>
                            <span className="text-[10px] text-slate-500 font-mono">{emp.email}</span>
                          </td>

                          <td className="py-3 px-3 font-semibold text-slate-800">
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded-md border border-slate-200/80 font-bold text-[11px] inline-block truncate max-w-[150px]">
                              {emp.department}
                            </span>
                          </td>

                          <td className="py-3 px-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border inline-flex items-center gap-1 ${
                              empStatus === 'Ativo' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                              empStatus === 'Primeiro acesso pendente' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                              empStatus === 'Convite pendente' ? 'bg-blue-50 text-blue-800 border-blue-200' :
                              'bg-rose-50 text-rose-800 border-rose-200'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${empStatus === 'Ativo' ? 'bg-emerald-500' : empStatus.includes('pendente') ? 'bg-amber-500' : 'bg-rose-500'}`} />
                              <span>{empStatus}</span>
                            </span>
                          </td>

                          <td className="py-3 px-3">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase border ${
                              emp.role === 'gestor' 
                                ? 'bg-purple-50 text-purple-800 border-purple-200' 
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}>
                              {emp.role === 'gestor' ? 'Gestor' : 'Funcionário'}
                            </span>
                          </td>

                          <td className="py-3 px-3 text-[11px] text-slate-500 font-mono">
                            {emp.lastLoginAt ? new Date(emp.lastLoginAt).toLocaleDateString('pt-BR') : 'Nunca'}
                          </td>

                          <td className="py-3 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => openFullEditModal(emp)}
                                className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-900 rounded transition-colors"
                                title="Editar Cadastro"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>

                              <button
                                onClick={() => setResetConfirmEmp(emp)}
                                className="p-1.5 hover:bg-amber-50 text-slate-400 hover:text-amber-700 rounded transition-colors"
                                title="Resetar Senha Temporária"
                              >
                                <RefreshCw className="w-4 h-4" />
                              </button>

                              <button
                                onClick={() => handleToggleEmployeeStatus(emp)}
                                className={`p-1.5 rounded transition-colors ${
                                  empStatus === 'Ativo'
                                    ? 'hover:bg-rose-50 text-slate-400 hover:text-rose-600'
                                    : 'hover:bg-emerald-50 text-slate-400 hover:text-emerald-600'
                                }`}
                                title={empStatus === 'Ativo' ? 'Desativar Usuário' : 'Reativar Usuário'}
                              >
                                <Power className="w-4 h-4" />
                              </button>

                              <button
                                onClick={() => setDeletingEmpId(emp.id)}
                                className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded transition-colors"
                                title="Excluir Colaborador"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* Expandable Detail Panel */}
                        {isExpanded && (
                          <tr key={`${emp.id}-details`} className="bg-slate-50/90 border-b border-slate-200">
                            <td colSpan={6} className="p-4 space-y-3">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 pb-2">
                                <div className="flex items-center gap-4 text-xs">
                                  {emp.birthDate && (
                                    <span className="flex items-center gap-1.5 text-slate-600 font-medium">
                                      <Calendar className="w-3.5 h-3.5 text-primary" />
                                      <strong>Data Nasc:</strong> {new Date(emp.birthDate + 'T00:00:00').toLocaleDateString('pt-BR')}
                                    </span>
                                  )}
                                  <span className="text-slate-500">
                                    <strong>Status Acesso:</strong> <strong className="text-slate-800">{empStatus}</strong>
                                  </span>
                                </div>

                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => setResetConfirmEmp(emp)}
                                    className="px-3 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold rounded-lg flex items-center gap-1 transition-colors"
                                  >
                                    <RefreshCw className="w-3 h-3" />
                                    <span>Resetar Senha</span>
                                  </button>
                                  <button
                                    onClick={() => openFullEditModal(emp)}
                                    className="px-3 py-1 bg-primary hover:opacity-90 text-white text-xs font-bold rounded-lg flex items-center gap-1 transition-colors shadow-xs"
                                  >
                                    <Edit3 className="w-3 h-3" />
                                    <span>Editar Cadastro</span>
                                  </button>
                                </div>
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

          {/* Pagination Controls */}
          {filteredEmployees.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 text-xs text-slate-500">
              <span>
                Exibindo <strong>{(currentPage - 1) * ITEMS_PER_PAGE + 1}</strong> a <strong>{Math.min(currentPage * ITEMS_PER_PAGE, filteredEmployees.length)}</strong> de <strong>{filteredEmployees.length}</strong> colaboradores
              </span>

              <div className="flex items-center gap-2">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  className="p-1.5 border rounded-lg disabled:opacity-40 hover:bg-slate-100 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-bold text-slate-800">
                  {currentPage} / {totalPages}
                </span>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  className="p-1.5 border rounded-lg disabled:opacity-40 hover:bg-slate-100 transition-colors"
                >
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
