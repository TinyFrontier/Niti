import { Navigate, Outlet } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getMe } from "@/features/auth/api";
import { Skeleton } from "@/shared/ui/skeleton";

/**
 * Blocks the app until onboarding is finished. Completion is its own fact rather
 * than "a role is set", because a job seeker has further steps after the role —
 * and skipping those still counts as finished.
 */
export function OnboardingGate() {
  const { data: user, isLoading } = useQuery({ queryKey: ["auth", "me"], queryFn: getMe });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <Skeleton className="h-64 w-full max-w-4xl" />
      </div>
    );
  }
  if (user && !user.onboarding_completed_at) {
    return <Navigate to="/onboarding" replace />;
  }
  return <Outlet />;
}
