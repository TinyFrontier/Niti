import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Building2, Plus, Star } from "lucide-react";
import { listCompanies, type Company } from "@/features/companies/api";
import { DataTable, type Column } from "@/shared/data-table/DataTable";
import { useDebouncedValue } from "@/shared/hooks/useDebouncedValue";
import { PageHeader } from "@/shared/layout/PageHeader";
import { Button } from "@/shared/ui/button";
import { EmptyState } from "@/shared/ui/empty-state";
import { Input } from "@/shared/ui/input";

export function Rating({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="inline-flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={
            i < value ? "size-3.5 fill-amber-400 text-amber-400" : "size-3.5 text-border"
          }
        />
      ))}
    </span>
  );
}

const columns: Column<Company>[] = [
  {
    key: "name",
    header: "Name",
    render: (c) => <span className="font-medium">{c.name}</span>,
  },
  { key: "industry", header: "Industry", render: (c) => c.industry ?? "—" },
  { key: "location", header: "Location", render: (c) => c.location ?? "—" },
  { key: "rating", header: "Interest", render: (c) => <Rating value={c.rating} /> },
  {
    key: "created_at",
    header: "Added",
    render: (c) => (
      <span className="text-muted-foreground">{format(new Date(c.created_at), "d MMM yyyy")}</span>
    ),
  },
];

export function CompaniesPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);

  const params = { page, search: debouncedSearch || undefined };
  const { data, isLoading } = useQuery({
    queryKey: ["companies", params],
    queryFn: () => listCompanies(params),
  });

  return (
    <div>
      <PageHeader
        title="Companies"
        description="Employers you are tracking"
        actions={
          <Button size="sm" onClick={() => navigate("/companies/new")}>
            <Plus /> Add company
          </Button>
        }
      />
      <div className="mb-4">
        <Input
          placeholder="Search by name..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="max-w-xs"
        />
      </div>
      <DataTable
        columns={columns}
        rows={data?.items ?? []}
        rowKey={(c) => c.id}
        loading={isLoading}
        onRowClick={(c) => navigate(`/companies/${c.id}`)}
        page={data?.page}
        pageSize={data?.page_size}
        total={data?.total}
        onPageChange={setPage}
        emptyState={
          <EmptyState
            icon={Building2}
            title="No companies yet"
            description="Companies are created automatically when you add vacancies, or add one manually."
            action={
              <Button variant="outline" size="sm" className="mt-1">
                <Link to="/companies/new">Add company</Link>
              </Button>
            }
          />
        }
      />
    </div>
  );
}
