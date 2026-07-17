import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarClock, ExternalLink, Plus, Trash2 } from "lucide-react";
import {
  deleteInterview,
  INTERVIEW_RESULTS,
  listInterviews,
  updateInterview,
  type Interview,
  type InterviewResult,
} from "@/features/interviews/api";
import { DataTable, type Column } from "@/shared/data-table/DataTable";
import { PageHeader } from "@/shared/layout/PageHeader";
import { humanize } from "@/shared/lib/format";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { EmptyState } from "@/shared/ui/empty-state";
import { Select } from "@/shared/ui/select";

type Tab = "upcoming" | "past" | "all";

export function InterviewsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("upcoming");
  const [page, setPage] = useState(1);

  const params = {
    page,
    upcoming: tab === "all" ? undefined : tab === "upcoming",
  };
  const { data, isLoading } = useQuery({
    queryKey: ["interviews", params],
    queryFn: () => listInterviews(params),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["interviews"] });
  const resultMutation = useMutation({
    mutationFn: ({ id, result }: { id: string; result: InterviewResult }) =>
      updateInterview(id, { result }),
    onSuccess: invalidate,
  });
  const deleteMutation = useMutation({ mutationFn: deleteInterview, onSuccess: invalidate });

  const columns: Column<Interview>[] = [
    {
      key: "when",
      header: "When",
      render: (i) => (
        <span>
          <span className="block font-medium">
            {format(new Date(i.scheduled_at), "d MMM yyyy, HH:mm")}
          </span>
          {i.duration_minutes && (
            <span className="block text-xs text-muted-foreground">{i.duration_minutes} min</span>
          )}
        </span>
      ),
    },
    {
      key: "vacancy",
      header: "Vacancy",
      render: (i) => (
        <span>
          <span className="block">{i.application.vacancy.title}</span>
          <span className="block text-xs text-muted-foreground">
            {i.application.vacancy.company?.name ?? "—"}
          </span>
        </span>
      ),
    },
    { key: "format", header: "Format", render: (i) => <Badge variant="muted">{humanize(i.format)}</Badge> },
    { key: "participants", header: "Participants", render: (i) => i.participants ?? "—" },
    {
      key: "link",
      header: "Link",
      render: (i) =>
        i.location_or_link?.startsWith("http") ? (
          <a
            href={i.location_or_link}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-primary hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            Join <ExternalLink className="size-3.5" />
          </a>
        ) : (
          (i.location_or_link ?? "—")
        ),
    },
    {
      key: "result",
      header: "Result",
      render: (i) => (
        <Select
          className="h-8 w-32"
          value={i.result ?? ""}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) =>
            resultMutation.mutate({ id: i.id, result: e.target.value as InterviewResult })
          }
        >
          <option value="" disabled>
            Set result...
          </option>
          {INTERVIEW_RESULTS.map((r) => (
            <option key={r} value={r}>
              {humanize(r)}
            </option>
          ))}
        </Select>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "w-12",
      render: (i) => (
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            if (window.confirm("Delete this interview?")) deleteMutation.mutate(i.id);
          }}
        >
          <Trash2 className="size-3.5 text-muted-foreground" />
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Interviews"
        description="Everything scheduled and how it went"
        actions={
          <Button size="sm" onClick={() => navigate("/interviews/new")}>
            <Plus /> Schedule interview
          </Button>
        }
      />
      <div className="mb-4 flex items-center gap-1">
        {(["upcoming", "past", "all"] as Tab[]).map((t) => (
          <Button
            key={t}
            variant={tab === t ? "secondary" : "ghost"}
            size="sm"
            onClick={() => {
              setTab(t);
              setPage(1);
            }}
          >
            {humanize(t)}
          </Button>
        ))}
      </div>
      <DataTable
        columns={columns}
        rows={data?.items ?? []}
        rowKey={(i) => i.id}
        loading={isLoading}
        onRowClick={(i) => navigate(`/applications/${i.application.id}`)}
        page={data?.page}
        pageSize={data?.page_size}
        total={data?.total}
        onPageChange={setPage}
        emptyState={
          <EmptyState
            icon={CalendarClock}
            title={tab === "upcoming" ? "No upcoming interviews" : "No interviews"}
            description="Schedule an interview linked to one of your applications."
          />
        }
      />
    </div>
  );
}
