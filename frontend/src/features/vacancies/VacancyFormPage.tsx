import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import {
  checkDuplicates,
  createVacancy,
  getVacancy,
  JOB_TYPES,
  updateVacancy,
  WORK_FORMATS,
  type VacancyPayload,
} from "@/features/vacancies/api";
import { useDebouncedValue } from "@/shared/hooks/useDebouncedValue";
import { PageHeader } from "@/shared/layout/PageHeader";
import { humanize } from "@/shared/lib/format";
import { ApiError } from "@/shared/api/client";
import { Alert } from "@/shared/ui/alert";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { FormField } from "@/shared/ui/form-field";
import { Input } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";
import { Skeleton } from "@/shared/ui/skeleton";
import { Textarea } from "@/shared/ui/textarea";

const schema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  company_name: z.string().max(255).optional(),
  url: z.string().max(1000).optional(),
  location: z.string().max(255).optional(),
  salary: z.string().max(255).optional(),
  work_format: z.enum(WORK_FORMATS),
  job_type: z.enum(JOB_TYPES),
  description: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

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

  const {
    register: field,
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: existing
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
      : { title: "", work_format: "unknown", job_type: "unknown" },
  });

  const title = useDebouncedValue(watch("title"), 500);
  const companyName = useDebouncedValue(watch("company_name") ?? "", 500);
  const url = useDebouncedValue(watch("url") ?? "", 500);

  const duplicateInput = useMemo(
    () => ({
      title: title?.trim() ?? "",
      company_name: companyName.trim() || undefined,
      url: url.trim() || undefined,
      exclude_id: id,
    }),
    [title, companyName, url, id],
  );
  const { data: duplicates } = useQuery({
    queryKey: ["vacancy-duplicates", duplicateInput],
    queryFn: () => checkDuplicates(duplicateInput),
    enabled: duplicateInput.title.length >= 3,
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
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

  const candidates = duplicates?.candidates ?? [];

  return (
    <div className="max-w-2xl">
      <PageHeader title={isEdit ? "Edit vacancy" : "Add vacancy"} />
      {candidates.length > 0 && (
        <Alert
          variant="warning"
          icon={<AlertTriangle />}
          title="Possible duplicates"
          className="mb-4"
        >
          <ul className="mt-2 space-y-1">
            {candidates.map((c) => (
              <li key={c.vacancy_id} className="text-sm">
                <Link to={`/vacancies/${c.vacancy_id}`} className="font-medium underline">
                  {c.title}
                </Link>{" "}
                {c.company_name && <>at {c.company_name} </>}
                <span className="opacity-75">
                  ({c.reason === "url_match" ? "same URL" : `${Math.round(c.score * 100)}% match`})
                </span>
              </li>
            ))}
          </ul>
        </Alert>
      )}
      <Card>
        <CardContent className="p-5">
          <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="flex flex-col gap-4">
            <FormField label="Title *" error={errors.title?.message}>
              <Input placeholder="Senior Python Developer" {...field("title")} />
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Company">
                <Input placeholder="Acme Corp" {...field("company_name")} />
              </FormField>
              <FormField label="Location">
                <Input placeholder="Remote / Berlin" {...field("location")} />
              </FormField>
            </div>
            <FormField label="Job URL">
              <Input placeholder="https://..." {...field("url")} />
            </FormField>
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField label="Salary">
                <Input placeholder="4000-6000 EUR" {...field("salary")} />
              </FormField>
              <FormField label="Work format">
                <Controller
                  name="work_format"
                  control={control}
                  render={({ field: selectField }) => (
                    <Select {...selectField}>
                      {WORK_FORMATS.map((f) => (
                        <option key={f} value={f}>
                          {humanize(f)}
                        </option>
                      ))}
                    </Select>
                  )}
                />
              </FormField>
              <FormField label="Job type">
                <Controller
                  name="job_type"
                  control={control}
                  render={({ field: selectField }) => (
                    <Select {...selectField}>
                      {JOB_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {humanize(t)}
                        </option>
                      ))}
                    </Select>
                  )}
                />
              </FormField>
            </div>
            <FormField label="Description">
              <Textarea rows={5} placeholder="Paste the job description..." {...field("description")} />
            </FormField>
            {serverError && <p className="text-sm text-destructive">{serverError}</p>}
            <div className="flex items-center gap-2">
              <Button type="submit" disabled={isSubmitting || mutation.isPending}>
                {isEdit ? "Save changes" : "Create vacancy"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => navigate(-1)}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
