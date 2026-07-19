import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { forwardRef, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { LinkProvider, type LinkComponentProps } from "@cloudflare/kumo/utils";
import { ThemeProvider } from "@/app/theme-provider";

const AppLink = forwardRef<HTMLAnchorElement, LinkComponentProps>(
  ({ href, to: _to, ...props }, ref) => <RouterLink ref={ref} to={href ?? ""} {...props} />,
);
AppLink.displayName = "AppLink";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            staleTime: 30_000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <ThemeProvider>
      <LinkProvider component={AppLink}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </LinkProvider>
    </ThemeProvider>
  );
}
