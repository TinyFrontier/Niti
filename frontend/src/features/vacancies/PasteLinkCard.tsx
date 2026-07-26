import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Link2 } from "lucide-react";
import { trackEvent } from "@/features/events/api";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { cn } from "@/shared/lib/utils";

interface PasteLinkCardProps {
  source: "dashboard" | "vacancies";
  compact?: boolean;
}

export function PasteLinkCard({ source, compact = false }: PasteLinkCardProps) {
  const navigate = useNavigate();
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  // the full-width hero is shared by the dashboard and the vacancies page
  const showcase = !compact;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = url.trim();

    try {
      const parsed = new URL(value);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error();
    } catch {
      setError("Enter a full job posting link starting with http:// or https://.");
      return;
    }

    setError(null);
    trackEvent("ui_paste_link_used", { source });
    const params = new URLSearchParams({ url: value, src: source });
    navigate(`/vacancies/import?${params.toString()}`);
  }

  if (showcase) {
    return (
      <Card className="dashboard-import-card mb-5">
        <div className="dashboard-import-thread-left" aria-hidden="true">
          <span className="dashboard-import-thread-left-step-one-down" />
          <span className="dashboard-import-thread-left-step-one-out" />
          <span className="dashboard-import-thread-left-step-two-down" />
          <span className="dashboard-import-thread-left-step-two-out" />
          <span className="dashboard-import-thread-left-tail" />
          <span className="dashboard-import-thread-dot" />
        </div>
        <div className="dashboard-import-thread-right hidden 2xl:block" aria-hidden="true">
          <span className="dashboard-import-thread-right-tail" />
          <span className="dashboard-import-thread-right-dot" />
          <span className="dashboard-import-thread-right-rise" />
          <span className="dashboard-import-thread-right-top" />
          <span className="dashboard-import-thread-target">
            <span />
          </span>
        </div>

        <div className="dashboard-import-layout">
          <div className="dashboard-import-icon">
            <Link2 className="size-7 -rotate-45" />
          </div>
          <div className="min-w-0">
            <h2 className="dashboard-import-title">Add a vacancy in seconds</h2>
            <p className="dashboard-import-description">
              Paste a job link and Niti will capture the details for you.
            </p>
            <form onSubmit={handleSubmit} className="dashboard-import-form">
              <div className="min-w-0">
                <div className="dashboard-import-input-wrap">
                  <Link2
                    aria-hidden="true"
                    className="dashboard-import-input-icon size-5 -rotate-45"
                  />
                  <Input
                    type="url"
                    inputMode="url"
                    aria-label="Job posting link"
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? `paste-link-error-${source}` : undefined}
                    placeholder="Paste a vacancy URL..."
                    value={url}
                    onChange={(event) => setUrl(event.target.value)}
                    className="dashboard-import-input"
                  />
                </div>
                {error && (
                  <p
                    id={`paste-link-error-${source}`}
                    className="dashboard-import-error text-xs text-destructive"
                  >
                    {error}
                  </p>
                )}
              </div>
              <Button type="submit" className="dashboard-import-button">
                Import vacancy
              </Button>
            </form>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        compact ? "mb-4" : "mb-5",
      )}
    >
      <CardHeader
        className={cn(
          compact && "p-4 pb-2 sm:p-4 sm:pb-2",
        )}
      >
        <div className="flex items-start gap-3">
          <div
            className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"
          >
            <Link2 className="size-4" />
          </div>
          <div>
            <CardTitle className="text-base">Add a job from a link</CardTitle>
            <CardDescription className="mt-1">
              Paste a public job posting and review the details before saving.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent
        className={cn(compact && "p-4 pt-2 sm:p-4 sm:pt-2")}
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row">
          <div className="min-w-0 flex-1">
            <Input
              type="url"
              inputMode="url"
              aria-label="Job posting link"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? `paste-link-error-${source}` : undefined}
              placeholder="https://company.com/jobs/..."
              value={url}
              onChange={(event) => setUrl(event.target.value)}
            />
            {error && (
              <p id={`paste-link-error-${source}`} className="mt-1 text-xs text-destructive">
                {error}
              </p>
            )}
          </div>
          <Button type="submit" className="shrink-0">
            Import from link
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
