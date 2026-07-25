import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createVacancy,
  getVacancy,
  updateVacancy,
  type VacancyPayload,
} from "@/features/vacancies/api";
import { VacancyForm, type VacancyFormValues } from "@/features/vacancies/VacancyForm";
import { PageHeader } from "@/shared/layout/PageHeader";
import { ApiError } from "@/shared/api/client";
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
    return <Skeleton className="h-64 w-full max-w-2xl" />;
  }

  return (
    <div className="max-w-2xl">
      <PageHeader title={isEdit ? "Edit vacancy" : "Add vacancy"} />
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
  );
}
