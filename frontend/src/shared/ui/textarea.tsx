import * as React from "react";
import {
  Textarea as KumoTextarea,
  type InputAreaProps,
} from "@cloudflare/kumo/components/input";

export type TextareaProps = InputAreaProps;

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>((props, ref) => {
  const accessibleName =
    props["aria-label"] ??
    (typeof props.placeholder === "string" ? props.placeholder : undefined);

  return <KumoTextarea ref={ref} aria-label={accessibleName} {...props} />;
});
Textarea.displayName = "Textarea";
