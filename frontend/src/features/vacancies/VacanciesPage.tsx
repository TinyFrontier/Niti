import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Briefcase, Plus } from "lucide-react";
import {
  listVacancies,
  WORK_FORMATS,
  type Vacancy,
  type WorkFormat,
} from "@/features/vacancies/api";
import { DataTable, type Column } from "@/shared/data-table/DataTable";
import { useDebouncedValue } from "@/shared/hooks/useDebouncedValue";
import { PageHeader } from "@/shared/layout/PageHeader";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { EmptyState } from "@/shared/ui/empty-state";
import { Input } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";
import { humanize } from "@/shared/lib/format";

const columns: Column<Vacancy>[] = [
  {
    key: "title",
    header: "Title",
    render: (v) => <span className="font-medium">{v.title}</span>,
  },
  { key: "company", header: "Company", render: (v) => v.company?.name ?? "—" },
  { key: "location", header: "Location", render: (v) => v.location ?? "—" },
  {
    key: "work_format",
    header: "Format",
    render: (v) =>
      v.work_format === "unknown" ? "—" : <Badge variant="muted">{humanize(v.work_format)}</Badge>,
  },
  { key: "salary", header: "Salary", render: (v) => v.salary ?? "—" },
  {
    key: "created_at",
    header: "Added",
    render: (v) => (
      <span className="text-muted-foreground">{format(new Date(v.created_at), "d MMM yyyy")}</span>
    ),
  },
];

export function VacanciesPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [workFormat, setWorkFormat] = useState<WorkFormat | "">("");
  const [archived, setArchived] = useState(false);
  const debouncedSearch = useDebouncedValue(search);

  const params = {
    page,
    search: debouncedSearch || undefined,
    work_format: workFormat || undefined,
    archived: archived || undefined,
  };
  const { data, isLoading } = useQuery({
    queryKey: ["vacancies", params],
    queryFn: () => listVacancies(params),
  });

  return (
    <div>
      <PageHeader
        title="Vacancies"
        description="Jobs you are tracking"
        actions={
          <Button size="sm" onClick={() => navigate("/vacancies/new")}>
            <Plus /> Add vacancy
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search by title or company..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="max-w-xs"
        />
        <Select
          value={workFormat}
          onChange={(e) => {
            setWorkFormat(e.target.value as WorkFormat | "");
            setPage(1);
          }}
          className="w-36"
        >
          <option value="">All formats</option>
          {WORK_FORMATS.filter((f) => f !== "unknown").map((f) => (
            <option key={f} value={f}>
              {humanize(f)}
            </option>
          ))}
        </Select>
        <Button
          variant={archived ? "secondary" : "ghost"}
          size="sm"
          onClick={() => {
            setArchived(!archived);
            setPage(1);
          }}
        >
          {archived ? "Showing archived" : "Show archived"}
        </Button>
      </div>
      <DataTable
        columns={columns}
        rows={data?.items ?? []}
        rowKey={(v) => v.id}
        loading={isLoading}
        onRowClick={(v) => navigate(`/vacancies/${v.id}`)}
        page={data?.page}
        pageSize={data?.page_size}
        total={data?.total}
        onPageChange={setPage}
        emptyState={
          <EmptyState
            icon={Briefcase}
            title={archived ? "No archived vacancies" : "No vacancies yet"}
            description="Add a vacancy you found to start tracking it."
            action={
              <Button variant="outline" size="sm" className="mt-1">
                <Link to="/vacancies/new">Add vacancy</Link>
              </Button>
            }
          />
        }
      />
    </div>
  );
}
