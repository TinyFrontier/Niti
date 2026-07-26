import type { MatchConfidence, MatchVerdict } from "@/features/job-match/api";
import { cn } from "@/shared/lib/utils";

const VERDICTS: Record<MatchVerdict, { label: string; pill: string; dot: string }> = {
  apply: {
    label: "Apply",
    pill: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  maybe: {
    label: "Maybe",
    pill: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  skip: {
    label: "Skip",
    pill: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
    dot: "bg-rose-500",
  },
};

export const CONFIDENCE_NOTE: Record<MatchConfidence, string | null> = {
  high: null,
  medium: "Some requirements could not be resolved, so treat this as provisional.",
  low: "Too little in the vacancy could be judged — this verdict is preliminary.",
};

export function VerdictBadge({
  verdict,
  score,
  className,
}: {
  verdict: MatchVerdict;
  score?: number | null;
  className?: string;
}) {
  const style = VERDICTS[verdict];
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
      {score !== null && score !== undefined && <span className="tabular-nums">· {score}</span>}
    </span>
  );
}
