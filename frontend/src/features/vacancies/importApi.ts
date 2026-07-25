import { api, ApiError } from "@/shared/api/client";
import type { DuplicateCandidate, JobType, WorkFormat } from "@/features/vacancies/api";

export type ImportErrorCode =
  | "blocked_url"
  | "dns_error"
  | "timeout"
  | "http_error"
  | "too_large"
  | "not_html"
  | "auth_wall";

export interface ImportPreviewFields {
  title: string | null;
  company_name: string | null;
  location: string | null;
  salary: string | null;
  work_format: WorkFormat | null;
  job_type: JobType | null;
  description: string | null;
}

export interface ImportPreview {
  url: string;
  normalized_url: string;
  platform: string;
  extraction_method: string;
  fields: ImportPreviewFields;
  warnings: string[];
  duplicates: DuplicateCandidate[];
}

export interface ImportCommitPayload {
  url: string;
  platform: string;
  mode: "save" | "applied";
  fields: {
    title: string;
    company_name?: string;
    location?: string;
    salary?: string;
    work_format: WorkFormat;
    job_type: JobType;
    description?: string;
  };
  duplicate_action?: { vacancy_id: string; action: "add_source" };
}

export interface ImportCommitResult {
  vacancy_id: string;
  application_id: string | null;
  deduplicated: boolean;
}

export function importPreview(url: string) {
  return api<ImportPreview>("/vacancies/import/preview", { method: "POST", body: { url } });
}

export function importCommit(payload: ImportCommitPayload) {
  return api<ImportCommitResult>("/vacancies/import/commit", { method: "POST", body: payload });
}

export function extractImportErrorCode(error: unknown): ImportErrorCode | undefined {
  if (error instanceof ApiError && error.detailData && typeof error.detailData === "object") {
    const code = (error.detailData as { error_code?: unknown }).error_code;
    if (typeof code === "string") return code as ImportErrorCode;
  }
  return undefined;
}
