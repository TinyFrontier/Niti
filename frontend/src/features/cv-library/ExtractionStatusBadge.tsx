import type { CVExtractionStatus, CVVersion } from "@/features/cv-library/api";
import { cn } from "@/shared/lib/utils";

interface StatusStyle {
  label: string;
  /** Tailwind classes for the pill and its leading dot. */
  pill: string;
  dot: string;
}

const STATUS_STYLES: Record<CVExtractionStatus, StatusStyle> = {
  pending: {
    label: "Not read",
    pill: "bg-kumo-recessed text-kumo-subtle",
    dot: "bg-muted-foreground",
  },
  completed: {
    label: "Ready",
    pill: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  failed: {
    label: "Failed",
    pill: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
    dot: "bg-rose-500",
  },
  unsupported: {
    label: "Wrong format",
    pill: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
    dot: "bg-amber-500",
  },
};

/** Backend error codes carry no document content, so they are safe to explain verbatim. */
const ERROR_LABELS: Record<string, string> = {
  unsupported_format: "Wrong format",
  no_text_layer: "Scanned file",
  encrypted: "Protected",
  parse_failed: "Unreadable",
  empty_file: "Empty file",
};

const ERROR_HINTS: Record<string, string> = {
  unsupported_format: "Old .doc files can't be read reliably — upload a PDF or DOCX instead.",
  no_text_layer: "This looks like a scan or an image. Upload a text-based PDF or DOCX.",
  encrypted: "The file is password-protected. Upload a copy without a password.",
  parse_failed: "The file could not be read. Try re-saving it as PDF or DOCX.",
  empty_file: "The uploaded file has no content.",
};

const STATUS_HINTS: Record<CVExtractionStatus, string> = {
  pending: "The text of this CV has not been read yet.",
  completed: "Text was read and can be used for job matching.",
  failed: "The text could not be read from this file.",
  unsupported: "This format can't be read — upload a PDF or DOCX.",
};

export function extractionHint(cv: CVVersion): string {
  return (
    (cv.extraction_error ? ERROR_HINTS[cv.extraction_error] : undefined) ??
    STATUS_HINTS[cv.extraction_status]
  );
}

export function ExtractionStatusBadge({ cv, className }: { cv: CVVersion; className?: string }) {
  const style = STATUS_STYLES[cv.extraction_status] ?? STATUS_STYLES.pending;
  // The specific reason is more useful than a generic "Failed".
  const label = (cv.extraction_error ? ERROR_LABELS[cv.extraction_error] : undefined) ?? style.label;

  return (
    <span
      title={extractionHint(cv)}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium",
        style.pill,
        className,
      )}
    >
      <span className={cn("size-1.5 shrink-0 rounded-full", style.dot)} aria-hidden="true" />
      {label}
    </span>
  );
}
