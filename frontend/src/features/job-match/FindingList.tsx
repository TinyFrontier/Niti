import { useState } from "react";
import { ChevronDown, Quote } from "lucide-react";
import type { RequirementFinding } from "@/features/job-match/api";
import { cn } from "@/shared/lib/utils";

const STATUS_STYLE: Record<RequirementFinding["status"], string> = {
  met: "bg-emerald-500",
  partial: "bg-amber-500",
  missing: "bg-rose-500",
  unknown: "bg-muted-foreground",
};

/**
 * One requirement with its evidence folded away. Every judgement rests on a
 * quote from the vacancy and, when it is a match, on something in the CV or the
 * profile — that pair is the whole point, so it stays one click away.
 */
function Finding({ finding }: { finding: RequirementFinding }) {
  const [open, setOpen] = useState(false);

  return (
    <li className="border-b border-kumo-hairline last:border-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-start gap-2.5 py-2 text-left"
      >
        <span
          className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", STATUS_STYLE[finding.status])}
          aria-hidden="true"
        />
        <span className="flex-1 text-sm">{finding.requirement}</span>
        {finding.importance === "required" && (
          <span className="mt-0.5 shrink-0 text-[11px] uppercase tracking-wide text-kumo-subtle">
            required
          </span>
        )}
        <ChevronDown
          className={cn(
            "mt-0.5 size-4 shrink-0 text-kumo-subtle transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <div className="ml-6 mb-2.5 flex flex-col gap-1.5 text-sm">
          <p className="flex gap-1.5 text-muted-foreground">
            <Quote className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span className="italic">{finding.vacancy_quote}</span>
          </p>
          {finding.evidence ? (
            <p className="text-muted-foreground">
              {finding.evidence}
              {finding.evidence_source && (
                <span className="ml-1 text-xs text-kumo-subtle">
                  — from your {finding.evidence_source === "cv" ? "CV" : "profile"}
                </span>
              )}
            </p>
          ) : (
            <p className="text-xs text-kumo-subtle">Nothing in your materials backs this.</p>
          )}
        </div>
      )}
    </li>
  );
}

export function FindingList({
  title,
  findings,
  emptyHint,
}: {
  title: string;
  findings: RequirementFinding[];
  emptyHint?: string;
}) {
  if (findings.length === 0 && !emptyHint) return null;

  return (
    <section className="flex flex-col gap-1">
      <h4 className="text-sm font-medium">
        {title}
        <span className="ml-1.5 text-xs font-normal text-kumo-subtle">{findings.length}</span>
      </h4>
      {findings.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyHint}</p>
      ) : (
        <ul>
          {findings.map((finding, index) => (
            <Finding key={`${finding.requirement}-${index}`} finding={finding} />
          ))}
        </ul>
      )}
    </section>
  );
}
