import { api } from "@/shared/api/client";

export interface AnalyticsSummary {
  total_applications: number;
  active_applications: number;
  upcoming_interviews: number;
  tasks_due: number;
  offers: number;
  rejected: number;
  saved_vacancies: number;
}

export function getAnalyticsSummary() {
  return api<AnalyticsSummary>("/analytics/summary");
}
