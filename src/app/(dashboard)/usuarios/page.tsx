"use client";

import { useState, useEffect } from "react";
import { Users, Plus, Trash2, Briefcase, X } from "lucide-react";
import { getActiveRole, UserRole } from "@/lib/auth/roles";
import { getEmployees, saveEmployee, updateEmployeePermissions, deleteEmployee, EmployeeUser, ALL_SYSTEM_MODULES } from "@/lib/company/store";
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

export default function UsuariosPage() {
  const [role, setRole] = useState<UserRole>("gestor");
  const [employees, setEmployees] = useState<EmployeeUser[]>([]);
  const [jobRoles, setJobRoles] = useState<string[]>(DEFAULT_JOB_ROLES);
  const [showAddRoleModal, setShowAddRoleModal] = useState(false);
  const [newRoleInput, setNewRoleInput] = useState("");
  const [newEmpName, setNewEmpName] = useState("");
  const [newEmpEmail, setNewEmpEmail] = useState("");
  const [newEmpDept, setNewEmpDept] = useState("Analista Fiscal Sênior");
  const [newEmpRole, setNewEmpRole] = useState<'gestor' | 'funcionario'>('funcionario');
  const [selectedModules, setSelectedModules] = useState<string[]>(['omni-ia', 'tarefas', 'whatsapp-bot', 'documentos']);
  
  const [deletingEmpId, setDeletingEmpId] = useState<string | null>(null);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);

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
      allowedModules: selectedModules,
      status: 'Ativo'
    });

    setNewEmpName("");
    setNewEmpEmail("");
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

  if (role === "funcionario") {
    return (
      <div className="p-6 text-center text-slate-500 font-medium">
        Acesso restrito a Gestores.
      </div>
    );
  }

  return (
    <div className="space-y-6 text-slate-900 font-sans">
      {/* Modal for Creating New Job Role */}
      {showAddRoleModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5 max-w-sm w-full shadow-lg relative space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-[#1E6FD9]" />
                <span>Criar Novo Cargo / Função</span>
              </h3>
              <button onClick={() => setShowAddRoleModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                Nome do Novo Cargo:
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
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg"
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

      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-5 lg:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-slate-900 tracking-tight">
            Gestão de Usuários e Equipe
          </h1>
          <p className="text-xs lg:text-sm text-slate-500 mt-1">
            Administre os colaboradores do escritório e defina permissões.
          </p>
        </div>
      </div>

      <div className="bg-white p-5 lg:p-6 rounded-xl border border-slate-200/80 shadow-xs space-y-6">
        <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-4.5 h-4.5 text-[#1E6FD9]" />
            <span>Controle da Equipe</span>
          </h2>
        </div>

        {/* Cadastro de Novo Colaborador */}
        <div className="bg-slate-50/70 p-5 rounded-xl border border-slate-200/80 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5 text-[#1E6FD9]" />
            Cadastrar Novo Colaborador
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Nome Completo:</label>
              <input
                type="text"
                placeholder="Ex: Mariana Castro"
                value={newEmpName}
                onChange={(e) => setNewEmpName(e.target.value)}
                className="w-full h-9 px-3 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 font-bold focus:outline-none focus:border-[#1E6FD9]"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">E-mail Corporativo:</label>
              <input
                type="email"
                placeholder="mariana@zenitus.com.br"
                value={newEmpEmail}
                onChange={(e) => setNewEmpEmail(e.target.value)}
                className="w-full h-9 px-3 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 font-medium focus:outline-none focus:border-[#1E6FD9]"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Cargo / Departamento:</label>
              <div className="flex items-center gap-1.5">
                <select
                  value={newEmpDept}
                  onChange={(e) => setNewEmpDept(e.target.value)}
                  className="flex-1 h-9 px-3 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 font-bold focus:outline-none focus:border-[#1E6FD9] cursor-pointer"
                >
                  {jobRoles.map(jr => (
                    <option key={jr} value={jr}>{jr}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowAddRoleModal(true)}
                  className="w-9 h-9 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg flex items-center justify-center transition-colors shrink-0"
                  title="Cadastrar Novo Cargo Personalizado"
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
                className="w-full h-9 px-3 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 font-bold focus:outline-none focus:border-[#1E6FD9] cursor-pointer"
              >
                <option value="funcionario">Funcionário Operacional</option>
                <option value="gestor">Gestor do Escritório</option>
              </select>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCreateEmployee}
            className="w-full py-2.5 bg-[#1E6FD9] hover:bg-blue-600 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-all shadow-xs"
          >
            <Users className="w-4 h-4" />
            <span>Cadastrar Colaborador</span>
          </button>
        </div>

        {/* Tabela de Colaboradores */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider text-[10px] bg-slate-50">
                <th className="py-3 px-4">Colaborador / E-mail</th>
                <th className="py-3 px-4">Cargo / Função</th>
                <th className="py-3 px-4">Permissão por Módulos</th>
                <th className="py-3 px-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {employees.map(emp => (
                <tr key={emp.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 px-4">
                    <span className="font-bold text-slate-900 block">{emp.name}</span>
                    <span className="text-[10px] text-slate-500">{emp.email}</span>
                  </td>
                  <td className="py-3.5 px-4 font-semibold text-slate-800">
                    {emp.department}
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {ALL_SYSTEM_MODULES.map(mod => {
                        const isAllowed = emp.allowedModules?.includes(mod.id);
                        return (
                          <button
                            key={mod.id}
                            onClick={() => toggleEmpPermission(emp.id, mod.id)}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                              isAllowed
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-slate-50 text-slate-400 border-slate-200 hover:text-slate-700'
                            }`}
                          >
                            {mod.label}
                          </button>
                        );
                      })}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={() => setDeletingEmpId(emp.id)}
                      className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded transition-colors"
                      title="Remover Colaborador"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
