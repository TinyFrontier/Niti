import { api } from "@/shared/api/client";
import type { Page } from "@/shared/api/types";
import type { Application } from "@/features/applications/api";

export const INTERVIEW_FORMATS = ["video", "phone", "onsite", "other"] as const;
export const INTERVIEW_RESULTS = ["pending", "passed", "failed", "cancelled", "no_show"] as const;

export type InterviewFormat = (typeof INTERVIEW_FORMATS)[number];
export type InterviewResult = (typeof INTERVIEW_RESULTS)[number];

export interface Interview {
  id: string;
  scheduled_at: string;
  duration_minutes: number | null;
  format: InterviewFormat;
  location_or_link: string | null;
  participants: string | null;
  notes: string | null;
  result: InterviewResult | null;
  created_at: string;
  application: Application;
}

export interface InterviewPayload {
  application_id: string;
  scheduled_at: string;
  duration_minutes?: number | null;
  format?: InterviewFormat;
  location_or_link?: string | null;
  participants?: string | null;
  notes?: string | null;
  result?: InterviewResult | null;
}

export function listInterviews(
  params: { page?: number; page_size?: number; upcoming?: boolean; application_id?: string } = {},
) {
  return api<Page<Interview>>("/interviews", { params: { ...params } });
}

export function createInterview(payload: InterviewPayload) {
  return api<Interview>("/interviews", { method: "POST", body: payload });
}

export function updateInterview(id: string, payload: Partial<InterviewPayload>) {
  return api<Interview>(`/interviews/${id}`, { method: "PATCH", body: payload });
}

export function deleteInterview(id: string) {
  return api<void>(`/interviews/${id}`, { method: "DELETE" });
}
