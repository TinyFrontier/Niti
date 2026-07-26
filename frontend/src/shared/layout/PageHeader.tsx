import { useEffect } from "react";
import { usePageTitle } from "@/shared/layout/page-title";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  /** Chip shown next to the title, e.g. "Draft". Body placement only. */
  badge?: React.ReactNode;
  /**
   * `header` lifts the heading into the app header — the design does this on
   * list screens. `body` keeps it inline, which is what the form screens show.
   */
  placement?: "header" | "body";
}

export function PageHeader({
  title,
  description,
  actions,
  badge,
  placement = "header",
}: PageHeaderProps) {
  const pageTitle = usePageTitle();
  const setTitle = pageTitle?.setTitle;
  const liftIntoHeader = placement === "header" && Boolean(setTitle);

  useEffect(() => {
    if (!liftIntoHeader || !setTitle) return;
    setTitle({ title, description });
    return () => setTitle(null);
  }, [liftIntoHeader, setTitle, title, description]);

  if (liftIntoHeader) {
    if (!actions) return null;
    return <div className="mb-4 flex flex-wrap items-center justify-end gap-2">{actions}</div>;
  }

  return (
    <header className="mb-7 flex flex-wrap items-start justify-between gap-4 sm:mb-8">
      <div className="max-w-2xl">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-2xl font-semibold leading-tight tracking-[-0.025em] sm:text-[1.75rem]">
            {title}
          </h1>
          {badge}
        </div>
        {description && (
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
