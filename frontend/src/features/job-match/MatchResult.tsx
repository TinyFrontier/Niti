import { AlertTriangle } from "lucide-react";
import type { MatchAnalysis, RedFlag } from "@/features/job-match/api";
import { FindingList } from "@/features/job-match/FindingList";
import { CONFIDENCE_NOTE } from "@/features/job-match/VerdictBadge";
import { humanize } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";

/**
 * The body of a finished analysis, shared by the saved vacancy and the import
 * preview. Both show the same evidence; only what the user can do next differs,
 * which is why the actions stay with the caller.
 */

export const MATCH_FAILURE_TEXT: Record<string, string> = {
  ai_timeout: "The AI provider took too long.",
  ai_unavailable: "The AI provider is unreachable right now.",
  ai_rate_limited: "The AI provider is busy.",
  ai_truncated: "The model ran out of room before answering.",
  ai_invalid_response: "The model returned something unusable.",
  ai_not_configured: "AI is not configured on this server.",
  worker_lost: "The analysis was interrupted.",
  inputs_unavailable: "The vacancy, CV or profile is no longer available.",
  internal_error: "Something went wrong while analysing.",
};

function FlagList({
  title,
  hint,
  flags,
  tone,
}: {
  title: string;
  hint?: string;
  flags: RedFlag[];
  tone: string;
}) {
  if (flags.length === 0) return null;
  return (
    <section className="flex flex-col gap-1">
      <h4 className={cn("text-sm font-medium", tone)}>{title}</h4>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <ul className="flex flex-col gap-1">
        {flags.map((flag, index) => (
          <li key={index} className="text-sm text-muted-foreground">
            {flag.detail}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function MatchResult({
  result,
  staleNote,
  compact = false,
}: {
  result: MatchAnalysis;
  /** Overrides the wording of the stale banner; hidden when the analysis is fresh. */
  staleNote?: string;
  /** Drops the per-category bars, for the narrow column on the import preview. */
  compact?: boolean;
}) {
  const note = result.confidence ? CONFIDENCE_NOTE[result.confidence] : null;
  const assessed = (result.score_breakdown?.categories ?? []).filter((item) => item.assessed);

  return (
    <div className="flex flex-col gap-4">
      {result.is_stale && (
        <p className="flex items-start gap-2 rounded-lg bg-amber-100 p-2.5 text-sm text-amber-800 dark:bg-amber-500/15 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          {staleNote ??
            "The vacancy, your CV or your profile changed after this analysis. Run it again for a current answer."}
        </p>
      )}

      {result.summary && <p className="text-sm">{result.summary}</p>}
      {note && <p className="text-xs text-muted-foreground">{note}</p>}

      {!compact && assessed.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {assessed.map((item) => (
            <div key={item.category} className="flex items-center gap-2 text-xs">
              <span className="w-28 shrink-0 text-muted-foreground">
                {humanize(item.category)}
              </span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-kumo-recessed">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${(item.score / item.max_score) * 100}%` }}
                />
              </div>
              <span className="w-14 shrink-0 text-right tabular-nums text-muted-foreground">
                {Math.round(item.score)}/{Math.round(item.max_score)}
              </span>
            </div>
          ))}
        </div>
      )}

      <FlagList
        title="Blockers"
        hint="Conditions you do not meet, which is why the score is capped."
        flags={(result.red_flags ?? []).filter((flag) => flag.blocking)}
        tone="text-destructive"
      />
      <FlagList
        title="Red flags"
        flags={(result.red_flags ?? []).filter((flag) => !flag.blocking)}
        tone="text-amber-700 dark:text-amber-300"
      />

      <FindingList title="Matches" findings={result.matches ?? []} />
      <FindingList
        title="Gaps"
        findings={result.gaps ?? []}
        emptyHint="Nothing the vacancy asks for is missing."
      />

      {(result.unknowns?.length ?? 0) > 0 && (
        <section className="flex flex-col gap-1">
          <h4 className="text-sm font-medium">Not stated in the vacancy</h4>
          <ul className="list-inside list-disc text-sm text-muted-foreground">
            {result.unknowns?.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
