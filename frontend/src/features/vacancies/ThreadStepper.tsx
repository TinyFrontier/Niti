import { cn } from "@/shared/lib/utils";

export interface ThreadStep {
  label: string;
  /** Steps up to the active one render filled, the rest hollow. */
  state: "done" | "active" | "todo";
}

/**
 * Evenly spaced dots with connectors, labels centred underneath. Each step owns
 * one equal column and draws half a connector on each side, so the dots line up
 * with their labels at any width.
 */
export function ThreadStepper({ steps, className }: { steps: ThreadStep[]; className?: string }) {
  return (
    <ol className={cn("flex items-start", className)}>
      {steps.map((step, index) => {
        const filled = step.state !== "todo";
        return (
          <li key={step.label} className="flex min-w-0 flex-1 flex-col items-center">
            <div className="flex w-full items-center">
              <span
                aria-hidden="true"
                className={cn(
                  "h-px flex-1",
                  index === 0 ? "bg-transparent" : filled ? "bg-primary" : "bg-kumo-line",
                )}
              />
              <span
                className={cn(
                  "flex size-4 shrink-0 items-center justify-center rounded-full border-2",
                  filled ? "border-primary" : "border-kumo-line",
                )}
              >
                {step.state === "active" && (
                  <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
                )}
              </span>
              <span
                aria-hidden="true"
                className={cn(
                  "h-px flex-1",
                  index === steps.length - 1
                    ? "bg-transparent"
                    : steps[index + 1].state !== "todo"
                      ? "bg-primary"
                      : "bg-kumo-line",
                )}
              />
            </div>
            <span
              className={cn(
                "mt-2 truncate text-xs",
                filled ? "font-medium text-primary" : "text-kumo-subtle",
              )}
            >
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
