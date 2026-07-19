import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import {
  Briefcase,
  CalendarClock,
  CheckSquare,
  Plus,
  Send,
  ThumbsDown,
  Trophy,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { listApplications } from "@/features/applications/api";
import { StatusBadge } from "@/features/applications/StatusBadge";
import { listInterviews } from "@/features/interviews/api";
import { getAnalyticsSummary } from "@/features/dashboard/api";
import { Badge } from "@/shared/ui/badge";
import { humanize } from "@/shared/lib/format";
import { PageHeader } from "@/shared/layout/PageHeader";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { EmptyState } from "@/shared/ui/empty-state";
import { Skeleton } from "@/shared/ui/skeleton";

interface StatCardProps {
  label: string;
  value: number | undefined;
  icon: LucideIcon;
  loading: boolean;
}

function StatItem({ label, value, icon: Icon, loading }: StatCardProps) {
  return (
    <div className="flex min-w-0 items-center gap-3 bg-kumo-base px-4 py-4 sm:px-5">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0">
        <dd>
          {loading ? (
            <Skeleton className="mb-1 h-5 w-8" />
          ) : (
            <span className="text-xl font-semibold leading-none text-kumo-strong">{value ?? 0}</span>
          )}
        </dd>
        <dt className="mt-1 truncate text-xs text-kumo-subtle">{label}</dt>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["analytics", "summary"],
    queryFn: getAnalyticsSummary,
  });
  const { data: recent } = useQuery({
    queryKey: ["applications", { recent: true }],
    queryFn: () => listApplications({ page_size: 5 }),
  });
  const { data: upcoming } = useQuery({
    queryKey: ["interviews", { upcoming: true, dashboard: true }],
    queryFn: () => listInterviews({ upcoming: true, page_size: 5 }),
  });

  const stats: Array<{ label: string; value: number | undefined; icon: LucideIcon }> = [
    { label: "Total applications", value: data?.total_applications, icon: Send },
    { label: "Active applications", value: data?.active_applications, icon: Briefcase },
    { label: "Upcoming interviews", value: data?.upcoming_interviews, icon: CalendarClock },
    { label: "Tasks due", value: data?.tasks_due, icon: CheckSquare },
    { label: "Offers", value: data?.offers, icon: Trophy },
    { label: "Rejected", value: data?.rejected, icon: ThumbsDown },
  ];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Your job search at a glance"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => navigate("/vacancies/new")}>
              <Plus /> Add vacancy
            </Button>
            <Button size="sm" onClick={() => navigate("/applications/new")}>
              <Plus /> New application
            </Button>
          </>
        }
      />

      {isError && (
        <div className="mb-6 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          Failed to load dashboard data. Check that the API is running.
        </div>
      )}

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <dl className="grid grid-cols-2 gap-px bg-kumo-line md:grid-cols-3 xl:grid-cols-6">
            {stats.map((stat) => (
              <StatItem key={stat.label} {...stat} loading={isLoading} />
            ))}
          </dl>
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Recent applications</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate("/applications")}>
              View all
            </Button>
          </CardHeader>
          <CardContent>
            {recent && recent.items.length > 0 ? (
              <ul className="divide-y divide-border">
                {recent.items.map((app) => (
                  <li key={app.id}>
                    <Link
                      to={`/applications/${app.id}`}
                      className="flex items-center justify-between gap-3 py-2.5"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">
                          {app.vacancy.title}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {app.vacancy.company?.name ?? "—"}
                          {app.applied_at &&
                            ` · ${format(new Date(app.applied_at), "d MMM")}`}
                        </span>
                      </span>
                      <StatusBadge status={app.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={Send}
                title="No applications yet"
                description="Create an application when you apply to a vacancy."
                action={
                  <Button variant="outline" size="sm" className="mt-1">
                    <Link to="/applications/new">New application</Link>
                  </Button>
                }
              />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Upcoming interviews</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate("/interviews")}>
              View all
            </Button>
          </CardHeader>
          <CardContent>
            {upcoming && upcoming.items.length > 0 ? (
              <ul className="divide-y divide-border">
                {upcoming.items.map((interview) => (
                  <li key={interview.id}>
                    <Link
                      to={`/applications/${interview.application.id}`}
                      className="flex items-center justify-between gap-3 py-2.5"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">
                          {interview.application.vacancy.title}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {format(new Date(interview.scheduled_at), "d MMM, HH:mm")}
                          {interview.application.vacancy.company &&
                            ` · ${interview.application.vacancy.company.name}`}
                        </span>
                      </span>
                      <Badge variant="muted">{humanize(interview.format)}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={CalendarClock}
                title="No interviews scheduled"
                description="Scheduled interviews will show up here."
                action={
                  <Button variant="outline" size="sm" className="mt-1">
                    <Link to="/interviews/new">Schedule interview</Link>
                  </Button>
                }
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
