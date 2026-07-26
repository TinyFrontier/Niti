import { api } from "@/shared/api/client";

export interface AnalyticsSummary {
  total_applications: number;
  active_applications: number;
  upcoming_interviews: number;
  tasks_due: number;
  offers: number;
  rejected: number;
  saved_vacancies: number;
  active_applications_added_this_week: number;
  interviews_this_week: number;
  tasks_due_today: number;
  offers_this_week: number;
  applications_moved_this_week: number;
}

export function getAnalyticsSummary() {
  return api<AnalyticsSummary>("/analytics/summary");
}

export interface CountItem {
  label: string;
  count: number;
}

export function getApplicationsByStatus() {
  return api<CountItem[]>("/analytics/applications-by-status");
}
