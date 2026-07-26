import type { ReactNode } from "react";
import { Sparkles } from "lucide-react";
import type { ProfileFieldSource } from "@/features/career-profile/api";
import { cn } from "@/shared/lib/utils";
import { Label } from "@/shared/ui/label";

const SOURCE_HINTS: Record<ProfileFieldSource, string> = {
  cv_ai: "Read from your CV — check it",
  text_ai: "Read from your description — check it",
  ai: "Suggested from your CV and description — check it",
};

/** Marks a value the AI proposed, which is not a fact until the user confirms it. */
export function AiSuggestion({ source }: { source: ProfileFieldSource }) {
  return (
    <span
      title={SOURCE_HINTS[source]}
      className="inline-flex items-center gap-1 rounded-md bg-primary-subtle px-1.5 py-0.5 text-[11px] font-medium text-primary"
    >
      <Sparkles className="size-3" aria-hidden="true" />
      Check
    </span>
  );
}

export function ProfileField({
  label,
  hint,
  required,
  source,
  children,
  className,
}: {
  label: string;
  hint?: string;
  /** Needed before job matching can run. */
  required?: boolean;
  source?: ProfileFieldSource;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-center gap-2">
        <Label>
          {label}
          {required && <span className="ml-0.5 text-primary">*</span>}
        </Label>
        {source && <AiSuggestion source={source} />}
      </div>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
