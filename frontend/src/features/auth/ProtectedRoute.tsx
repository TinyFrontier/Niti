import { Navigate, Outlet } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getMe } from "@/features/auth/api";
import { Skeleton } from "@/shared/ui/skeleton";

/** Blocks private routes until the session cookie is validated against /auth/me. */
export function ProtectedRoute() {
  const { isPending, isError } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: getMe,
    retry: false,
    staleTime: 60_000,
  });

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <Skeleton className="h-64 w-full max-w-4xl" />
      </div>
    );
  }
  if (isError) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}
