import { api } from "@/shared/api/client";
import type { Page } from "@/shared/api/types";
import type { Company } from "@/features/companies/api";

export type { Company };

export const WORK_FORMATS = ["remote", "hybrid", "onsite", "flexible", "unknown"] as const;
export const JOB_TYPES = [
  "full_time",
  "part_time",
  "contract",
  "internship",
  "freelance",
  "unknown",
] as const;

export type WorkFormat = (typeof WORK_FORMATS)[number];
export type JobType = (typeof JOB_TYPES)[number];

export interface VacancySource {
  id: string;
  platform: string;
  url: string | null;
  external_id: string | null;
}

export interface Vacancy {
  id: string;
  title: string;
  description: string | null;
  url: string | null;
  location: string | null;
  salary: string | null;
  work_format: WorkFormat;
  job_type: JobType;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  company: Company | null;
  sources: VacancySource[];
}

export interface VacancyPayload {
  title: string;
  company_name?: string;
  description?: string;
  url?: string;
  location?: string;
  salary?: string;
  work_format?: WorkFormat;
  job_type?: JobType;
}

export interface VacancyListParams {
  page?: number;
  page_size?: number;
  search?: string;
  work_format?: WorkFormat;
  job_type?: JobType;
  company_id?: string;
  archived?: boolean;
}

export interface DuplicateCandidate {
  vacancy_id: string;
  title: string;
  company_name: string | null;
  url: string | null;
  score: number;
  reason: "url_match" | "exact_match" | "fuzzy_match";
}

export function listVacancies(params: VacancyListParams = {}) {
  return api<Page<Vacancy>>("/vacancies", { params: { ...params } });
}

export function getVacancy(id: string) {
  return api<Vacancy>(`/vacancies/${id}`);
}

export function createVacancy(payload: VacancyPayload) {
  return api<Vacancy>("/vacancies", { method: "POST", body: payload });
}

export function updateVacancy(id: string, payload: Partial<VacancyPayload>) {
  return api<Vacancy>(`/vacancies/${id}`, { method: "PATCH", body: payload });
}

export function archiveVacancy(id: string) {
  return api<Vacancy>(`/vacancies/${id}/archive`, { method: "POST" });
}

export function unarchiveVacancy(id: string) {
  return api<Vacancy>(`/vacancies/${id}/unarchive`, { method: "POST" });
}

export function deleteVacancy(id: string) {
  return api<void>(`/vacancies/${id}`, { method: "DELETE" });
}

export function checkDuplicates(payload: {
  title: string;
  company_name?: string;
  url?: string;
  exclude_id?: string;
}) {
  return api<{ candidates: DuplicateCandidate[] }>("/vacancies/check-duplicates", {
    method: "POST",
    body: payload,
  });
}
