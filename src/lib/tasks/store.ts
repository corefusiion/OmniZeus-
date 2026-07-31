import {
  fetchTasks,
  insertTask,
  updateTask,
  deleteTask
} from "@/lib/db/serverDb";

export interface TaskItem {
  id: string;
  title: string;
  client: string;
  assignee: string;
  priority: 'alta' | 'media' | 'baixa';
  status: 'pendente' | 'em_andamento' | 'concluido';
  timeSpentSec: number;
  isTimerRunning?: boolean;
  department?: string;
  started_at?: string | null;
  completed_at?: string | null;
  duration_sec?: number | null;
  execution_report?: string | null;
}

let inMemoryTasks: TaskItem[] = [];
let tasksFetched = false;

export async function fetchStoredTasksFromServer(): Promise<TaskItem[]> {
  try {
    const records = await fetchTasks();
    if (Array.isArray(records)) {
      inMemoryTasks = records.map((r: any) => ({
        id: r.id,
        title: r.title || '',
        client: r.client || '',
        assignee: r.assignee || r.assignee_name || '',
        priority: r.priority || 'media',
        status: r.status || 'pendente',
        timeSpentSec: r.time_spent_sec !== undefined ? r.time_spent_sec : (r.timeSpentSec || 0),
        isTimerRunning: false,
        department: r.department || 'Fiscal',
        started_at: r.started_at || null,
        completed_at: r.completed_at || null,
        duration_sec: r.duration_sec || null,
        execution_report: r.execution_report || null
      }));
    } else {
      inMemoryTasks = [];
    }
    tasksFetched = true;
  } catch (err) {
    console.error("Error fetching tasks from server DB:", err);
    inMemoryTasks = [];
  }
  return inMemoryTasks;
}

export function getStoredTasks(): TaskItem[] {
  if (typeof window !== 'undefined' && !tasksFetched) {
    tasksFetched = true;
    fetchStoredTasksFromServer().then(() => {
      window.dispatchEvent(new Event('omnizeus_sql_db_change'));
    }).catch(() => {});
  }
  return inMemoryTasks;
}

export function createStoredTask(task: Omit<TaskItem, 'id' | 'timeSpentSec'>): TaskItem {
  const newTaskItem: TaskItem = {
    ...task,
    id: `t_${Date.now()}`,
    timeSpentSec: 0,
    isTimerRunning: false
  };

  inMemoryTasks = [newTaskItem, ...inMemoryTasks];

  insertTask({
    id: newTaskItem.id,
    title: newTaskItem.title,
    client: newTaskItem.client,
    assignee: newTaskItem.assignee,
    priority: newTaskItem.priority,
    status: newTaskItem.status,
    department: newTaskItem.department || 'Fiscal',
    time_spent_sec: 0,
    created_at: new Date().toISOString()
  }).catch(() => {});

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('omnizeus_sql_db_change'));
  }

  return newTaskItem;
}

export function updateStoredTaskStatus(id: string, status: TaskItem['status'], timeSpentSec?: number) {
  inMemoryTasks = inMemoryTasks.map(t =>
    t.id === id ? { ...t, status, ...(timeSpentSec !== undefined ? { timeSpentSec } : {}) } : t
  );

  const target = inMemoryTasks.find(t => t.id === id);
  if (target) {
    updateTask({
      id: target.id,
      status: target.status,
      time_spent_sec: target.timeSpentSec
    }).catch(() => {});
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('omnizeus_sql_db_change'));
  }
}

export function deleteStoredTask(id: string) {
  inMemoryTasks = inMemoryTasks.filter(t => t.id !== id);
  deleteTask(id).catch(() => {});
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('omnizeus_sql_db_change'));
  }
}
