import { useQuery } from "@tanstack/react-query";
import {
  format,
  isBefore,
  isToday,
  isTomorrow,
  parseISO,
  startOfToday,
} from "date-fns";
import {
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarDays,
  CheckSquare,
  ChevronRight,
  CircleDot,
  ExternalLink,
  Gift,
  Send,
  TrendingUp,
  UsersRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { listApplications, type ApplicationStatus } from "@/features/applications/api";
import { StatusBadge } from "@/features/applications/StatusBadge";
import {
  getAnalyticsSummary,
  getApplicationsByStatus,
} from "@/features/dashboard/api";
import { listInterviews } from "@/features/interviews/api";
import { listTasks, type EntityType, type Task } from "@/features/tasks/api";
import { ProfileReminder } from "@/features/career-profile/ProfileReminder";
import { PasteLinkCard } from "@/features/vacancies/PasteLinkCard";
import { humanize } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { EmptyState } from "@/shared/ui/empty-state";
import { Skeleton } from "@/shared/ui/skeleton";

interface StatCardProps {
  label: string;
  value: number | undefined;
  trend: string;
  icon: LucideIcon;
  tone: "blue" | "green" | "orange" | "violet";
  loading: boolean;
}

const toneClasses: Record<StatCardProps["tone"], string> = {
  blue: "bg-primary-subtle text-primary",
  green: "bg-success-subtle text-success-foreground",
  orange: "bg-warning-subtle text-warning-foreground",
  violet: "bg-info-subtle text-info-foreground",
};

function StatCard({ label, value, trend, icon: Icon, tone, loading }: StatCardProps) {
  return (
    <Card className="min-w-0 shadow-xs">
      <CardContent className="flex items-center gap-4 p-5 sm:p-5">
        <div
          className={cn(
            "flex size-12 shrink-0 items-center justify-center rounded-full",
            toneClasses[tone],
          )}
        >
          <Icon className="size-5" />
        </div>
        <dl className="min-w-0">
          <dt className="truncate text-sm text-kumo-subtle">{label}</dt>
          <dd className="mt-0.5">
            {loading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <span className="text-3xl font-semibold leading-none tracking-tight text-primary">
                {value ?? 0}
              </span>
            )}
          </dd>
          <dd className="mt-1 truncate text-xs text-kumo-subtle">{trend}</dd>
        </dl>
      </CardContent>
    </Card>
  );
}

const entityRoutes: Record<EntityType, string> = {
  vacancy: "/vacancies",
  application: "/applications",
  company: "/companies",
  contact: "/contacts",
  interview: "/interviews",
};

function getTaskRoute(task: Task) {
  if (!task.entity_type || !task.entity_id) return "/tasks";
  const base = entityRoutes[task.entity_type];
  return task.entity_type === "interview" ? base : `${base}/${task.entity_id}`;
}

function formatTaskDueDate(dueDate: string | null) {
  if (!dueDate) return { label: "No due date", overdue: false };
  const date = parseISO(dueDate);
  if (isToday(date)) return { label: "Due today", overdue: false };
  if (isTomorrow(date)) return { label: "Tomorrow", overdue: false };
  if (isBefore(date, startOfToday())) return { label: `Overdue · ${format(date, "MMM d")}`, overdue: true };
  return { label: `Due ${format(date, "MMM d")}`, overdue: false };
}

function TaskIcon({ task }: { task: Task }) {
  const iconClass = "size-4";
  if (task.entity_type === "interview") return <CalendarDays className={iconClass} />;
  if (task.entity_type === "application") return <Send className={iconClass} />;
  if (task.entity_type === "vacancy") return <BriefcaseBusiness className={iconClass} />;
  if (task.entity_type === "contact") return <UsersRound className={iconClass} />;
  return <CheckSquare className={iconClass} />;
}

function NeedsAttentionCard({
  tasks,
  loading,
  error,
  onOpenTask,
}: {
  tasks: Task[] | undefined;
  loading: boolean;
  error: boolean;
  onOpenTask: (task: Task) => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Needs attention</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((item) => (
              <Skeleton key={item} className="h-14 w-full" />
            ))}
          </div>
        ) : error ? (
          <p className="rounded-lg bg-destructive-subtle px-4 py-5 text-sm text-destructive">
            Tasks could not be loaded.
          </p>
        ) : tasks && tasks.length > 0 ? (
          <ul className="divide-y divide-kumo-hairline overflow-hidden rounded-xl border border-kumo-hairline">
            {tasks.map((task) => {
              const due = formatTaskDueDate(task.due_date);
              return (
                <li key={task.id} className="grid items-center gap-3 px-3 py-3 sm:grid-cols-[1fr_auto_auto]">
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-full",
                        task.priority === "urgent" || task.priority === "high"
                          ? "bg-destructive-subtle text-destructive"
                          : "bg-primary-subtle text-primary",
                      )}
                    >
                      <TaskIcon task={task} />
                    </span>
                    <span className="min-w-0 truncate text-sm font-medium text-kumo-strong">
                      {task.title}
                    </span>
                  </div>
                  <span
                    className={cn(
                      "pl-11 text-xs sm:pl-0",
                      due.overdue ? "font-medium text-destructive" : "text-warning-foreground",
                    )}
                  >
                    {due.label}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="ml-11 justify-self-start sm:ml-0 sm:justify-self-end"
                    onClick={() => onOpenTask(task)}
                  >
                    Open <ChevronRight />
                  </Button>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            icon={CheckSquare}
            title="Nothing needs attention"
            description="Your open tasks will appear here."
          />
        )}
      </CardContent>
    </Card>
  );
}

function CompanyMonogram({ name }: { name: string }) {
  const letters = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  return (
    <div className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary-active text-lg font-semibold text-white shadow-card">
      {letters || "N"}
    </div>
  );
}

function PipelineCard({
  counts,
  moved,
  loading,
  error,
}: {
  counts: Partial<Record<ApplicationStatus, number>>;
  moved: number | undefined;
  loading: boolean;
  error: boolean;
}) {
  const stages = [
    { label: "Saved", count: counts.saved ?? 0, color: "border-kumo-line bg-kumo-base" },
    {
      label: "Applied",
      count: (counts.applied ?? 0) + (counts.in_review ?? 0),
      color: "border-primary bg-primary",
    },
    {
      label: "Interview",
      count:
        (counts.recruiter_screen ?? 0) +
        (counts.technical_interview ?? 0) +
        (counts.test_task ?? 0) +
        (counts.final_interview ?? 0),
      color: "border-info bg-info",
    },
    { label: "Offer", count: counts.offer ?? 0, color: "border-success bg-success" },
  ];

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Application pipeline</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-44 w-full" />
        ) : error ? (
          <p className="rounded-lg bg-destructive-subtle px-4 py-5 text-sm text-destructive">
            Pipeline could not be loaded.
          </p>
        ) : (
          <>
            <ol className="relative space-y-4 before:absolute before:bottom-4 before:left-[0.4375rem] before:top-4 before:w-px before:bg-kumo-line">
              {stages.map((stage, index) => (
                <li key={stage.label} className="relative grid grid-cols-[1rem_1fr_auto] items-center gap-4">
                  <span
                    className={cn(
                      "relative z-10 size-3.5 rounded-full border-2 shadow-[0_0_0_4px_var(--color-kumo-base)]",
                      stage.color,
                      index === 1 && "ring-4 ring-primary/15",
                    )}
                  />
                  <span className="text-sm font-medium text-kumo-default">{stage.label}</span>
                  <span className="text-base font-semibold text-kumo-strong">{stage.count}</span>
                </li>
              ))}
            </ol>
            <div className="mt-5 flex items-center gap-2 border-t border-kumo-hairline pt-4 text-xs text-kumo-subtle">
              <TrendingUp className="size-4 text-primary" />
              {moved ?? 0} applications moved this week
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function DashboardPage() {
  const navigate = useNavigate();
  const summary = useQuery({
    queryKey: ["analytics", "summary"],
    queryFn: getAnalyticsSummary,
  });
  const recent = useQuery({
    queryKey: ["applications", { recent: true, dashboard: true }],
    queryFn: () => listApplications({ page_size: 5 }),
  });
  const upcoming = useQuery({
    queryKey: ["interviews", { upcoming: true, dashboard: true }],
    queryFn: () => listInterviews({ upcoming: true, page_size: 1 }),
  });
  const attention = useQuery({
    queryKey: ["tasks", { open_only: true, dashboard: true }],
    queryFn: () => listTasks({ open_only: true, page_size: 3 }),
  });
  const statuses = useQuery({
    queryKey: ["analytics", "by-status", "dashboard"],
    queryFn: getApplicationsByStatus,
  });

  const statusCounts = Object.fromEntries(
    (statuses.data ?? []).map((item) => [item.label, item.count]),
  ) as Partial<Record<ApplicationStatus, number>>;
  const nextInterview = upcoming.data?.items[0];
  const companyName = nextInterview?.application.vacancy.company?.name ?? "Independent company";
  const participants =
    nextInterview?.participants
      ?.split(/[,;]+/)
      .map((participant) => participant.trim())
      .filter(Boolean) ?? [];

  const stats: Array<Omit<StatCardProps, "loading">> = [
    {
      label: "Active applications",
      value: summary.data?.active_applications,
      trend: `${summary.data?.active_applications_added_this_week ?? 0} added this week`,
      icon: BriefcaseBusiness,
      tone: "blue",
    },
    {
      label: "Interviews",
      value: summary.data?.upcoming_interviews,
      trend: `${summary.data?.interviews_this_week ?? 0} this week`,
      icon: CalendarDays,
      tone: "green",
    },
    {
      label: "Tasks due",
      value: summary.data?.tasks_due,
      trend: `${summary.data?.tasks_due_today ?? 0} due today`,
      icon: CheckSquare,
      tone: "orange",
    },
    {
      label: "Offers",
      value: summary.data?.offers,
      trend: `${summary.data?.offers_this_week ?? 0} new this week`,
      icon: Gift,
      tone: "violet",
    },
  ];

  return (
    <div>
      {summary.isError && (
        <div className="mb-5 rounded-xl border border-destructive/30 bg-destructive-subtle px-4 py-3 text-sm text-destructive">
          Some dashboard metrics could not be loaded.
        </div>
      )}

      <ProfileReminder />

      <PasteLinkCard source="dashboard" />

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} loading={summary.isLoading} />
        ))}
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(22rem,1fr)]">
        <div className="grid gap-5">
          <NeedsAttentionCard
            tasks={attention.data?.items}
            loading={attention.isLoading}
            error={attention.isError}
            onOpenTask={(task) => navigate(getTaskRoute(task))}
          />

          <Card>
            <CardHeader className="flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg">Recent applications</CardTitle>
              <Button variant="link" size="sm" onClick={() => navigate("/applications")}>
                View all applications
              </Button>
            </CardHeader>
            <CardContent>
              {recent.isLoading ? (
                <div className="space-y-2">
                  {[0, 1, 2, 3].map((item) => (
                    <Skeleton key={item} className="h-12 w-full" />
                  ))}
                </div>
              ) : recent.isError ? (
                <p className="rounded-lg bg-destructive-subtle px-4 py-5 text-sm text-destructive">
                  Recent applications could not be loaded.
                </p>
              ) : recent.data && recent.data.items.length > 0 ? (
                <div className="overflow-x-auto">
                  <div className="min-w-[34rem]">
                    <div className="grid grid-cols-[minmax(12rem,1.5fr)_minmax(8rem,1fr)_6rem_7.5rem_1.5rem] gap-3 border-b border-kumo-hairline px-2 pb-2 text-xs text-kumo-subtle">
                      <span>Role</span>
                      <span>Company</span>
                      <span>Applied</span>
                      <span>Status</span>
                      <span />
                    </div>
                    <ul className="divide-y divide-kumo-hairline">
                      {recent.data.items.map((application) => (
                        <li key={application.id}>
                          <Link
                            to={`/applications/${application.id}`}
                            className="grid grid-cols-[minmax(12rem,1.5fr)_minmax(8rem,1fr)_6rem_7.5rem_1.5rem] items-center gap-3 rounded-lg px-2 py-2.5 text-sm transition-colors hover:bg-kumo-tint"
                          >
                            <span className="flex min-w-0 items-center gap-3">
                              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-kumo-tint text-primary">
                                <BriefcaseBusiness className="size-4" />
                              </span>
                              <span className="truncate font-medium text-kumo-strong">
                                {application.vacancy.title}
                              </span>
                            </span>
                            <span className="truncate text-kumo-subtle">
                              {application.vacancy.company?.name ?? "—"}
                            </span>
                            <span className="text-kumo-subtle">
                              {application.applied_at
                                ? format(parseISO(application.applied_at), "MMM d")
                                : "—"}
                            </span>
                            <span>
                              <StatusBadge status={application.status} />
                            </span>
                            <ChevronRight className="size-4 text-kumo-subtle" />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <EmptyState
                  icon={Send}
                  title="No applications yet"
                  description="Create an application when you apply to a vacancy."
                  action={
                    <Button variant="outline" size="sm" onClick={() => navigate("/applications/new")}>
                      New application
                    </Button>
                  }
                />
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-1">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Next interview</CardTitle>
            </CardHeader>
            <CardContent>
              {upcoming.isLoading ? (
                <Skeleton className="h-44 w-full" />
              ) : upcoming.isError ? (
                <p className="rounded-lg bg-destructive-subtle px-4 py-5 text-sm text-destructive">
                  The next interview could not be loaded.
                </p>
              ) : nextInterview ? (
                <>
                  <div className="flex items-start gap-4">
                    <CompanyMonogram name={companyName} />
                    <div className="min-w-0">
                      <h3 className="truncate text-lg font-semibold text-kumo-strong">{companyName}</h3>
                      <p className="truncate text-sm text-kumo-default">
                        {nextInterview.application.vacancy.title}
                      </p>
                      <div className="mt-3 space-y-2 text-sm text-kumo-subtle">
                        <p className="flex items-center gap-2 text-primary">
                          <CalendarDays className="size-4" />
                          {format(parseISO(nextInterview.scheduled_at), "EEE, MMM d · HH:mm")}
                        </p>
                        <p className="flex items-center gap-2">
                          <CircleDot className="size-4" />
                          {humanize(nextInterview.format)}
                          {nextInterview.duration_minutes
                            ? ` · ${nextInterview.duration_minutes} min`
                            : ""}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-kumo-hairline pt-4">
                    <div className="flex min-w-0 items-center">
                      {participants.slice(0, 3).map((participant, index) => (
                        <span
                          key={`${participant}-${index}`}
                          title={participant}
                          className="-ml-1 flex size-8 first:ml-0 items-center justify-center rounded-full border-2 border-kumo-base bg-kumo-tint text-[0.65rem] font-semibold text-kumo-strong"
                        >
                          {participant
                            .split(/\s+/)
                            .slice(0, 2)
                            .map((part) => part[0])
                            .join("")
                            .toUpperCase()}
                        </span>
                      ))}
                      {participants.length > 3 && (
                        <span className="-ml-1 flex size-8 items-center justify-center rounded-full border-2 border-kumo-base bg-kumo-recessed text-[0.65rem] text-kumo-subtle">
                          +{participants.length - 3}
                        </span>
                      )}
                      {participants.length === 0 && (
                        <span className="text-xs text-kumo-subtle">No participants listed</span>
                      )}
                    </div>
                    {nextInterview.location_or_link?.startsWith("http") ? (
                      <Button
                        size="sm"
                        onClick={() =>
                          window.open(nextInterview.location_or_link ?? "", "_blank", "noopener,noreferrer")
                        }
                      >
                        Join interview <ExternalLink />
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => navigate(`/applications/${nextInterview.application.id}`)}
                      >
                        Open application <ArrowUpRight />
                      </Button>
                    )}
                  </div>
                </>
              ) : (
                <EmptyState
                  icon={CalendarDays}
                  title="No interviews scheduled"
                  description="Your next scheduled interview will appear here."
                  action={
                    <Button variant="outline" size="sm" onClick={() => navigate("/interviews/new")}>
                      Schedule interview
                    </Button>
                  }
                />
              )}
            </CardContent>
          </Card>

          <PipelineCard
            counts={statusCounts}
            moved={summary.data?.applications_moved_this_week}
            loading={statuses.isLoading}
            error={statuses.isError}
          />
        </div>
      </div>
    </div>
  );
}
