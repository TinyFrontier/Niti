import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { getMe } from "@/features/auth/api";
import { getCareerProfile } from "@/features/career-profile/api";
import { Button } from "@/shared/ui/button";

/**
 * The nudge that makes a skippable profile step viable: instead of walling the
 * app off at registration, the reminder follows the user until matching can run.
 */
export function ProfileReminder() {
  const { data: user } = useQuery({ queryKey: ["auth", "me"], queryFn: getMe });
  const seeker = user?.role === "job_seeker" || user?.role === "mix";

  const { data: profile } = useQuery({
    queryKey: ["career-profile"],
    queryFn: getCareerProfile,
    enabled: seeker,
  });

  if (!seeker || !profile || profile.is_ready_for_matching) return null;

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-primary-subtle/40 p-3">
      <div className="flex items-center gap-2.5">
        <Sparkles className="size-4 shrink-0 text-primary" />
        <p className="text-sm">
          <span className="font-medium">Your career profile is {profile.completeness}% done.</span>{" "}
          <span className="text-muted-foreground">
            Niti can score vacancies against it once these are filled:{" "}
            {profile.missing_for_matching.join(", ")}.
          </span>
        </p>
      </div>
      <Button size="sm" variant="secondary">
        <Link to="/career-profile">Finish profile</Link>
      </Button>
    </div>
  );
}
