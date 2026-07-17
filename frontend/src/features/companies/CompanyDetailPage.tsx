import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Briefcase, ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
import { deleteCompany, getCompany } from "@/features/companies/api";
import { Rating } from "@/features/companies/CompaniesPage";
import { NotesCard } from "@/features/notes/NotesCard";
import { listVacancies } from "@/features/vacancies/api";
import { PageHeader } from "@/shared/layout/PageHeader";
import { humanize } from "@/shared/lib/format";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { EmptyState } from "@/shared/ui/empty-state";
import { Skeleton } from "@/shared/ui/skeleton";

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium">{children}</span>
    </div>
  );
}

export function CompanyDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: company, isLoading } = useQuery({
    queryKey: ["companies", id],
    queryFn: () => getCompany(id!),
  });
  const { data: vacancies } = useQuery({
    queryKey: ["vacancies", { company_id: id }],
    queryFn: () => listVacancies({ company_id: id! }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteCompany(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      navigate("/companies");
    },
  });

  if (isLoading || !company) {
    return <Skeleton className="h-64 w-full" />;
  }

  return (
    <div>
      <PageHeader
        title={company.name}
        description={company.industry ?? undefined}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => navigate(`/companies/${id}/edit`)}>
              <Pencil /> Edit
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (window.confirm("Delete this company?")) deleteMutation.mutate();
              }}
            >
              <Trash2 /> Delete
            </Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border">
            <InfoRow label="Website">
              {company.website ? (
                <a
                  href={company.website}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  Open <ExternalLink className="size-3.5" />
                </a>
              ) : (
                "—"
              )}
            </InfoRow>
            <InfoRow label="Location">{company.location ?? "—"}</InfoRow>
            <InfoRow label="Size">{company.size ?? "—"}</InfoRow>
            <InfoRow label="Interest">
              <Rating value={company.rating} />
            </InfoRow>
            <InfoRow label="Added">{format(new Date(company.created_at), "d MMM yyyy")}</InfoRow>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Vacancies</CardTitle>
            <Button variant="outline" size="sm" onClick={() => navigate("/vacancies/new")}>
              <Plus /> Add vacancy
            </Button>
          </CardHeader>
          <CardContent>
            {vacancies && vacancies.items.length > 0 ? (
              <ul className="divide-y divide-border">
                {vacancies.items.map((v) => (
                  <li key={v.id}>
                    <Link
                      to={`/vacancies/${v.id}`}
                      className="flex items-center justify-between gap-2 py-2.5"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{v.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {v.location ?? "—"}
                          {v.salary && ` · ${v.salary}`}
                        </span>
                      </span>
                      <Badge variant="muted">{humanize(v.work_format)}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={Briefcase}
                title="No vacancies for this company"
                description="Vacancies you add for this company will appear here."
              />
            )}
          </CardContent>
        </Card>
      </div>

      {company.description && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-base">Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm text-foreground/90">{company.description}</p>
          </CardContent>
        </Card>
      )}

      <NotesCard entityType="company" entityId={company.id} className="mt-4" />
    </div>
  );
}
