import type { VacancyStatus } from "@/features/vacancies/api";
import { cn } from "@/shared/lib/utils";

interface StatusStyle {
  label: string;
  /** Tailwind classes for the pill and its leading dot. */
  pill: string;
  dot: string;
}

const STATUS_STYLES: Record<VacancyStatus, StatusStyle> = {
  saved: {
    label: "Saved",
    pill: "bg-primary-subtle text-kumo-link",
    dot: "bg-primary",
  },
  applied: {
    label: "Applied",
    pill: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
    dot: "bg-violet-500",
  },
  interview: {
    label: "Interview",
    pill: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  offer: {
    label: "Offer",
    pill: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  closed: {
    label: "Closed",
    pill: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
    dot: "bg-rose-500",
  },
  archived: {
    label: "Archived",
    pill: "bg-kumo-recessed text-kumo-subtle",
    dot: "bg-muted-foreground",
  },
};

export function VacancyStatusBadge({
  status,
  className,
}: {
  status: VacancyStatus;
  className?: string;
}) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.saved;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium",
        style.pill,
        className,
      )}
    >
      <span className={cn("size-1.5 shrink-0 rounded-full", style.dot)} aria-hidden="true" />
      {style.label}
    </span>
  );
}
