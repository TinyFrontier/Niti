import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/shared/lib/utils";

const badgeVariants = cva(
  "inline-flex min-h-5 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-none",
  {
    variants: {
      variant: {
        default: "border-primary/15 bg-primary-subtle text-primary",
        muted: "border-border bg-muted text-muted-foreground",
        success: "border-success/15 bg-success-subtle text-success-foreground",
        warning: "border-warning/15 bg-warning-subtle text-warning-foreground",
        info: "border-info/15 bg-info-subtle text-info-foreground",
        destructive: "border-destructive/15 bg-destructive-subtle text-destructive",
        outline: "border-border-strong bg-transparent text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
