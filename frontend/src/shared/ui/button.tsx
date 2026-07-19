import * as React from "react";
import {
  Button as KumoButton,
  type ButtonProps as KumoButtonProps,
} from "@cloudflare/kumo/components/button";
import { cn } from "@/shared/lib/utils";

export type ButtonVariant = "default" | "secondary" | "outline" | "ghost" | "destructive" | "link";
export type ButtonSize = "default" | "xs" | "sm" | "lg" | "icon" | "icon-sm";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variants: Record<ButtonVariant, KumoButtonProps["variant"]> = {
  default: "primary",
  secondary: "secondary",
  outline: "outline",
  ghost: "ghost",
  destructive: "destructive",
  link: "ghost",
};

const sizes: Record<ButtonSize, KumoButtonProps["size"]> = {
  default: "base",
  xs: "xs",
  sm: "sm",
  lg: "lg",
  icon: "base",
  "icon-sm": "sm",
};

const iconSizes: Record<ButtonSize, string> = {
  xs: "[&_svg]:size-3",
  sm: "[&_svg]:size-3.5",
  default: "[&_svg]:size-4",
  lg: "[&_svg]:size-4.5",
  icon: "[&_svg]:size-4",
  "icon-sm": "[&_svg]:size-3.5",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "default", size = "default", className, ...props }, ref) => {
    const iconOnly = size === "icon" || size === "icon-sm";
    const kumoProps = {
      ...props,
      variant: variants[variant],
      size: sizes[size],
      shape: iconOnly ? "square" : "base",
      className: cn(
        "[&_svg]:shrink-0",
        iconSizes[size],
        variant === "link" && "h-auto px-0 text-kumo-link hover:underline",
        className,
      ),
    } as KumoButtonProps;

    return <KumoButton ref={ref} {...kumoProps} />;
  },
);
Button.displayName = "Button";
