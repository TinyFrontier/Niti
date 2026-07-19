import * as React from "react";
import { Badge as KumoBadge } from "@cloudflare/kumo/components/badge";

export type BadgeVariant =
  | "default"
  | "muted"
  | "success"
  | "warning"
  | "info"
  | "destructive"
  | "outline";

export interface BadgeProps extends Omit<React.ComponentProps<typeof KumoBadge>, "variant"> {
  variant?: BadgeVariant;
}

const variants: Record<BadgeVariant, React.ComponentProps<typeof KumoBadge>["variant"]> = {
  default: "primary",
  muted: "secondary",
  success: "success",
  warning: "warning",
  info: "info",
  destructive: "error",
  outline: "outline",
};

export function Badge({ variant = "default", ...props }: BadgeProps) {
  return <KumoBadge variant={variants[variant]} {...props} />;
}
