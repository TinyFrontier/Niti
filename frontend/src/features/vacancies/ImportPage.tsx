import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, AlertTriangle, CheckCircle2, CopyCheck, ExternalLink, Link2 } from "lucide-react";
import { Link } from "react-router-dom";
import { trackEvent } from "@/features/events/api";
import {
  extractImportErrorCode,
  importCommit,
  importPreview,
  type ImportCommitPayload,
  type ImportErrorCode,
  type ImportPreview,
} from "@/features/vacancies/importApi";
import { VacancyForm, type VacancyFormValues } from "@/features/vacancies/VacancyForm";
import { checkDuplicates, type DuplicateCandidate } from "@/features/vacancies/api";
import { ApiError } from "@/shared/api/client";
import { PageHeader } from "@/shared/layout/PageHeader";
import { Alert } from "@/shared/ui/alert";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Skeleton } from "@/shared/ui/skeleton";

type CommitMode = "save" | "applied";

interface PendingCommit {
  mode: CommitMode;
  values: VacancyFormValues;
}

const ERROR_MESSAGES: Record<ImportErrorCode, { title: string; description: string }> = {
  blocked_url: {
    title: "This link cannot be opened",
    description: "Use a public http or https link, or fill in the job details manually.",
  },
  dns_error: {
    title: "We could not find this website",
    description: "Check the link for typos, or fill in the job details manually.",
  },
  timeout: {
    title: "The page took too long to respond",
    description: "Try again, or continue by filling in the details manually.",
  },
  http_error: {
    title: "We could not load this job posting",
    description: "The page may have moved or be temporarily unavailable.",
  },
  too_large: {
    title: "This page is too large to import",
    description: "You can still save the job by filling in the details manually.",
  },
  not_html: {
    title: "This link is not a web page",
    description: "Use a link to the public job posting, or fill in the details manually.",
  },
  auth_wall: {
    title: "This page requires access",
    description: "We cannot read pages behind a sign-in or verification screen.",
  },
};

function valuesToFields(values: VacancyFormValues): ImportCommitPayload["fields"] {
  return {
    title: values.title.trim(),
    company_name: values.company_name?.trim() || undefined,
    location: values.location?.trim() || undefined,
    salary: values.salary?.trim() || undefined,
    work_format: values.work_format,
    job_type: values.job_type,
    description: values.description?.trim() || undefined,
  };
}

function DuplicateDialog({
  candidates,
  pending,
  submitting,
  onAddSource,
  onSaveNew,
  onCancel,
}: {
  candidates: DuplicateCandidate[];
  pending: PendingCommit;
  submitting: boolean;
  onAddSource: (candidate: DuplicateCandidate) => void;
  onSaveNew: () => void;
  onCancel: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panelRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    return () => previous?.focus();
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close duplicate vacancy dialog"
        className="absolute inset-0 bg-kumo-strong/20"
        onClick={onCancel}
        tabIndex={-1}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="duplicate-dialog-title"
        onKeyDown={(event) => {
          if (event.key === "Escape" && !submitting) {
            onCancel();
            return;
          }
          // Minimal focus trap: keep Tab cycling within the dialog's buttons.
          if (event.key === "Tab") {
            const buttons = panelRef.current?.querySelectorAll<HTMLButtonElement>(
              "button:not([disabled])",
            );
            if (!buttons || buttons.length === 0) return;
            const first = buttons[0];
            const last = buttons[buttons.length - 1];
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first.focus();
            }
          }
        }}
        className="relative max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto rounded-xl border border-kumo-hairline bg-kumo-base p-5 shadow-lg"
      >
        <h2 id="duplicate-dialog-title" className="font-semibold text-kumo-strong">
          This job may already be in your vacancies
        </h2>
        <p className="mt-1 text-sm text-kumo-subtle">
          Open the existing vacancy or attach this link to it.
        </p>
        <div className="mt-4 space-y-3">
          {candidates.map((candidate) => (
            <div key={candidate.vacancy_id} className="rounded-lg border p-3">
              <p className="font-medium text-kumo-strong">{candidate.title}</p>
              <p className="mt-0.5 text-sm text-kumo-subtle">
                {candidate.company_name ?? "Company not specified"}
                {" · "}
                {candidate.reason === "url_match"
                  ? "Same link"
                  : `${Math.round(candidate.score * 100)}% match`}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    window.open(
                      `/vacancies/${candidate.vacancy_id}`,
                      "_blank",
                      "noopener,noreferrer",
                    )
                  }
                >
                  Open existing <ExternalLink />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={submitting}
                  onClick={() => onAddSource(candidate)}
                >
                  Add link to existing
                </Button>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap justify-end gap-2 border-t pt-4">
          <Button type="button" variant="ghost" disabled={submitting} onClick={onCancel}>
            Back
          </Button>
          <Button type="button" variant="outline" disabled={submitting} onClick={onSaveNew}>
            {pending.mode === "applied" ? "Create new & mark applied" : "Save as new"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ImportLoading() {
  return (
    <Card aria-busy="true">
      <CardContent className="p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Link2 className="size-5 animate-pulse" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-kumo-strong">Reading the job posting…</p>
            <p className="mt-1 text-sm text-kumo-subtle">This usually takes a few seconds.</p>
          </div>
        </div>
        <div className="mt-6 space-y-4">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </CardContent>
    </Card>
  );
}

export function ImportPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryUrl = searchParams.get("url")?.trim() ?? "";
  const source = searchParams.get("src")?.trim() || "direct";
  const [urlInput, setUrlInput] = useState(queryUrl);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [previewError, setPreviewError] = useState<unknown>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [commitError, setCommitError] = useState<string | null>(null);
  const [pendingCommit, setPendingCommit] = useState<PendingCommit | null>(null);
  const [duplicateCandidates, setDuplicateCandidates] = useState<DuplicateCandidate[]>([]);
  const [linkToExisting, setLinkToExisting] = useState(false);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const trackedPageRef = useRef(false);
  const lastAutoPreviewUrlRef = useRef<string | null>(null);
  const checkingDuplicatesRef = useRef(false);
  const committingRef = useRef(false);

  useEffect(() => {
    if (trackedPageRef.current) return;
    trackedPageRef.current = true;
    trackEvent("ui_import_opened", { source });
    if (source === "bookmarklet" && queryUrl) {
      trackEvent("ui_bookmarklet_used");
    }
  }, [queryUrl, source]);

  async function runPreview(url: string) {
    const value = url.trim();
    if (!value) return;
    setIsPreviewing(true);
    setPreviewError(null);
    setCommitError(null);
    setManualMode(false);
    setPreview(null);
    setLinkToExisting(false);
    try {
      setPreview(await importPreview(value));
    } catch (error) {
      setPreviewError(error);
    } finally {
      setIsPreviewing(false);
    }
  }

  useEffect(() => {
    setUrlInput(queryUrl);
    if (!queryUrl || lastAutoPreviewUrlRef.current === queryUrl) return;
    lastAutoPreviewUrlRef.current = queryUrl;
    void runPreview(queryUrl);
  }, [queryUrl]);

  const commitMutation = useMutation({
    mutationFn: importCommit,
    onSettled: () => {
      committingRef.current = false;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["vacancies"] });
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      if (result.application_id) {
        navigate(`/applications/${result.application_id}`);
      } else {
        navigate(`/vacancies/${result.vacancy_id}`);
      }
    },
    onError: (error) => {
      setPendingCommit(null);
      setCommitError(error instanceof ApiError ? error.detail : "Could not save this vacancy.");
    },
  });

  function submitCommit(
    mode: CommitMode,
    values: VacancyFormValues,
    duplicate?: DuplicateCandidate,
  ) {
    if (committingRef.current) return;
    const url = values.url?.trim() || preview?.url || queryUrl;
    if (!url) {
      setCommitError("A job posting URL is required for this import.");
      return;
    }

    committingRef.current = true;
    // The preview's platform slug only describes the previewed page; if the user
    // edited the URL afterwards, the slug is stale — fall back to "manual".
    const platform =
      preview && (url === preview.url || url === preview.normalized_url)
        ? preview.platform
        : "manual";
    commitMutation.mutate({
      url,
      platform,
      mode,
      fields: valuesToFields(values),
      duplicate_action: duplicate
        ? { vacancy_id: duplicate.vacancy_id, action: "add_source" }
        : undefined,
    });
  }

  async function requestCommit(mode: CommitMode, values: VacancyFormValues) {
    if (checkingDuplicatesRef.current || committingRef.current) return;
    // The user already chose to attach this link to an existing vacancy.
    if (linkToExisting && preview && preview.duplicates.length > 0) {
      const existing = preview.duplicates[0];
      setCommitError(null);
      submitCommit(mode, { ...values, title: values.title.trim() || existing.title }, existing);
      return;
    }
    checkingDuplicatesRef.current = true;
    setCommitError(null);
    setCheckingDuplicates(true);
    try {
      const result = await checkDuplicates({
        title: values.title.trim(),
        company_name: values.company_name?.trim() || undefined,
        url: values.url?.trim() || preview?.url || queryUrl || undefined,
      });
      if (result.candidates.length > 0) {
        setDuplicateCandidates(result.candidates);
        setPendingCommit({ mode, values });
        return;
      }
      submitCommit(mode, values);
    } catch (error) {
      setCommitError(
        error instanceof ApiError
          ? error.detail
          : "Could not check for existing vacancies. Please try again.",
      );
    } finally {
      checkingDuplicatesRef.current = false;
      setCheckingDuplicates(false);
    }
  }

  function submitUrl() {
    const value = urlInput.trim();
    if (!value) {
      setPreviewError(new Error("Enter a job posting link."));
      return;
    }
    const next = new URLSearchParams(searchParams);
    next.set("url", value);
    if (!next.has("src")) next.set("src", "direct");
    setSearchParams(next);
    if (value === queryUrl) void runPreview(value);
  }

  const errorCode = extractImportErrorCode(previewError);
  const errorCopy = errorCode ? ERROR_MESSAGES[errorCode] : null;
  const initialValues: Partial<VacancyFormValues> | undefined = preview
    ? {
        title: preview.fields.title ?? "",
        company_name: preview.fields.company_name ?? "",
        url: preview.url,
        location: preview.fields.location ?? "",
        salary: preview.fields.salary ?? "",
        work_format: preview.fields.work_format ?? "unknown",
        job_type: preview.fields.job_type ?? "unknown",
        description: preview.fields.description ?? "",
      }
    : manualMode
      ? { url: queryUrl || urlInput }
      : undefined;
  const isPartial =
    Boolean(preview) &&
    (preview!.warnings.length > 0 ||
      preview!.extraction_method === "none" ||
      !preview!.fields.title);

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Import a vacancy"
        description="Paste a job posting link, review the details, then choose how to save it."
      />

      {!preview && !manualMode && !isPreviewing && (
        <Card>
          <CardContent className="p-5 sm:p-6">
            {previewError !== null && (
              <Alert
                variant="warning"
                icon={<AlertCircle />}
                title={errorCopy?.title ?? "We could not import this link"}
                className="mb-4"
              >
                {errorCopy?.description ??
                  (previewError instanceof Error
                    ? previewError.message
                    : "Check the link and try again.")}
              </Alert>
            )}
            <form
              onSubmit={(event) => {
                event.preventDefault();
                submitUrl();
              }}
              className="flex flex-col gap-2 sm:flex-row"
            >
              <Input
                type="url"
                inputMode="url"
                aria-label="Job posting link"
                placeholder="https://company.com/jobs/..."
                value={urlInput}
                onChange={(event) => setUrlInput(event.target.value)}
                className="flex-1"
              />
              <Button type="submit">Preview vacancy</Button>
            </form>
            {previewError !== null && (
              <div className="mt-4 flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => submitUrl()}>
                  Try again
                </Button>
                <Button type="button" variant="ghost" onClick={() => setManualMode(true)}>
                  Fill in manually
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {isPreviewing && <ImportLoading />}

      {(preview || manualMode) && !isPreviewing && (
        <>
          {preview && !isPartial && (
            <Alert
              variant="success"
              icon={<CheckCircle2 />}
              title="Job details found"
              className="mb-4"
            >
              Review the information below before saving.
            </Alert>
          )}
          {isPartial && (
            <Alert
              variant="warning"
              icon={<AlertTriangle />}
              title="Some details need your review"
              className="mb-4"
            >
              We filled in everything we could find. Complete or correct the fields below before
              saving.
              {preview && preview.warnings.length > 0 && (
                <>
                  <br />
                  {preview.warnings.join(" · ")}
                </>
              )}
            </Alert>
          )}
          {manualMode && (
            <Alert
              variant="info"
              icon={<Link2 />}
              title="Manual entry"
              className="mb-4"
            >
              The original link is kept in the form so you can return to the posting later.
            </Alert>
          )}
          {preview && preview.duplicates.length > 0 && (
            <Alert
              variant="warning"
              icon={<CopyCheck />}
              title="This job may already be in your list"
              className="mb-4"
            >
              <ul className="mt-2 space-y-1">
                {preview.duplicates.slice(0, 3).map((candidate) => (
                  <li key={candidate.vacancy_id} className="text-sm">
                    <span className="font-medium">{candidate.title}</span>
                    {candidate.company_name && <> at {candidate.company_name}</>}{" "}
                    <span className="opacity-75">
                      (
                      {candidate.reason === "url_match"
                        ? "same link"
                        : candidate.reason === "exact_match"
                          ? "exact title match"
                          : "similar title"}
                      )
                    </span>{" "}
                    <Link
                      to={`/vacancies/${candidate.vacancy_id}`}
                      className="font-medium underline"
                    >
                      Open existing
                    </Link>
                  </li>
                ))}
              </ul>
              <label className="mt-3 flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  className="size-4 accent-current"
                  checked={linkToExisting}
                  onChange={(event) => setLinkToExisting(event.target.checked)}
                />
                <span>
                  Add this link to &ldquo;{preview.duplicates[0].title}
                  {preview.duplicates[0].company_name
                    ? ` — ${preview.duplicates[0].company_name}`
                    : ""}
                  &rdquo; instead
                </span>
              </label>
            </Alert>
          )}
          <VacancyForm
            initialValues={initialValues}
            onSubmit={(values) => requestCommit("save", values)}
            submitLabel="Save for later"
            serverError={commitError}
            submitting={commitMutation.isPending || checkingDuplicates}
            disabled={commitMutation.isPending || checkingDuplicates || linkToExisting}
            showDuplicateCheck={manualMode}
            renderActions={(form) => (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  disabled={commitMutation.isPending || checkingDuplicates}
                  onClick={() => {
                    // Attaching a link keeps the existing vacancy's data, so skip
                    // field validation while the form is disabled.
                    if (linkToExisting) {
                      void requestCommit("save", form.getValues());
                      return;
                    }
                    void form.handleSubmit((values) => requestCommit("save", values))();
                  }}
                >
                  {checkingDuplicates
                    ? "Checking…"
                    : linkToExisting
                      ? "Add link to existing"
                      : "Save for later"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={commitMutation.isPending || checkingDuplicates}
                  onClick={() => {
                    if (linkToExisting) {
                      void requestCommit("applied", form.getValues());
                      return;
                    }
                    void form.handleSubmit((values) => requestCommit("applied", values))();
                  }}
                >
                  I already applied
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={commitMutation.isPending || checkingDuplicates}
                  onClick={() => navigate(-1)}
                >
                  Cancel
                </Button>
              </div>
            )}
          />
        </>
      )}

      {pendingCommit && duplicateCandidates.length > 0 ? (
        <DuplicateDialog
          candidates={duplicateCandidates}
          pending={pendingCommit}
          submitting={commitMutation.isPending}
          onCancel={() => {
            setPendingCommit(null);
            setDuplicateCandidates([]);
          }}
          onSaveNew={() => {
            const pending = pendingCommit;
            setPendingCommit(null);
            setDuplicateCandidates([]);
            submitCommit(pending.mode, pending.values);
          }}
          onAddSource={(candidate) => {
            const pending = pendingCommit;
            submitCommit(pending.mode, pending.values, candidate);
          }}
        />
      ) : null}
    </div>
  );
}
