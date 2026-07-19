import * as React from "react";
import { Banner } from "@cloudflare/kumo/components/banner";
import { cn } from "@/shared/lib/utils";

interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "info" | "success" | "warning" | "destructive";
  icon?: React.ReactNode;
  title?: string;
}

export function Alert({ className, variant = "info", icon, title, children, ...props }: AlertProps) {
  const kumoVariant = variant === "warning" ? "alert" : variant === "destructive" ? "error" : "default";

  return (
    <Banner
      variant={kumoVariant}
      icon={icon}
      title={title}
      description={children}
      className={cn(
        variant === "success" && "bg-kumo-success-tint/60 text-kumo-success",
        className,
      )}
      {...props}
    />
  );
}
