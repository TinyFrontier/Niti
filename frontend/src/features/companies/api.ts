import { api } from "@/shared/api/client";
import type { Page } from "@/shared/api/types";

export interface Company {
  id: string;
  name: string;
  website: string | null;
  industry: string | null;
  location: string | null;
  size: string | null;
  description: string | null;
  rating: number | null;
  created_at: string;
  updated_at: string;
}

export interface CompanyPayload {
  name: string;
  website?: string;
  industry?: string;
  location?: string;
  size?: string;
  description?: string;
  rating?: number | null;
}

export function listCompanies(params: { page?: number; page_size?: number; search?: string } = {}) {
  return api<Page<Company>>("/companies", { params: { ...params } });
}

export function getCompany(id: string) {
  return api<Company>(`/companies/${id}`);
}

export function createCompany(payload: CompanyPayload) {
  return api<Company>("/companies", { method: "POST", body: payload });
}

export function updateCompany(id: string, payload: Partial<CompanyPayload>) {
  return api<Company>(`/companies/${id}`, { method: "PATCH", body: payload });
}

export function deleteCompany(id: string) {
  return api<void>(`/companies/${id}`, { method: "DELETE" });
}
