import * as React from "react";
import { Field } from "@cloudflare/kumo/components/field";

interface FormFieldProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  optional?: boolean;
}

export function FormField({
  label,
  htmlFor: _htmlFor,
  hint,
  error,
  optional,
  children,
  className,
}: FormFieldProps) {
  return (
    <div className={className}>
      <Field
        label={label}
        required={optional ? false : undefined}
        description={hint}
        error={error ? { message: error, match: true } : undefined}
      >
        {children}
      </Field>
    </div>
  );
}
