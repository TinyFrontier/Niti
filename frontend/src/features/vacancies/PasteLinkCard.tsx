import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Link2 } from "lucide-react";
import { trackEvent } from "@/features/events/api";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";

interface PasteLinkCardProps {
  source: "dashboard" | "vacancies";
  compact?: boolean;
}

export function PasteLinkCard({ source, compact = false }: PasteLinkCardProps) {
  const navigate = useNavigate();
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

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
    <Card className={compact ? "mb-4" : "mb-6"}>
      <CardHeader className={compact ? "p-4 pb-2 sm:p-4 sm:pb-2" : undefined}>
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
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
      <CardContent className={compact ? "p-4 pt-2 sm:p-4 sm:pt-2" : undefined}>
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
