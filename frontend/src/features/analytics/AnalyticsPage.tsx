import { useQuery } from "@tanstack/react-query";
import { ChartNoAxesColumn } from "lucide-react";
import { api } from "@/shared/api/client";
import { getAnalyticsSummary } from "@/features/dashboard/api";
import { PageHeader } from "@/shared/layout/PageHeader";
import { humanize } from "@/shared/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { EmptyState } from "@/shared/ui/empty-state";
import { Skeleton } from "@/shared/ui/skeleton";

interface CountItem {
  label: string;
  count: number;
}

interface CVUsageItem {
  cv_version_id: string;
  title: string;
  applications_count: number;
}

function BarList({ items, loading }: { items: CountItem[] | undefined; loading: boolean }) {
  if (loading) return <Skeleton className="h-32 w-full" />;
  if (!items || items.length === 0 || items.every((i) => i.count === 0)) {
    return (
      <EmptyState icon={ChartNoAxesColumn} title="No data yet" description="Add applications first." />
    );
  }
  const max = Math.max(...items.map((i) => i.count), 1);
  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-3">
          <span className="w-36 shrink-0 truncate text-sm text-muted-foreground">
            {humanize(item.label)}
          </span>
          <div className="h-5 flex-1 overflow-hidden rounded-md bg-muted">
            <div
              className="h-full rounded-md bg-primary/80"
              style={{ width: `${(item.count / max) * 100}%` }}
            />
          </div>
          <span className="w-8 text-right text-sm font-medium">{item.count}</span>
        </li>
      ))}
    </ul>
  );
}

export function AnalyticsPage() {
  const { data: summary } = useQuery({
    queryKey: ["analytics", "summary"],
    queryFn: getAnalyticsSummary,
  });
  const byStatus = useQuery({
    queryKey: ["analytics", "by-status"],
    queryFn: () => api<CountItem[]>("/analytics/applications-by-status"),
  });
  const bySource = useQuery({
    queryKey: ["analytics", "by-source"],
    queryFn: () => api<CountItem[]>("/analytics/applications-by-source"),
  });
  const funnel = useQuery({
    queryKey: ["analytics", "funnel"],
    queryFn: () => api<CountItem[]>("/analytics/funnel"),
  });
  const cvUsage = useQuery({
    queryKey: ["analytics", "cv-usage"],
    queryFn: () => api<CVUsageItem[]>("/analytics/cv-usage"),
  });

  const conversion =
    summary && summary.total_applications > 0
      ? Math.round((summary.offers / summary.total_applications) * 100)
      : 0;

  return (
    <div>
      <PageHeader
        title="Analytics"
        description={
          summary
            ? `${summary.total_applications} applications · ${summary.offers} offers · ${conversion}% conversion to offer`
            : "How your search is going"
        }
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Applications by status</CardTitle>
          </CardHeader>
          <CardContent>
            <BarList items={byStatus.data} loading={byStatus.isLoading} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Applications by source</CardTitle>
          </CardHeader>
          <CardContent>
            <BarList items={bySource.data} loading={bySource.isLoading} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Conversion funnel</CardTitle>
          </CardHeader>
          <CardContent>
            <BarList items={funnel.data} loading={funnel.isLoading} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">CV usage</CardTitle>
          </CardHeader>
          <CardContent>
            <BarList
              items={cvUsage.data?.map((cv) => ({
                label: cv.title,
                count: cv.applications_count,
              }))}
              loading={cvUsage.isLoading}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
