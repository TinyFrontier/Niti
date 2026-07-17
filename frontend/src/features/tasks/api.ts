import { api } from "@/shared/api/client";
import type { Page } from "@/shared/api/types";

export const TASK_STATUSES = ["todo", "in_progress", "done", "cancelled"] as const;
export const TASK_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export const ENTITY_TYPES = [
  "vacancy",
  "application",
  "company",
  "contact",
  "interview",
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];
export type TaskPriority = (typeof TASK_PRIORITIES)[number];
export type EntityType = (typeof ENTITY_TYPES)[number];

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  completed_at: string | null;
  entity_type: EntityType | null;
  entity_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskPayload {
  title: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  due_date?: string | null;
  entity_type?: EntityType | null;
  entity_id?: string | null;
}

export interface TaskListParams {
  page?: number;
  page_size?: number;
  status?: TaskStatus;
  priority?: TaskPriority;
  overdue?: boolean;
  entity_type?: EntityType;
  entity_id?: string;
}

export function listTasks(params: TaskListParams = {}) {
  return api<Page<Task>>("/tasks", { params: { ...params } });
}

export function createTask(payload: TaskPayload) {
  return api<Task>("/tasks", { method: "POST", body: payload });
}

export function updateTask(id: string, payload: Partial<TaskPayload>) {
  return api<Task>(`/tasks/${id}`, { method: "PATCH", body: payload });
}

export function deleteTask(id: string) {
  return api<void>(`/tasks/${id}`, { method: "DELETE" });
}
