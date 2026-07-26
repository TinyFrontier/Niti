import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Globe, Info } from "lucide-react";
import {
  createVacancy,
  getVacancy,
  updateVacancy,
  type VacancyPayload,
} from "@/features/vacancies/api";
import { ThreadStepper } from "@/features/vacancies/ThreadStepper";
import { VacancyForm, type VacancyFormValues } from "@/features/vacancies/VacancyForm";
import { PageHeader } from "@/shared/layout/PageHeader";
import { ApiError } from "@/shared/api/client";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { Skeleton } from "@/shared/ui/skeleton";

export function VacancyFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);

  const { data: existing, isLoading: loadingExisting } = useQuery({
    queryKey: ["vacancies", id],
    queryFn: () => getVacancy(id!),
    enabled: isEdit,
  });

  const mutation = useMutation({
    mutationFn: (values: VacancyFormValues) => {
      const payload: VacancyPayload = {
        title: values.title,
        company_name: values.company_name?.trim() || undefined,
        url: values.url?.trim() || undefined,
        location: values.location?.trim() || undefined,
        salary: values.salary?.trim() || undefined,
        work_format: values.work_format,
        job_type: values.job_type,
        description: values.description?.trim() || undefined,
      };
      return isEdit ? updateVacancy(id!, payload) : createVacancy(payload);
    },
    onSuccess: (vacancy) => {
      queryClient.invalidateQueries({ queryKey: ["vacancies"] });
      navigate(`/vacancies/${vacancy.id}`);
    },
    onError: (error) => {
      setServerError(error instanceof ApiError ? error.detail : "Something went wrong");
    },
  });

  if (isEdit && loadingExisting) {
    return <Skeleton className="h-64 w-full max-w-3xl" />;
  }

  return (
    <div>
      <Link
        to="/vacancies"
        className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-kumo-link hover:underline"
      >
        <ArrowLeft className="size-4" /> Back to vacancies
      </Link>

      <PageHeader
        placement="body"
        title={isEdit ? "Edit vacancy" : "Add a vacancy"}
        badge={isEdit ? undefined : <Badge variant="muted">Draft</Badge>}
        description={
          isEdit
            ? "Update the role and keep the rest of the thread accurate."
            : "Save an opportunity and keep the next step connected."
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0">
          {!isEdit && (
            <Card className="mb-5 bg-primary-subtle/40 shadow-none">
              <CardContent className="flex flex-wrap items-center gap-4 p-4 sm:p-5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-subtle text-primary">
                  <Globe className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-kumo-strong">Have a job link?</p>
                  <p className="mt-0.5 text-sm text-kumo-subtle">
                    Import the job from a URL and we&apos;ll fill in the details for you.
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="shrink-0"
                  onClick={() => navigate("/vacancies/import")}
                >
                  Import from URL
                </Button>
              </CardContent>
            </Card>
          )}

          <VacancyForm
            initialValues={
              existing
                ? {
                    title: existing.title,
                    company_name: existing.company?.name ?? "",
                    url: existing.url ?? "",
                    location: existing.location ?? "",
                    salary: existing.salary ?? "",
                    work_format: existing.work_format,
                    job_type: existing.job_type,
                    description: existing.description ?? "",
                  }
                : undefined
            }
            excludeId={id}
            onSubmit={(values) => mutation.mutate(values)}
            submitLabel={isEdit ? "Save changes" : "Create vacancy"}
            serverError={serverError}
            submitting={mutation.isPending}
          />
        </div>

        <aside className="flex flex-col gap-4">
          <Card>
            <CardContent className="p-5">
              <h2 className="font-semibold text-kumo-strong">How it joins your thread</h2>
              <ThreadStepper
                className="mt-5"
                steps={[
                  { label: "Vacancy", state: "active" },
                  { label: "Applied", state: "todo" },
                  { label: "Interview", state: "todo" },
                  { label: "Offer", state: "todo" },
                ]}
              />
              <p className="mt-5 text-sm leading-relaxed text-kumo-subtle">
                Start with the role. Add the rest as your story moves forward.
              </p>
            </CardContent>
          </Card>
          <Card className="bg-primary-subtle/40 shadow-none">
            <CardContent className="flex gap-3 p-4">
              <Info className="mt-0.5 size-4 shrink-0 text-primary" />
              <p className="text-sm leading-relaxed text-kumo-default">
                Paste the original job URL so Niti can keep the source attached.
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
