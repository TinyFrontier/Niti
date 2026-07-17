import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Trash2 } from "lucide-react";
import {
  APPLICATION_STATUSES,
  deleteApplication,
  getApplication,
  updateApplication,
  type ApplicationStatus,
} from "@/features/applications/api";
import { StatusBadge } from "@/features/applications/StatusBadge";
import { NotesCard } from "@/features/notes/NotesCard";
import { PageHeader } from "@/shared/layout/PageHeader";
import { humanize } from "@/shared/lib/format";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Select } from "@/shared/ui/select";
import { Skeleton } from "@/shared/ui/skeleton";

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium">{children}</span>
    </div>
  );
}

export function ApplicationDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: application, isLoading } = useQuery({
    queryKey: ["applications", id],
    queryFn: () => getApplication(id!),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["applications"] });
    queryClient.invalidateQueries({ queryKey: ["analytics"] });
  };
  const statusMutation = useMutation({
    mutationFn: (status: ApplicationStatus) => updateApplication(id!, { status }),
    onSuccess: invalidate,
  });
  const deleteMutation = useMutation({
    mutationFn: () => deleteApplication(id!),
    onSuccess: () => {
      invalidate();
      navigate("/applications");
    },
  });

  if (isLoading || !application) {
    return <Skeleton className="h-64 w-full" />;
  }

  return (
    <div>
      <PageHeader
        title={application.vacancy.title}
        description={application.vacancy.company?.name ?? undefined}
        actions={
          <Button
            variant="destructive"
            size="sm"
            disabled={deleteMutation.isPending}
            onClick={() => {
              if (window.confirm("Delete this application?")) deleteMutation.mutate();
            }}
          >
            <Trash2 /> Delete
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Application</CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border">
            <InfoRow label="Status">
              <span className="inline-flex items-center gap-2">
                <StatusBadge status={application.status} />
                <Select
                  className="h-8 w-44"
                  value={application.status}
                  disabled={statusMutation.isPending}
                  onChange={(e) => statusMutation.mutate(e.target.value as ApplicationStatus)}
                >
                  {APPLICATION_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {humanize(s)}
                    </option>
                  ))}
                </Select>
              </span>
            </InfoRow>
            <InfoRow label="Vacancy">
              <Link
                to={`/vacancies/${application.vacancy.id}`}
                className="text-primary hover:underline"
              >
                {application.vacancy.title}
              </Link>
            </InfoRow>
            <InfoRow label="Applied on">
              {application.applied_at
                ? format(new Date(application.applied_at), "d MMM yyyy")
                : "—"}
            </InfoRow>
            <InfoRow label="Source">{application.source ?? "—"}</InfoRow>
            <InfoRow label="CV version">
              {application.cv_version ? application.cv_version.title : "—"}
            </InfoRow>
            <InfoRow label="Created">
              {format(new Date(application.created_at), "d MMM yyyy")}
            </InfoRow>
          </CardContent>
        </Card>

        <NotesCard entityType="application" entityId={application.id} />
      </div>
      {application.notes && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-base">Quick note</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm text-foreground/90">{application.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
