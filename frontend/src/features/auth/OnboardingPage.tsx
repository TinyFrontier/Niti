import { Navigate, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Briefcase, Layers, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getMe, updateMe, type UserRole } from "@/features/auth/api";
import { cn } from "@/shared/lib/utils";
import { BrandMark } from "@/shared/ui/brand-mark";
import { Skeleton } from "@/shared/ui/skeleton";
import { ModeToggle } from "@/shared/ui/mode-toggle";

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
    accent: "bg-info-subtle text-info",
  },
  {
    role: "recruiter",
    icon: Users,
    title: "Recruiter",
    description: "Run a contacts CRM: candidates, companies, communication and follow-ups.",
    accent: "bg-success-subtle text-success",
  },
  {
    role: "mix",
    icon: Layers,
    title: "Mix",
    description: "Both worlds — search for a job while managing your whole network.",
    accent: "bg-primary-subtle text-primary",
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
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background p-6">
      <div className="absolute right-4 top-4"><ModeToggle /></div>
      <BrandMark className="mb-3 size-12 rounded-lg" iconClassName="size-5" />
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
              "group flex flex-col items-center gap-3 rounded-lg border border-border bg-surface-raised p-8 text-center shadow-card transition-all",
              "hover:-translate-y-1 hover:border-primary/40 hover:shadow-overlay",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              "disabled:pointer-events-none disabled:opacity-60",
            )}
          >
            <div
              className={cn(
                "flex size-14 items-center justify-center rounded-lg transition-transform group-hover:scale-105",
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
