import { Badge, type BadgeProps } from "@/shared/ui/badge";
import type { ApplicationStatus } from "@/features/applications/api";

const STATUS_CONFIG: Record<ApplicationStatus, { label: string; variant: BadgeProps["variant"] }> =
  {
    saved: { label: "Saved", variant: "muted" },
    applied: { label: "Applied", variant: "default" },
    in_review: { label: "In review", variant: "default" },
    recruiter_screen: { label: "Recruiter screen", variant: "warning" },
    technical_interview: { label: "Tech interview", variant: "warning" },
    test_task: { label: "Test task", variant: "warning" },
    final_interview: { label: "Final interview", variant: "warning" },
    offer: { label: "Offer", variant: "success" },
    rejected: { label: "Rejected", variant: "destructive" },
    withdrawn: { label: "Withdrawn", variant: "muted" },
    ghosted: { label: "Ghosted", variant: "muted" },
    archived: { label: "Archived", variant: "muted" },
  };

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  const config = STATUS_CONFIG[status] ?? { label: status, variant: "muted" as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
