import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Plus, Send, SquareKanban, Table2 } from "lucide-react";
import {
  APPLICATION_STATUSES,
  listApplications,
  type Application,
  type ApplicationStatus,
} from "@/features/applications/api";
import { ApplicationsBoard } from "@/features/applications/board/ApplicationsBoard";
import { StatusBadge } from "@/features/applications/StatusBadge";
import { DataTable, type Column } from "@/shared/data-table/DataTable";
import { useDebouncedValue } from "@/shared/hooks/useDebouncedValue";
import { PageHeader } from "@/shared/layout/PageHeader";
import { humanize } from "@/shared/lib/format";
import { Button } from "@/shared/ui/button";
import { EmptyState } from "@/shared/ui/empty-state";
import { Input } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";

const columns: Column<Application>[] = [
  {
    key: "vacancy",
    header: "Vacancy",
    render: (a) => <span className="font-medium">{a.vacancy.title}</span>,
  },
  { key: "company", header: "Company", render: (a) => a.vacancy.company?.name ?? "—" },
  { key: "status", header: "Status", render: (a) => <StatusBadge status={a.status} /> },
  { key: "source", header: "Source", render: (a) => a.source ?? "—" },
  {
    key: "applied_at",
    header: "Applied",
    render: (a) =>
      a.applied_at ? (
        format(new Date(a.applied_at), "d MMM yyyy")
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    key: "cv",
    header: "CV",
    render: (a) => a.cv_version?.title ?? <span className="text-muted-foreground">—</span>,
  },
];

type ApplicationsView = "table" | "board";

const VIEW_STORAGE_KEY = "niti_applications_view";

function getStoredView(): ApplicationsView {
  try {
    return localStorage.getItem(VIEW_STORAGE_KEY) === "table" ? "table" : "board";
  } catch {
    return "board";
  }
}

function ViewToggle({
  view,
  onChange,
}: {
  view: ApplicationsView;
  onChange: (view: ApplicationsView) => void;
}) {
  const options = [
    { value: "table" as const, label: "Table", icon: Table2 },
    { value: "board" as const, label: "Board", icon: SquareKanban },
  ];
  return (
    <div
      role="group"
      aria-label="View mode"
      className="flex items-center gap-0.5 rounded-lg border border-kumo-hairline bg-kumo-recessed p-0.5"
    >
      {options.map(({ value, label, icon: Icon }) => (
        <Button
          key={value}
          variant={view === value ? "secondary" : "ghost"}
          size="sm"
          aria-pressed={view === value}
          onClick={() => onChange(value)}
        >
          <Icon /> {label}
        </Button>
      ))}
    </div>
  );
}

export function ApplicationsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const cvVersionId = searchParams.get("cv_version_id") ?? undefined;
  const [view, setView] = useState<ApplicationsView>(getStoredView);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ApplicationStatus | "">("");
  const debouncedSearch = useDebouncedValue(search);

  const params = {
    page,
    search: debouncedSearch || undefined,
    status: status || undefined,
    cv_version_id: cvVersionId,
  };
  const { data, isLoading } = useQuery({
    queryKey: ["applications", params],
    queryFn: () => listApplications(params),
    enabled: view === "table",
  });

  const changeView = (next: ApplicationsView) => {
    setView(next);
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, next);
    } catch {
      // Persisting the preference is best-effort only.
    }
  };

  return (
    <div>
      <PageHeader
        title="Applications"
        description="Every application you have sent"
        actions={
          <>
            <ViewToggle view={view} onChange={changeView} />
            <Button size="sm" onClick={() => navigate("/applications/new")}>
              <Plus /> New application
            </Button>
          </>
        }
      />
      {view === "board" ? (
        <ApplicationsBoard />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Input
              placeholder="Search by vacancy or company..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="max-w-xs"
            />
            <Select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as ApplicationStatus | "");
                setPage(1);
              }}
              className="w-44"
            >
              <option value="">All statuses</option>
              {APPLICATION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {humanize(s)}
                </option>
              ))}
            </Select>
            {cvVersionId && (
              <Button variant="secondary" size="sm" onClick={() => setSearchParams({})}>
                Filtered by CV · clear
              </Button>
            )}
          </div>
          <DataTable
            columns={columns}
            rows={data?.items ?? []}
            rowKey={(a) => a.id}
            loading={isLoading}
            onRowClick={(a) => navigate(`/applications/${a.id}`)}
            page={data?.page}
            pageSize={data?.page_size}
            total={data?.total}
            onPageChange={setPage}
            emptyState={
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
            }
          />
        </>
      )}
    </div>
  );
}
