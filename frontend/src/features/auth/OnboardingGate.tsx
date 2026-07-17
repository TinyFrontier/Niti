import { Navigate, Outlet } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getMe } from "@/features/auth/api";
import { Skeleton } from "@/shared/ui/skeleton";

/** Blocks the app until the user has picked a role in onboarding. */
export function OnboardingGate() {
  const { data: user, isLoading } = useQuery({ queryKey: ["auth", "me"], queryFn: getMe });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <Skeleton className="h-64 w-full max-w-4xl" />
      </div>
    );
  }
  if (user && !user.role) {
    return <Navigate to="/onboarding" replace />;
  }
  return <Outlet />;
}
