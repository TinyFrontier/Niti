import type { ApplicationStatus } from "@/features/applications/api";

export interface BoardColumn {
  id: string;
  title: string;
  statuses: readonly ApplicationStatus[];
}

/** Single source of truth for the Kanban column grouping. */
export const COLUMNS: readonly BoardColumn[] = [
  { id: "saved", title: "Saved", statuses: ["saved"] },
  { id: "applied", title: "Applied", statuses: ["applied"] },
  { id: "screening", title: "Screening", statuses: ["in_review", "recruiter_screen"] },
  {
    id: "interviewing",
    title: "Interviewing",
    statuses: ["technical_interview", "test_task", "final_interview"],
  },
  { id: "offer", title: "Offer", statuses: ["offer"] },
  { id: "closed", title: "Closed", statuses: ["rejected", "withdrawn", "ghosted", "archived"] },
] as const;

const STATUS_TO_COLUMN = new Map<ApplicationStatus, BoardColumn>(
  COLUMNS.flatMap((column) => column.statuses.map((status) => [status, column] as const)),
);

export function columnForStatus(status: ApplicationStatus): BoardColumn {
  return STATUS_TO_COLUMN.get(status) ?? COLUMNS[COLUMNS.length - 1];
}
