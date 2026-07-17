import { Navigate, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Briefcase, Layers, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getMe, updateMe, type UserRole } from "@/features/auth/api";
import { cn } from "@/shared/lib/utils";
import { Skeleton } from "@/shared/ui/skeleton";

interface RoleCard {
  role: UserRole;
  icon: LucideIcon;
  title: string;
  description: string;
  accent: string;
}

const ROLE_CARDS: RoleCard[] = [
  {
    role: "job_seeker",
    icon: Briefcase,
    title: "Job Seeker",
    description: "Track vacancies, applications, CV versions and interviews in one place.",
    accent: "bg-blue-100 text-blue-600",
  },
  {
    role: "recruiter",
    icon: Users,
    title: "Recruiter",
    description: "Run a contacts CRM: candidates, companies, communication and follow-ups.",
    accent: "bg-emerald-100 text-emerald-600",
  },
  {
    role: "mix",
    icon: Layers,
    title: "Mix",
    description: "Both worlds — search for a job while managing your whole network.",
    accent: "bg-violet-100 text-violet-600",
  },
];

export function OnboardingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: user, isLoading } = useQuery({ queryKey: ["auth", "me"], queryFn: getMe });

  const mutation = useMutation({
    mutationFn: (role: UserRole) => updateMe({ role }),
    onSuccess: (updated) => {
      queryClient.setQueryData(["auth", "me"], updated);
      navigate("/", { replace: true });
    },
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Skeleton className="h-64 w-full max-w-3xl" />
      </div>
    );
  }
  if (user?.role) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6">
      <div className="mb-2 flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <Briefcase className="size-6" />
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">
        Welcome{user?.full_name ? `, ${user.full_name}` : ""}!
      </h1>
      <p className="mt-1 text-muted-foreground">How are you going to use Job Search CRM?</p>

      <div className="mt-8 grid w-full max-w-4xl gap-4 sm:grid-cols-3">
        {ROLE_CARDS.map(({ role, icon: Icon, title, description, accent }) => (
          <button
            key={role}
            disabled={mutation.isPending}
            onClick={() => mutation.mutate(role)}
            className={cn(
              "group flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-8 text-center shadow-sm transition-all",
              "hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              "disabled:pointer-events-none disabled:opacity-60",
            )}
          >
            <div
              className={cn(
                "flex size-14 items-center justify-center rounded-2xl transition-transform group-hover:scale-110",
                accent,
              )}
            >
              <Icon className="size-7" />
            </div>
            <span className="text-lg font-semibold">{title}</span>
            <span className="text-sm leading-relaxed text-muted-foreground">{description}</span>
          </button>
        ))}
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        You can change this any time in Settings.
      </p>
    </div>
  );
}
