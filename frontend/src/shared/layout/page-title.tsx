import { createContext, useContext, useMemo, useState } from "react";

export interface PageTitle {
  title: string;
  description?: string;
}

interface PageTitleContextValue {
  title: PageTitle | null;
  setTitle: (value: PageTitle | null) => void;
}

/**
 * Pages publish their heading up into the app header, where the design puts it.
 * Null outside AppLayout (auth screens), so PageHeader can fall back to inline.
 */
const PageTitleContext = createContext<PageTitleContextValue | null>(null);

export function PageTitleProvider({ children }: { children: React.ReactNode }) {
  const [title, setTitle] = useState<PageTitle | null>(null);
  const value = useMemo(() => ({ title, setTitle }), [title]);

  return <PageTitleContext.Provider value={value}>{children}</PageTitleContext.Provider>;
}

export function usePageTitle() {
  return useContext(PageTitleContext);
}
