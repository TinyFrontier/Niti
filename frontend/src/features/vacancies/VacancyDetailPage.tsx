import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Archive, ArchiveRestore, ExternalLink, Pencil, Plus, Send, Trash2 } from "lucide-react";
import {
  archiveVacancy,
  deleteVacancy,
  getVacancy,
  unarchiveVacancy,
} from "@/features/vacancies/api";
import { listApplications } from "@/features/applications/api";
import { StatusBadge } from "@/features/applications/StatusBadge";
import { NotesCard } from "@/features/notes/NotesCard";
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

export function VacancyDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: vacancy, isLoading } = useQuery({
    queryKey: ["vacancies", id],
    queryFn: () => getVacancy(id!),
  });
  const { data: applications } = useQuery({
    queryKey: ["applications", { vacancy_id: id }],
    queryFn: () => listApplications({ vacancy_id: id! }),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["vacancies"] });
  };
  const archiveMutation = useMutation({
    mutationFn: () => (vacancy?.archived_at ? unarchiveVacancy(id!) : archiveVacancy(id!)),
    onSuccess: invalidate,
  });
  const deleteMutation = useMutation({
    mutationFn: () => deleteVacancy(id!),
    onSuccess: () => {
      invalidate();
      navigate("/vacancies");
    },
  });

  if (isLoading || !vacancy) {
    return <Skeleton className="h-64 w-full" />;
  }

  return (
    <div>
      <PageHeader
        title={vacancy.title}
        description={vacancy.company?.name ?? undefined}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => navigate(`/vacancies/${id}/edit`)}>
              <Pencil /> Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={archiveMutation.isPending}
              onClick={() => archiveMutation.mutate()}
            >
              {vacancy.archived_at ? (
                <>
                  <ArchiveRestore /> Unarchive
                </>
              ) : (
                <>
                  <Archive /> Archive
                </>
              )}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (window.confirm("Delete this vacancy?")) deleteMutation.mutate();
              }}
            >
              <Trash2 /> Delete
            </Button>
          </>
        }
      />

      {vacancy.archived_at && (
        <div className="mb-4 rounded-lg bg-muted px-4 py-2 text-sm text-muted-foreground">
          Archived {format(new Date(vacancy.archived_at), "d MMM yyyy")}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border">
            <InfoRow label="Company">
              {vacancy.company ? (
                <Link to={`/companies/${vacancy.company.id}`} className="text-primary hover:underline">
                  {vacancy.company.name}
                </Link>
              ) : (
                "—"
              )}
            </InfoRow>
            <InfoRow label="Location">{vacancy.location ?? "—"}</InfoRow>
            <InfoRow label="Salary">{vacancy.salary ?? "—"}</InfoRow>
            <InfoRow label="Work format">
              <Badge variant="muted">{humanize(vacancy.work_format)}</Badge>
            </InfoRow>
            <InfoRow label="Job type">
              <Badge variant="muted">{humanize(vacancy.job_type)}</Badge>
            </InfoRow>
            <InfoRow label="URL">
              {vacancy.url ? (
                <a
                  href={vacancy.url}
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
            {vacancy.sources.length > 0 && (
              <InfoRow label="Sources">
                <span className="flex flex-wrap justify-end gap-1">
                  {vacancy.sources.map((s) => (
                    <Badge key={s.id} variant="muted">
                      {s.platform}
                    </Badge>
                  ))}
                </span>
              </InfoRow>
            )}
            <InfoRow label="Added">{format(new Date(vacancy.created_at), "d MMM yyyy")}</InfoRow>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Applications</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/applications/new?vacancy_id=${id}`)}
            >
              <Plus /> New application
            </Button>
          </CardHeader>
          <CardContent>
            {applications && applications.items.length > 0 ? (
              <ul className="divide-y divide-border">
                {applications.items.map((app) => (
                  <li key={app.id}>
                    <Link
                      to={`/applications/${app.id}`}
                      className="flex items-center justify-between gap-2 py-2.5 hover:bg-muted/40"
                    >
                      <span className="text-sm">
                        {app.applied_at
                          ? format(new Date(app.applied_at), "d MMM yyyy")
                          : "Not applied yet"}
                        {app.source && (
                          <span className="text-muted-foreground"> · via {app.source}</span>
                        )}
                      </span>
                      <StatusBadge status={app.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={Send}
                title="No applications for this vacancy"
                description="Create one when you apply."
              />
            )}
          </CardContent>
        </Card>
      </div>

      {vacancy.description && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-base">Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm text-foreground/90">{vacancy.description}</p>
          </CardContent>
        </Card>
      )}

      <NotesCard entityType="vacancy" entityId={vacancy.id} className="mt-4" />
    </div>
  );
}
