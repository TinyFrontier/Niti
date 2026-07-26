import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { getCareerProfile } from "@/features/career-profile/api";
import { listCVVersions } from "@/features/cv-library/api";
import {
  getLatestMatch,
  requestMatch,
  type MatchAnalysis,
  type RedFlag,
} from "@/features/job-match/api";
import { FindingList } from "@/features/job-match/FindingList";
import { CONFIDENCE_NOTE, VerdictBadge } from "@/features/job-match/VerdictBadge";
import { archiveVacancy } from "@/features/vacancies/api";
import { ApiError } from "@/shared/api/client";
import { humanize } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { Select } from "@/shared/ui/select";
import { Skeleton } from "@/shared/ui/skeleton";

const FAILURE_TEXT: Record<string, string> = {
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

export function JobMatchCard({ vacancyId }: { vacancyId: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [cvId, setCvId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const profile = useQuery({ queryKey: ["career-profile"], queryFn: getCareerProfile });
  const cvs = useQuery({
    queryKey: ["cv-versions", { page: 1 }],
    queryFn: () => listCVVersions({ page_size: 50 }),
  });

  const analysis = useQuery({
    queryKey: ["job-match", vacancyId],
    queryFn: async (): Promise<MatchAnalysis | null> => {
      try {
        return await getLatestMatch(vacancyId);
      } catch (caught) {
        // never analysed is a state, not a failure
        if (caught instanceof ApiError && caught.status === 404) return null;
        throw caught;
      }
    },
    // a run takes tens of seconds, so watch it while it is in flight
    refetchInterval: (query) =>
      query.state.data?.status === "processing" ? 3000 : false,
    // keep polling when the tab is not focused: the whole point is that the
    // answer is ready when the user comes back, and react-query pauses interval
    // refetches in a background tab unless told otherwise
    refetchIntervalInBackground: true,
  });

  const run = useMutation({
    mutationFn: (force: boolean) =>
      requestMatch(vacancyId, { cv_version_id: cvId || undefined, force }),
    onSuccess: (result) => {
      setError(null);
      queryClient.setQueryData(["job-match", vacancyId], result);
    },
    onError: (caught) =>
      setError(caught instanceof ApiError ? caught.detail : "Could not start the analysis."),
  });

  const archive = useMutation({
    mutationFn: () => archiveVacancy(vacancyId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["vacancy", vacancyId] }),
  });

  const readable = (cvs.data?.items ?? []).filter((cv) => cv.extraction_status === "completed");
  const result = analysis.data;
  const busy = run.isPending || result?.status === "processing";

  return (
    <Card className="mb-4">
      <CardContent className="flex flex-col gap-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            <h3 className="font-semibold">Job match</h3>
            {result?.status === "completed" && result.verdict && (
              <VerdictBadge verdict={result.verdict} score={result.score} />
            )}
          </div>

          <div className="flex items-center gap-2">
            {readable.length > 1 && (
              <Select
                className="w-52"
                value={cvId}
                onValueChange={setCvId}
                disabled={busy}
              >
                <option value="">Newest CV</option>
                {readable.map((cv) => (
                  <option key={cv.id} value={cv.id}>
                    {cv.title}
                  </option>
                ))}
              </Select>
            )}
            {profile.data?.is_ready_for_matching && (
              <Button
                size="sm"
                variant={result ? "outline" : "default"}
                disabled={busy}
                onClick={() => run.mutate(Boolean(result))}
              >
                {result ? <RefreshCw /> : <Sparkles />}
                {result ? "Analyze again" : "Analyze fit"}
              </Button>
            )}
          </div>
        </div>

        {analysis.isLoading && <Skeleton className="h-20 w-full" />}
        {error && <p className="text-sm text-destructive">{error}</p>}

        {!profile.data?.is_ready_for_matching && (
          <ProfileGate missing={profile.data?.missing_for_matching ?? []} />
        )}

        {profile.data?.is_ready_for_matching && !result && !analysis.isLoading && (
          <p className="text-sm text-muted-foreground">
            Compare this vacancy with your career profile
            {readable.length > 0 ? " and CV" : ""} to see whether it is worth applying.
          </p>
        )}

        {result?.status === "processing" && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Checking how well this vacancy fits you...
          </p>
        )}

        {result?.status === "failed" && (
          <p className="text-sm text-muted-foreground">
            {FAILURE_TEXT[result.error_code ?? ""] ?? "The analysis did not finish."} You can try
            again.
          </p>
        )}

        {result?.status === "completed" && <Result result={result} onArchive={archive.mutate} onApply={() => navigate(`/applications/new?vacancy_id=${vacancyId}`)} />}
      </CardContent>
    </Card>
  );
}

function ProfileGate({ missing }: { missing: string[] }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-primary-subtle/40 p-3">
      <p className="text-sm">
        <span className="font-medium">Fill your career profile to score vacancies.</span>{" "}
        {missing.length > 0 && (
          <span className="text-muted-foreground">Still needed: {missing.join(", ")}.</span>
        )}
      </p>
      <Button size="sm" variant="secondary">
        <Link to="/career-profile">Open profile</Link>
      </Button>
    </div>
  );
}

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

function Result({
  result,
  onApply,
  onArchive,
}: {
  result: MatchAnalysis;
  onApply: () => void;
  onArchive: () => void;
}) {
  const note = result.confidence ? CONFIDENCE_NOTE[result.confidence] : null;
  const assessed = (result.score_breakdown?.categories ?? []).filter((item) => item.assessed);

  return (
    <div className="flex flex-col gap-4">
      {result.is_stale && (
        <p className="flex items-start gap-2 rounded-lg bg-amber-100 p-2.5 text-sm text-amber-800 dark:bg-amber-500/15 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          The vacancy, your CV or your profile changed after this analysis. Run it again for a
          current answer.
        </p>
      )}

      {result.summary && <p className="text-sm">{result.summary}</p>}
      {note && <p className="text-xs text-muted-foreground">{note}</p>}

      {assessed.length > 0 && (
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

      <div className={cn("flex flex-wrap gap-2 border-t border-kumo-hairline pt-3")}>
        {result.next_action === "create_application" && (
          <Button size="sm" onClick={onApply}>
            Create application
          </Button>
        )}
        {result.next_action === "archive_vacancy" && (
          <Button size="sm" variant="outline" onClick={onArchive}>
            Archive vacancy
          </Button>
        )}
        {result.next_action === "review_gaps" && (
          <Button size="sm" variant="outline" onClick={onApply}>
            Apply anyway
          </Button>
        )}
      </div>
    </div>
  );
}
