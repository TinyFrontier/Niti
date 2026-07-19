import * as React from "react";
import {
  Input as KumoInput,
  type InputProps as KumoInputProps,
} from "@cloudflare/kumo/components/input";

export type InputProps = KumoInputProps;

export const Input = React.forwardRef<HTMLInputElement, InputProps>((props, ref) => {
  const accessibleName =
    props["aria-label"] ??
    (typeof props.placeholder === "string" ? props.placeholder : undefined);

  return <KumoInput ref={ref} aria-label={accessibleName} {...props} />;
});
Input.displayName = "Input";
