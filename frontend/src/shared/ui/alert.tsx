import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/shared/lib/utils";

const alertVariants = cva("flex gap-3 rounded-md border p-4 text-sm", {
  variants: {
    variant: {
      info: "border-info/20 bg-info-subtle text-info-foreground",
      success: "border-success/20 bg-success-subtle text-success-foreground",
      warning: "border-warning/20 bg-warning-subtle text-warning-foreground",
      destructive: "border-destructive/20 bg-destructive-subtle text-destructive",
    },
  },
  defaultVariants: { variant: "info" },
});

interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {
  icon?: React.ReactNode;
  title?: string;
}

export function Alert({ className, variant, icon, title, children, ...props }: AlertProps) {
  return (
    <div role="alert" className={cn(alertVariants({ variant }), className)} {...props}>
      {icon && <span className="mt-0.5 shrink-0 [&_svg]:size-4">{icon}</span>}
      <div className="min-w-0">
        {title && <p className="font-semibold text-current">{title}</p>}
        {children && <div className={cn("leading-relaxed", title && "mt-1")}>{children}</div>}
      </div>
    </div>
  );
}
