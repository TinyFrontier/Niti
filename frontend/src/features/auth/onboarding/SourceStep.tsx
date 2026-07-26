import { useState } from "react";
import { FileText, Sparkles } from "lucide-react";
import { draftCareerProfile, type ProfileDraft } from "@/features/career-profile/api";
import { uploadCVVersion } from "@/features/cv-library/api";
import { updateMe } from "@/features/auth/api";
import { ApiError } from "@/shared/api/client";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const DRAFT_ERRORS: Record<string, string> = {
  ai_timeout: "The AI provider took too long. You can try again or fill the profile yourself.",
  ai_unavailable: "The AI provider is unreachable right now. You can fill the profile yourself.",
  ai_rate_limited: "The AI provider is busy. Try again in a moment.",
  ai_truncated: "The model ran out of room before answering. Try again or fill it in yourself.",
  ai_invalid_response: "The model returned something unusable. Try again or fill it in yourself.",
  ai_not_configured: "AI is not configured on this server. Fill the profile in by hand.",
};

/**
 * Turns the user's own materials into a draft profile. Both inputs are optional
 * and either one is enough — a CV carries experience, while what someone wants
 * (pay, relocation, domains to avoid) usually exists only in their head.
 */
export function SourceStep({
  onDrafted,
  onSkip,
  busy,
}: {
  onDrafted: (draft: ProfileDraft) => void;
  onSkip: () => void;
  busy: boolean;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [freeText, setFreeText] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const hasSource = file !== null || freeText.trim().length > 0;

  const generate = async () => {
    setError(null);
    if (file && file.size > MAX_FILE_SIZE) {
      setError("The file must be under 10MB.");
      return;
    }
    setPending(true);
    try {
      await updateMe({ ai_consent: true });
      let cvVersionId: string | undefined;
      if (file) {
        const uploaded = await uploadCVVersion({
          file,
          title: file.name.replace(/\.[^.]+$/, "") || "My CV",
        });
        cvVersionId = uploaded.id;
      }
      onDrafted(
        await draftCareerProfile({
          cv_version_id: cvVersionId,
          free_text: freeText.trim() || undefined,
        }),
      );
    } catch (caught) {
      const detail = caught instanceof ApiError ? caught.detail : "";
      setError(DRAFT_ERRORS[detail] ?? detail ?? "Something went wrong.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cv">Your CV</Label>
        <Input
          id="cv"
          type="file"
          accept=".pdf,.docx"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
        <p className="text-xs text-muted-foreground">
          PDF or DOCX. It is saved to your CV library as well.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="about">Or tell us in your own words</Label>
        <Textarea
          id="about"
          rows={5}
          value={freeText}
          onChange={(event) => setFreeText(event.target.value)}
          placeholder={
            "Senior backend engineer, 7 years of Python, based in Lisbon.\n" +
            "Remote only, European timezones, from 5500 EUR per month.\n" +
            "English C1. No gambling."
          }
        />
        <p className="text-xs text-muted-foreground">
          Best for what a CV never says: pay, relocation, the work you do not want.
        </p>
      </div>

      <label className="flex items-start gap-2 text-sm text-muted-foreground">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
        />
        <span>
          Send this text to our AI provider to pre-fill the profile. Nothing is used to train
          models, and you confirm every field before it is saved.
        </span>
      </label>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={generate} disabled={!hasSource || !consent || pending || busy}>
          <Sparkles /> {pending ? "Reading..." : "Build my profile"}
        </Button>
        <Button type="button" variant="ghost" onClick={onSkip} disabled={pending || busy}>
          <FileText /> Fill it in myself
        </Button>
      </div>
    </div>
  );
}
