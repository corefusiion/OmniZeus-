"use client";

import { useState, useEffect } from "react";
import {
  CheckSquare,
  Clock,
  Filter,
  Play,
  Square,
  Plus,
  UserCheck,
  Briefcase,
  Search,
  FileText,
  CheckCircle2,
  Trash2,
  Calendar,
  Building2,
  Tag,
  X,
  ChevronRight,
  AlertCircle,
  BarChart3,
  Send,
  User,
  Info,
  ListFilter
} from "lucide-react";
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend 
} from "recharts";
import { getActiveRole, getActiveTenantId, UserRole } from "@/lib/auth/roles";
import {
  fetchTasks,
  insertTask,
  updateTask,
  deleteTask,
  fetchServerTable
} from "@/lib/db/serverDb";

export interface TaskUpdateNote {
  id: string;
  author: string;
  timestamp: string;
  note: string;
}

export interface TaskRecord {
  id: string;
  title: string;
  description?: string;
  client: string;
  department: string;
  assignee: string;
  assignee_id?: string;
  priority: 'alta' | 'media' | 'baixa';
  status: 'pendente' | 'em_andamento' | 'concluido';
  time_spent_sec: number;
  started_at?: string | null;
  completed_at?: string | null;
  duration_sec?: number | null;
  execution_report?: string | null;
  updates_history?: TaskUpdateNote[];
  created_at: string;
  company_id?: string;
  isTimerRunning?: boolean;
}

export interface EmployeeUser {
  id: string;
  name: string;
  email: string;
  department: string;
  role: string;
}

const DEFAULT_EMPLOYEES: EmployeeUser[] = [
  { id: "emp_1", name: "Carlos Mendes", email: "carlos@zenitus.com.br", department: "Diretoria Contábil", role: "Gestor" },
  { id: "emp_2", name: "Juliana Lima", email: "juliana@zenitus.com.br", department: "Operações Tributárias", role: "Analista Fiscal Sênior" },
  { id: "emp_3", name: "Mariana Souza", email: "mariana@zenitus.com.br", department: "Departamento Contábil", role: "Analista Contábil Pleno" },
  { id: "emp_4", name: "Roberto Alves", email: "roberto@zenitus.com.br", department: "BPO Financeiro", role: "Assistente de BPO" },
  { id: "emp_5", name: "Fernanda Costa", email: "fernanda@zenitus.com.br", department: "Departamento Pessoal", role: "Consultora Trabalhista" }
];

const INITIAL_MOCK_TASKS: Omit<TaskRecord, 'isTimerRunning'>[] = [
  {
    id: "task_101",
    title: "Apuração Fator R - Simples Nacional e Emissão de DAS",
    client: "Posto Shell Alvorada",
    department: "Fiscal",
    assignee: "Carlos Mendes",
    priority: "alta",
    status: "em_andamento",
    time_spent_sec: 850,
    started_at: new Date(Date.now() - 850000).toISOString(),
    completed_at: null,
    duration_sec: null,
    execution_report: null,
    created_at: new Date(Date.now() - 3600000).toISOString(),
    company_id: "",
  },
  {
    id: "task_102",
    title: "Conciliação Bancária Extrato OFX vs ContaAzul",
    client: "Supermercado Nova Era Eireli",
    department: "BPO Financeiro",
    assignee: "Juliana Lima",
    priority: "alta",
    status: "pendente",
    time_spent_sec: 0,
    started_at: null,
    completed_at: null,
    duration_sec: null,
    execution_report: null,
    created_at: new Date(Date.now() - 7200000).toISOString(),
    company_id: "",
  },
  {
    id: "task_103",
    title: "Transmissão de EFD-Reinf e Fechamento DCTFWeb",
    client: "Clínica Médica Vida & Saúde S/S",
    department: "Fiscal",
    assignee: "Juliana Lima",
    priority: "media",
    status: "concluido",
    time_spent_sec: 1800,
    started_at: new Date(Date.now() - 86400000).toISOString(),
    completed_at: new Date(Date.now() - 84600000).toISOString(),
    duration_sec: 1800,
    execution_report: "Relatório de transmissão emitido com sucesso. Transmitido recibo de entrega nº 49102-A sem inconformidades de retenções na fonte.",
    created_at: new Date(Date.now() - 90000000).toISOString(),
    company_id: "",
  },
  {
    id: "task_104",
    title: "Elaboração de DRE Gerencial e Balancete Mensal",
    client: "Construtora Horizonte Azul S.A.",
    department: "Contábil",
    assignee: "Carlos Mendes",
    priority: "baixa",
    status: "pendente",
    time_spent_sec: 0,
    started_at: null,
    completed_at: null,
    duration_sec: null,
    execution_report: null,
    created_at: new Date(Date.now() - 100000000).toISOString(),
    company_id: "",
  }
];

export default function TarefasPage() {
  const [role, setRole] = useState<UserRole>("gestor");
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [employees, setEmployees] = useState<EmployeeUser[]>(DEFAULT_EMPLOYEES);
  const [loading, setLoading] = useState(true);

  // Pagination (10 registros por página)
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<'todos' | 'pendente' | 'em_andamento' | 'concluido'>('todos');
  const [deptFilter, setDeptFilter] = useState<string>('todos');
  const [priorityFilter, setPriorityFilter] = useState<string>('todas');

  // Detail Drawer state
  const [selectedDetailTask, setSelectedDetailTask] = useState<TaskRecord | null>(null);
  const [newUpdateNote, setNewUpdateNote] = useState("");

  // New Task Modal state
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskClient, setNewTaskClient] = useState("");
  const [newTaskDept, setNewTaskDept] = useState("Fiscal");
  const [newTaskPriority, setNewTaskPriority] = useState<'alta' | 'media' | 'baixa'>("media");
  const [newTaskAssignee, setNewTaskAssignee] = useState("");
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [assigneeSearchQuery, setAssigneeSearchQuery] = useState("");
  const [showAssigneeDropdown, setShowAssigneeDropdown] = useState(false);

  // Completion Report Modal state
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);
  const [executionReportInput, setExecutionReportInput] = useState("");

  useEffect(() => {
    setRole(getActiveRole());
    const handleRoleChange = () => setRole(getActiveRole());
    const handleContextChange = () => {
      loadPageData();
    };

    window.addEventListener("omnizeus_role_change", handleRoleChange);
    window.addEventListener("omnizeus_company_context_change", handleContextChange);
    window.addEventListener("omnizeus_sql_db_change", handleContextChange);

    loadPageData();

    return () => {
      window.removeEventListener("omnizeus_role_change", handleRoleChange);
      window.removeEventListener("omnizeus_company_context_change", handleContextChange);
      window.removeEventListener("omnizeus_sql_db_change", handleContextChange);
    };
  }, []);

  const loadPageData = async () => {
    setLoading(true);
    try {
      const [records, emps] = await Promise.all([
        fetchTasks(),
        fetchServerTable<EmployeeUser>("employees")
      ]);

      if (Array.isArray(emps) && emps.length > 0) {
        setEmployees(emps);
      }

      if (Array.isArray(records)) {
        const uniqueMap = new Map<string, TaskRecord>();
        records.forEach((r: any) => {
          const norm: TaskRecord = {
            id: r.id || `task_${Date.now()}`,
            title: r.title || "Sem título",
            description: r.description || r.observacoes || "",
            client: r.client || "Cliente Geral",
            department: r.department || "Fiscal",
            assignee: r.assignee || r.assignee_name || "Carlos Mendes",
            assignee_id: r.assignee_id,
            priority: (r.priority as any) || "media",
            status: normalizeTaskStatus(r.status),
            time_spent_sec: Number(r.time_spent_sec !== undefined ? r.time_spent_sec : (r.timeSpentSec || 0)),
            started_at: r.started_at || null,
            completed_at: r.completed_at || null,
            duration_sec: r.duration_sec != null ? Number(r.duration_sec) : null,
            execution_report: r.execution_report || r.executionReport || null,
            updates_history: Array.isArray(r.updates_history) ? r.updates_history : [],
            created_at: r.created_at || new Date().toISOString(),
            company_id: r.company_id || r.companyId || getActiveTenantId() || "",
            isTimerRunning: false
          };
          uniqueMap.set(norm.id, norm);
        });
        setTasks(Array.from(uniqueMap.values()));
      } else {
        setTasks([]);
      }
    } catch (e) {
      console.error("Erro ao carregar dados de tarefas:", e);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

function normalizeTaskStatus(rawStatus: any): 'pendente' | 'em_andamento' | 'concluido' {
  const str = String(rawStatus || '').toLowerCase().trim();
  if (str.includes('andamento') || str === 'em_andamento') return 'em_andamento';
  if (str.includes('conclu') || str === 'concluido') return 'concluido';
  return 'pendente';
}

  // Real-time Timer Tick Effect for running tasks
  useEffect(() => {
    const interval = setInterval(() => {
      setTasks(prev => prev.map(task => {
        if (task.isTimerRunning) {
          const newTime = task.time_spent_sec + 1;
          return { ...task, time_spent_sec: newTime };
        }
        return task;
      }));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Periodic SQLite sync for running timers (every 10s)
  useEffect(() => {
    const syncInterval = setInterval(() => {
      tasks.forEach(t => {
        if (t.isTimerRunning) {
          updateTask({
            id: t.id,
            status: t.status,
            time_spent_sec: t.time_spent_sec,
            started_at: t.started_at
          }).catch(() => {});
        }
      });
    }, 10000);
    return () => clearInterval(syncInterval);
  }, [tasks]);

  // Operational Task Lifecycle Handlers
  const handleCreateTask = async () => {
    if (!newTaskTitle.trim() || !newTaskAssignee.trim()) return;

    const newTask: TaskRecord = {
      id: `task_${Date.now()}`,
      title: newTaskTitle.trim(),
      description: newTaskDescription.trim() || undefined,
      client: newTaskClient.trim() || "Cliente Geral",
      department: newTaskDept,
      assignee: newTaskAssignee.trim(),
      priority: newTaskPriority,
      status: "pendente",
      time_spent_sec: 0,
      started_at: null,
      completed_at: null,
      duration_sec: null,
      execution_report: null,
      updates_history: [],
      created_at: new Date().toISOString(),
      company_id: getActiveTenantId() || "",
      isTimerRunning: false
    };

    await insertTask(newTask);
    setTasks(prev => [newTask, ...prev]);
    setShowNewTaskModal(false);
    setNewTaskTitle("");
    setNewTaskClient("");
    setNewTaskDescription("");
    setNewTaskAssignee("");
    setAssigneeSearchQuery("");
  };

  const handleStartTask = async (id: string) => {
    const nowIso = new Date().toISOString();
    let targetStartedAt: string = nowIso;

    setTasks(prev => prev.map(t => {
      if (t.id === id) {
        targetStartedAt = t.started_at || nowIso;
        return {
          ...t,
          status: "em_andamento",
          isTimerRunning: true,
          started_at: targetStartedAt
        };
      }
      return t;
    }));

    const target = tasks.find(t => t.id === id);
    if (target) {
      await updateTask({
        id,
        status: "em_andamento",
        started_at: target.started_at || nowIso,
        time_spent_sec: target.time_spent_sec
      });
    }
  };

  const handlePauseTask = async (id: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id === id) {
        return { ...t, isTimerRunning: false };
      }
      return t;
    }));

    const target = tasks.find(t => t.id === id);
    if (target) {
      await updateTask({
        id,
        status: target.status,
        time_spent_sec: target.time_spent_sec
      });
    }
  };

  const handleDeleteTask = async (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    await deleteTask(id);
  };

  const handleCompleteTask = async (reportText: string) => {
    if (!completingTaskId) return;
    const nowIso = new Date().toISOString();
    setTasks(prev => prev.map(t => {
      if (t.id === completingTaskId) {
        return {
          ...t,
          status: "concluido",
          isTimerRunning: false,
          completed_at: nowIso,
          execution_report: reportText
        };
      }
      return t;
    }));
    
    const target = tasks.find(t => t.id === completingTaskId);
    if (target) {
      await updateTask({
        id: completingTaskId,
        status: "concluido",
        completed_at: nowIso,
        execution_report: reportText,
        time_spent_sec: target.time_spent_sec
      });
    }
    setCompletingTaskId(null);
  };

  // Helper time formatter
  const formatTime = (totalSec: number) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    if (hrs > 0) {
      return `${hrs}h ${mins}m ${secs}s`;
    }
    return `${mins}m ${secs}s`;
  };

  const formatDate = (isoString?: string | null) => {
    if (!isoString) return "-";
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch {
      return "-";
    }
  };

  // Calculated Metrics
  const totalTasks = tasks.length;
  const pendingCount = tasks.filter(t => normalizeTaskStatus(t.status) === "pendente").length;
  const inProgressCount = tasks.filter(t => normalizeTaskStatus(t.status) === "em_andamento").length;
  const completedCount = tasks.filter(t => normalizeTaskStatus(t.status) === "concluido").length;
  const totalTimeSpentSec = tasks.reduce((sum, t) => sum + (t.time_spent_sec || 0), 0);

  // Filtered Tasks list
  const filteredTasks = tasks.filter(t => {
    // Search Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = t.title.toLowerCase().includes(q);
      const matchClient = t.client.toLowerCase().includes(q);
      const matchAssignee = t.assignee.toLowerCase().includes(q);
      if (!matchTitle && !matchClient && !matchAssignee) return false;
    }
    // Status Filter
    if (statusFilter !== 'todos' && normalizeTaskStatus(t.status) !== statusFilter) {
      return false;
    }
    // Department Filter
    if (deptFilter !== 'todos' && t.department !== deptFilter) {
      return false;
    }
    // Priority Filter
    if (priorityFilter !== 'todas' && t.priority !== priorityFilter) {
      return false;
    }
    return true;
  });

  return (
    <div className="space-y-6 text-slate-900 font-sans pb-12">
      {/* Header (Notion/Linear Minimalist Header) */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs transition-all hover:border-slate-300 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900">
              Gestão de Tarefas Operacionais
            </h1>
            <span className={`text-[10px] uppercase tracking-wider font-bold px-2.5 py-1 rounded-full border shadow-xs ${
              role === 'gestor' || role === 'super_adm'
                ? 'bg-primary/10 text-primary border-primary/20'
                : 'bg-slate-50 text-slate-600 border-slate-200'
            }`}>
              {role === 'gestor' || role === 'super_adm' ? 'Visão Gestor' : 'Visão Funcionário'}
            </span>
          </div>
          <p className="text-sm font-medium text-slate-500 mt-1">
            {role === 'gestor' || role === 'super_adm'
              ? 'Controle de SOPs, obrigações contábeis e produtividade do time com cronometragem em tempo real'
              : 'Suas obrigações prioritárias com registro automático de tempo e relatórios de execução'}
          </p>
        </div>

        <button
          onClick={() => setShowNewTaskModal(true)}
          className="px-4 py-2.5 bg-primary hover:opacity-90 text-white text-xs font-semibold rounded-lg flex items-center gap-2 transition-all shadow-xs"
        >
          <Plus className="w-4 h-4" strokeWidth={1.75} />
          <span>Criar Nova Tarefa</span>
        </button>
      </div>

      {/* Metric Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Tarefas</span>
            <CheckSquare className="w-4 h-4 text-slate-400" strokeWidth={1.75} />
          </div>
          <div className="text-xl font-extrabold text-slate-900 mt-1">{totalTasks}</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">Pendentes</span>
            <Clock className="w-4 h-4 text-amber-500" strokeWidth={1.75} />
          </div>
          <div className="text-xl font-extrabold text-amber-700 mt-1">{pendingCount}</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-primary uppercase tracking-wider">Em Andamento</span>
            <Play className="w-4 h-4 text-blue-500 fill-blue-500/20" strokeWidth={1.75} />
          </div>
          <div className="text-xl font-extrabold text-primary mt-1">{inProgressCount}</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Concluídas</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" strokeWidth={1.75} />
          </div>
          <div className="text-xl font-extrabold text-emerald-700 mt-1">{completedCount}</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Horas Registradas</span>
            <Clock className="w-4 h-4 text-primary" strokeWidth={1.75} />
          </div>
          <div className="text-lg font-extrabold text-slate-900 mt-1">{formatTime(totalTimeSpentSec)}</div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 lg:pb-0">
            {(['pendente', 'em_andamento', 'concluido', 'todos'] as const).map(st => {
              const labels = {
                pendente: 'Pendentes',
                em_andamento: 'Em Andamento',
                concluido: 'Concluídas',
                todos: 'Todas'
              };
              return (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    statusFilter === st
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  {labels[st]}
                </button>
              );
            })}
          </div>

          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" strokeWidth={1.75} />
            <input
              type="text"
              placeholder="Buscar por título, cliente ou responsável..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:border-primary focus:ring-1 focus:ring-[#1E6FD9] transition-all"
            />
          </div>
        </div>

        {/* Dropdown Filters */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 text-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5" strokeWidth={1.75} />
            Filtros:
          </span>

          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-medium">Setor:</span>
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-md text-xs font-semibold text-slate-700 focus:outline-none focus:border-primary"
            >
              <option value="todos">Todos os Setores</option>
              <option value="Fiscal">Fiscal</option>
              <option value="Contábil">Contábil</option>
              <option value="DP">Departamento Pessoal</option>
              <option value="BPO Financeiro">BPO Financeiro</option>
              <option value="Societário">Societário</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-medium">Prioridade:</span>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-md text-xs font-semibold text-slate-700 focus:outline-none focus:border-primary"
            >
              <option value="todas">Todas</option>
              <option value="alta">Alta</option>
              <option value="media">Média</option>
              <option value="baixa">Baixa</option>
            </select>
          </div>

          {(statusFilter !== 'pendente' || deptFilter !== 'todos' || priorityFilter !== 'todas' || searchQuery) && (
            <button
              onClick={() => {
                setStatusFilter('pendente');
                setDeptFilter('todos');
                setPriorityFilter('todas');
                setSearchQuery('');
              }}
              className="text-[11px] text-slate-500 hover:text-red-600 underline font-medium ml-auto"
            >
              Limpar Filtros
            </button>
          )}
        </div>
      </div>

                {/* Task Creation Modal */}
      {showNewTaskModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-lg w-full p-6 space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-primary" strokeWidth={1.75} />
                Nova Tarefa Operacional
              </h3>
              <button
                onClick={() => setShowNewTaskModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Título da Obrigação / SOP *</label>
                <input
                  type="text"
                  placeholder="Ex: Apuração Fator R - Simples Nacional..."
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Empresa / Cliente *</label>
                <input
                  type="text"
                  placeholder="Ex: Posto Shell Alvorada..."
                  value={newTaskClient}
                  onChange={(e) => setNewTaskClient(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Descrição / Instruções Detalhadas da Tarefa (Opcional)</label>
                <textarea
                  rows={2}
                  placeholder="Informe instruções detalhadas sobre a execução desta atividade contábil..."
                  value={newTaskDescription}
                  onChange={(e) => setNewTaskDescription(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Departamento</label>
                  <select
                    value={newTaskDept}
                    onChange={(e) => setNewTaskDept(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:border-primary"
                  >
                    <option value="Fiscal">Fiscal</option>
                    <option value="Contábil">Contábil</option>
                    <option value="DP">Departamento Pessoal</option>
                    <option value="BPO Financeiro">BPO Financeiro</option>
                    <option value="Societário">Societário</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Prioridade</label>
                  <select
                    value={newTaskPriority}
                    onChange={(e) => setNewTaskPriority(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:border-primary"
                  >
                    <option value="alta">Alta</option>
                    <option value="media">Média</option>
                    <option value="baixa">Baixa</option>
                  </select>
                </div>
              </div>

              {/* Responsável Autocomplete Dropdown */}
              <div className="relative">
                <label className="block text-slate-700 font-semibold mb-1">Responsável pela Execução * (Selecione um Funcionário)</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    placeholder="Pesquisar funcionário por nome ou setor..."
                    value={newTaskAssignee || assigneeSearchQuery}
                    onChange={(e) => {
                      setAssigneeSearchQuery(e.target.value);
                      setNewTaskAssignee(e.target.value);
                      setShowAssigneeDropdown(true);
                    }}
                    onFocus={() => setShowAssigneeDropdown(true)}
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:border-primary"
                  />
                </div>

                {showAssigneeDropdown && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-40 overflow-y-auto z-50 divide-y divide-slate-100">
                    {employees
                      .filter(emp => emp.name.toLowerCase().includes((assigneeSearchQuery || newTaskAssignee).toLowerCase()) || emp.department.toLowerCase().includes((assigneeSearchQuery || newTaskAssignee).toLowerCase()))
                      .map(emp => (
                        <div
                          key={emp.id}
                          onClick={() => {
                            setNewTaskAssignee(emp.name);
                            setAssigneeSearchQuery(emp.name);
                            setShowAssigneeDropdown(false);
                          }}
                          className="p-2.5 hover:bg-slate-50 cursor-pointer flex items-center justify-between transition-colors"
                        >
                          <div>
                            <span className="font-bold text-slate-800 block text-xs">{emp.name}</span>
                            <span className="text-[10px] text-slate-500">{emp.role} • {emp.department}</span>
                          </div>
                          {newTaskAssignee === emp.name && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                onClick={() => setShowNewTaskModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateTask}
                disabled={!newTaskTitle.trim() || !newTaskAssignee.trim()}
                className="px-5 py-2 bg-primary hover:opacity-90 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors shadow-xs"
              >
                Salvar Tarefa (Persistir SQL)
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Task List (Linear/Notion Clean Layout) */}
      {loading ? (
        <div className="bg-white p-12 rounded-xl border border-slate-200/80 text-center text-slate-400 text-xs font-semibold animate-pulse">
          Carregando tarefas do servidor SQLite...
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="bg-white p-12 rounded-xl border border-slate-200/80 text-center space-y-2">
          <CheckSquare className="w-8 h-8 text-slate-300 mx-auto" strokeWidth={1.5} />
          <p className="text-sm font-extrabold text-slate-700">Nenhuma tarefa encontrada</p>
          <p className="text-xs text-slate-400">Tente ajustar os filtros ou crie uma nova obrigação operacional.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3.5">
          {filteredTasks.map(task => (
            <div
              key={task.id}
              onClick={() => setSelectedDetailTask(task)}
              className={`bg-white p-3.5 lg:p-4 rounded-xl border transition-all cursor-pointer shadow-xs hover:shadow-md ${
                task.isTimerRunning
                  ? 'border-primary ring-1 ring-[#1E6FD9] bg-primary/10/20'
                  : 'border-slate-200/80 hover:border-slate-300'
              }`}
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                {/* Left Task Details */}
                <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-3 lg:gap-4">
                  {/* Slim Badges & Info */}
                  <div className="flex items-center gap-2 min-w-max">
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                      task.status === 'concluido'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : task.status === 'em_andamento'
                        ? task.isTimerRunning ? 'bg-primary/10 text-primary border-primary/20' : 'bg-amber-50 text-amber-600 border-amber-200'
                        : 'bg-slate-50 text-slate-500 border-slate-200'
                    }`}>
                      {task.status === 'concluido' ? 'Concluído' : task.status === 'em_andamento' ? (task.isTimerRunning ? 'Em Andamento' : 'Pausado') : 'Pendente'}
                    </span>
                    <span className={`w-2 h-2 rounded-full ${
                      task.priority === 'alta' ? 'bg-red-500' : task.priority === 'media' ? 'bg-amber-500' : 'bg-slate-300'
                    }`} title={`Prioridade ${task.priority}`} />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-slate-900 truncate">
                      {task.title}
                    </h3>
                    <div className="flex items-center gap-2 text-[10px] text-slate-500 font-medium mt-0.5">
                      <span className="truncate">{task.client}</span>
                      <span>•</span>
                      <span>{task.department}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1"><UserCheck className="w-3 h-3" />{task.assignee}</span>
                    </div>
                  </div>
                </div>

                {/* Right Controls & Timer */}
                <div className="flex items-center gap-2 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                  {/* Timer Display */}
                  <div className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md border text-[11px] font-mono font-bold transition-colors ${
                    task.isTimerRunning
                      ? 'bg-primary/10 text-primary border-primary/20 animate-pulse'
                      : task.status === 'concluido'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}>
                    <Clock className="w-3.5 h-3.5" strokeWidth={2} />
                    <span>{formatTime(task.time_spent_sec)}</span>
                  </div>

                  {/* Play / Pause */}
                  {task.status !== 'concluido' && (
                    <button
                      onClick={(e) => { e.stopPropagation(); task.isTimerRunning ? handlePauseTask(task.id) : handleStartTask(task.id); }}
                      className={`p-1.5 rounded-md border text-xs font-semibold flex items-center transition-all ${
                        task.isTimerRunning
                          ? 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
                          : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                      }`}
                      title={task.isTimerRunning ? "Pausar" : "Iniciar"}
                    >
                      {task.isTimerRunning ? <Square className="w-4 h-4 fill-amber-700" strokeWidth={1.75} /> : <Play className="w-4 h-4 fill-emerald-700" strokeWidth={1.75} />}
                    </button>
                  )}

                  {/* Complete Button */}
                  {task.status !== 'concluido' && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setCompletingTaskId(task.id); setExecutionReportInput(""); }}
                      className="p-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-md transition-all"
                      title="Concluir Tarefa"
                    >
                      <CheckSquare className="w-4 h-4" strokeWidth={1.75} />
                    </button>
                  )}

                  {/* Delete Action */}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteTask(task.id); }}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                    title="Excluir"
                  >
                    <Trash2 className="w-4 h-4" strokeWidth={1.75} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Completion Modal */}
      {completingTaskId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-emerald-600" /> Confirmar Conclusão
            </h3>
            <label className="block text-xs font-semibold text-slate-700 mb-2">Relatório de Execução / Observações (Obrigatório)</label>
            <textarea
              className="w-full border border-slate-200 rounded-lg p-3 text-sm focus:outline-none focus:border-emerald-500 min-h-[100px]"
              placeholder="Descreva o que foi feito..."
              value={executionReportInput}
              onChange={e => setExecutionReportInput(e.target.value)}
            />
            <div className="mt-5 flex items-center justify-end gap-3">
              <button onClick={() => setCompletingTaskId(null)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
              <button
                disabled={!executionReportInput.trim()}
                onClick={() => handleCompleteTask(executionReportInput)}
                className="px-4 py-2 text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg disabled:opacity-50"
              >
                Concluir Definitivamente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedDetailTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-bold text-slate-900 leading-tight pr-8">{selectedDetailTask.title}</h3>
              <button onClick={() => setSelectedDetailTask(null)} className="p-1 hover:bg-slate-100 rounded-md text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm mb-6">
              <div><span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider block">Cliente</span><strong className="text-slate-800">{selectedDetailTask.client}</strong></div>
              <div><span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider block">Departamento</span><strong className="text-slate-800">{selectedDetailTask.department}</strong></div>
              <div><span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider block">Responsável</span><strong className="text-slate-800">{selectedDetailTask.assignee}</strong></div>
              <div><span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider block">Tempo Gasto</span><strong className="text-slate-800">{formatTime(selectedDetailTask.time_spent_sec)}</strong></div>
            </div>
            {selectedDetailTask.description && (
              <div className="mb-6">
                <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider block mb-1">Descrição / SOP</span>
                <p className="text-sm text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-100">{selectedDetailTask.description}</p>
              </div>
            )}
            {selectedDetailTask.execution_report && (
              <div className="mb-2">
                <span className="text-emerald-700 text-[10px] uppercase font-bold tracking-wider block mb-1 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Relatório de Conclusão</span>
                <p className="text-sm text-slate-700 bg-emerald-50/50 p-4 rounded-xl border border-emerald-100">{selectedDetailTask.execution_report}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
