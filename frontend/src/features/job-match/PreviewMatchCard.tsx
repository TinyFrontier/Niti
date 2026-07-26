import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import { getCareerProfile } from "@/features/career-profile/api";
import { getMatch } from "@/features/job-match/api";
import { MATCH_FAILURE_TEXT, MatchResult } from "@/features/job-match/MatchResult";
import { VerdictBadge } from "@/features/job-match/VerdictBadge";
import { importPreviewMatch, type ImportCommitFields } from "@/features/vacancies/importApi";
import { ApiError } from "@/shared/api/client";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";

/**
 * The fit of a posting that has not been saved yet.
 *
 * The whole point of scoring on the preview is that the decision comes before
 * the save, so this sits next to the form while the user reads it. The import
 * starts the analysis on its own; the button here is for after the extracted
 * fields have been corrected, which is when the first answer stops applying.
 */
export function PreviewMatchCard({
  analysisId,
  onStarted,
  getFields,
  disabled,
}: {
  analysisId: string | null;
  onStarted: (id: string) => void;
  /** Current form values, or null when they would not pass validation. */
  getFields: () => ImportCommitFields | null;
  disabled?: boolean;
}) {
  const [error, setError] = useState<string | null>(null);

  const profile = useQuery({ queryKey: ["career-profile"], queryFn: getCareerProfile });

  const analysis = useQuery({
    queryKey: ["preview-match", analysisId],
    queryFn: () => getMatch(analysisId!),
    enabled: Boolean(analysisId),
    // the run outlives the preview request, so watch it while the user reads
    refetchInterval: (query) => (query.state.data?.status === "processing" ? 3000 : false),
    refetchIntervalInBackground: true,
  });

  const run = useMutation({
    mutationFn: () => {
      const fields = getFields();
      if (!fields) throw new ApiError(400, "Fill in the title and description first.");
      return importPreviewMatch({ fields });
    },
    onSuccess: (result) => {
      setError(null);
      onStarted(result.id);
    },
    onError: (caught) =>
      setError(caught instanceof ApiError ? caught.detail : "Could not start the analysis."),
  });

  const result = analysis.data;
  const busy = run.isPending || result?.status === "processing";

  if (!profile.data?.is_ready_for_matching) {
    return (
      <Card>
        <CardContent className="flex flex-col gap-2 p-5">
          <h2 className="flex items-center gap-2 font-semibold text-kumo-strong">
            <Sparkles className="size-4 text-primary" /> Job match
          </h2>
          <p className="text-sm text-muted-foreground">
            Fill your career profile and this vacancy gets scored before you decide whether to
            save it.
          </p>
          <Button size="sm" variant="secondary" className="self-start">
            <Link to="/career-profile">Open profile</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-semibold text-kumo-strong">
            <Sparkles className="size-4 text-primary" /> Job match
          </h2>
          {result?.status === "completed" && result.verdict && (
            <VerdictBadge verdict={result.verdict} score={result.score} />
          )}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {!analysisId && !run.isPending && (
          <p className="text-sm text-muted-foreground">
            Not enough was extracted to score this posting. Complete the description below and
            check the fit before saving.
          </p>
        )}

        {busy && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Checking how well this vacancy fits you...
          </p>
        )}

        {result?.status === "failed" && (
          <p className="text-sm text-muted-foreground">
            {MATCH_FAILURE_TEXT[result.error_code ?? ""] ?? "The analysis did not finish."} You can
            try again.
          </p>
        )}

        {result?.status === "completed" && <MatchResult result={result} compact />}

        <Button
          size="sm"
          variant={result ? "outline" : "default"}
          disabled={busy || disabled}
          onClick={() => run.mutate()}
          className="self-start"
        >
          {result ? <RefreshCw /> : <Sparkles />}
          {result ? "Check these details" : "Analyze fit"}
        </Button>
      </CardContent>
    </Card>
  );
}
