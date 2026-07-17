import { api } from "@/shared/api/client";
import type { Page } from "@/shared/api/types";
import type { CVVersion } from "@/features/cv-library/api";
import type { Vacancy } from "@/features/vacancies/api";

export const APPLICATION_STATUSES = [
  "saved",
  "applied",
  "in_review",
  "recruiter_screen",
  "technical_interview",
  "test_task",
  "final_interview",
  "offer",
  "rejected",
  "withdrawn",
  "ghosted",
  "archived",
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export interface Application {
  id: string;
  status: ApplicationStatus;
  applied_at: string | null;
  source: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  vacancy: Vacancy;
  cv_version: CVVersion | null;
}

export interface ApplicationPayload {
  vacancy_id: string;
  cv_version_id?: string | null;
  status?: ApplicationStatus;
  applied_at?: string | null;
  source?: string | null;
  notes?: string | null;
}

export interface ApplicationListParams {
  page?: number;
  page_size?: number;
  search?: string;
  status?: ApplicationStatus;
  vacancy_id?: string;
  company_id?: string;
  cv_version_id?: string;
}

export function listApplications(params: ApplicationListParams = {}) {
  return api<Page<Application>>("/applications", { params: { ...params } });
}

export function getApplication(id: string) {
  return api<Application>(`/applications/${id}`);
}

export function createApplication(payload: ApplicationPayload) {
  return api<Application>("/applications", { method: "POST", body: payload });
}

export function updateApplication(id: string, payload: Partial<ApplicationPayload>) {
  return api<Application>(`/applications/${id}`, { method: "PATCH", body: payload });
}

export function deleteApplication(id: string) {
  return api<void>(`/applications/${id}`, { method: "DELETE" });
}
