import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import { getCareerProfile } from "@/features/career-profile/api";
import { listCVVersions } from "@/features/cv-library/api";
import { getLatestMatch, requestMatch, type MatchAnalysis } from "@/features/job-match/api";
import { MATCH_FAILURE_TEXT, MatchResult } from "@/features/job-match/MatchResult";
import { VerdictBadge } from "@/features/job-match/VerdictBadge";
import { archiveVacancy } from "@/features/vacancies/api";
import { ApiError } from "@/shared/api/client";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { Select } from "@/shared/ui/select";
import { Skeleton } from "@/shared/ui/skeleton";

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
            {MATCH_FAILURE_TEXT[result.error_code ?? ""] ?? "The analysis did not finish."} You can
            try again.
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

function Result({
  result,
  onApply,
  onArchive,
}: {
  result: MatchAnalysis;
  onApply: () => void;
  onArchive: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <MatchResult result={result} />

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
