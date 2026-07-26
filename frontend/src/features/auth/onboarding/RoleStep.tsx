import { Briefcase, Layers, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { UserRole } from "@/features/auth/api";
import { cn } from "@/shared/lib/utils";

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

export function RoleStep({
  onPick,
  disabled,
}: {
  onPick: (role: UserRole) => void;
  disabled: boolean;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {ROLE_CARDS.map(({ role, icon: Icon, title, description, accent }) => (
        <button
          key={role}
          disabled={disabled}
          onClick={() => onPick(role)}
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
  );
}
