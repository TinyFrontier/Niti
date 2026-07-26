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
  const isDashboard = source === "dashboard" && !compact;

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

  return (
    <Card
      className={cn(
        compact ? "mb-4" : "mb-5",
        isDashboard &&
          "relative overflow-hidden border-kumo-line bg-gradient-to-br from-kumo-base to-primary-subtle/35 shadow-card",
      )}
    >
      <CardHeader
        className={cn(
          compact && "p-4 pb-2 sm:p-4 sm:pb-2",
          isDashboard && "relative z-10 p-5 pb-3 sm:p-6 sm:pb-3",
        )}
      >
        <div className={cn("flex items-start gap-3", isDashboard && "gap-4")}>
          <div
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary",
              isDashboard && "size-12 rounded-2xl bg-primary-subtle",
            )}
          >
            <Link2 className={isDashboard ? "size-6" : "size-4"} />
          </div>
          <div>
            <CardTitle className={cn("text-base", isDashboard && "text-xl sm:text-2xl")}>
              {isDashboard ? "Add a vacancy in seconds" : "Add a job from a link"}
            </CardTitle>
            <CardDescription className={cn("mt-1", isDashboard && "text-sm sm:text-base")}>
              {isDashboard
                ? "Paste a job link and Niti will capture the details for you."
                : "Paste a public job posting and review the details before saving."}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent
        className={cn(
          compact && "p-4 pt-2 sm:p-4 sm:pt-2",
          isDashboard && "relative z-10 p-5 pt-1 sm:p-6 sm:pt-1",
        )}
      >
        <form
          onSubmit={handleSubmit}
          className={cn(
            "flex flex-col gap-2 sm:flex-row",
            isDashboard && "sm:ml-16 sm:max-w-[48rem]",
          )}
        >
          <div className="min-w-0 flex-1">
            <Input
              type="url"
              inputMode="url"
              aria-label="Job posting link"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? `paste-link-error-${source}` : undefined}
              placeholder={isDashboard ? "Paste a vacancy URL..." : "https://company.com/jobs/..."}
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              className={isDashboard ? "h-11 rounded-xl bg-kumo-base" : undefined}
            />
            {error && (
              <p id={`paste-link-error-${source}`} className="mt-1 text-xs text-destructive">
                {error}
              </p>
            )}
          </div>
          <Button type="submit" className={cn("shrink-0", isDashboard && "h-11 px-6")}>
            {isDashboard ? "Import vacancy" : "Import from link"}
          </Button>
        </form>
      </CardContent>
      {isDashboard && (
        <div
          aria-hidden="true"
          className="absolute -right-12 -top-16 size-48 rounded-full border border-primary/10 bg-primary/5"
        />
      )}
    </Card>
  );
}
