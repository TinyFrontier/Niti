import * as React from "react";
import { cn } from "@/shared/lib/utils";
import { Label } from "@/shared/ui/label";

interface FormFieldProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  optional?: boolean;
}

export function FormField({
  label,
  htmlFor,
  hint,
  error,
  optional,
  children,
  className,
  ...props
}: FormFieldProps) {
  const messageId = htmlFor ? `${htmlFor}-${error ? "error" : "hint"}` : undefined;

  return (
    <div className={cn("flex flex-col gap-2", className)} {...props}>
      <div className="flex items-baseline justify-between gap-3">
        <Label htmlFor={htmlFor}>{label}</Label>
        {optional && <span className="text-xs text-subtle-foreground">Optional</span>}
      </div>
      {children}
      {error ? (
        <p id={messageId} className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : (
        hint && (
          <p id={messageId} className="text-xs leading-relaxed text-muted-foreground">
            {hint}
          </p>
        )
      )}
    </div>
  );
}
