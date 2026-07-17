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

function StatCard({ label, value, icon: Icon, loading }: StatCardProps) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-5" />
        </div>
        <div>
          {loading ? (
            <Skeleton className="mb-1 h-7 w-10" />
          ) : (
            <p className="text-2xl font-semibold leading-tight">{value ?? 0}</p>
          )}
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
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

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} loading={isLoading} />
        ))}
      </div>

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
