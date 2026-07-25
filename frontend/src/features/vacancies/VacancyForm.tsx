import { useMemo, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Controller, useForm, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { checkDuplicates, JOB_TYPES, WORK_FORMATS } from "@/features/vacancies/api";
import { useDebouncedValue } from "@/shared/hooks/useDebouncedValue";
import { humanize } from "@/shared/lib/format";
import { Alert } from "@/shared/ui/alert";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { FormField } from "@/shared/ui/form-field";
import { Input } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";
import { Textarea } from "@/shared/ui/textarea";

export const vacancySchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  company_name: z.string().max(255).optional(),
  url: z.string().max(1000).optional(),
  location: z.string().max(255).optional(),
  salary: z.string().max(255).optional(),
  work_format: z.enum(WORK_FORMATS),
  job_type: z.enum(JOB_TYPES),
  description: z.string().optional(),
});

export type VacancyFormValues = z.infer<typeof vacancySchema>;

interface VacancyFormProps {
  initialValues?: Partial<VacancyFormValues>;
  onSubmit: (values: VacancyFormValues) => void;
  submitLabel: string;
  /** Replace the default submit/cancel action bar (e.g. for import flows). */
  renderActions?: (form: UseFormReturn<VacancyFormValues>) => ReactNode;
  disabled?: boolean;
  /** Vacancy id to exclude from the debounced duplicate check (edit mode). */
  excludeId?: string;
  serverError?: string | null;
  submitting?: boolean;
  /** Set to false when duplicates are surfaced by the caller already. */
  showDuplicateCheck?: boolean;
}

export function VacancyForm({
  initialValues,
  onSubmit,
  submitLabel,
  renderActions,
  disabled,
  excludeId,
  serverError,
  submitting,
  showDuplicateCheck = true,
}: VacancyFormProps) {
  const navigate = useNavigate();

  const form = useForm<VacancyFormValues>({
    resolver: zodResolver(vacancySchema),
    values: {
      title: initialValues?.title ?? "",
      company_name: initialValues?.company_name ?? "",
      url: initialValues?.url ?? "",
      location: initialValues?.location ?? "",
      salary: initialValues?.salary ?? "",
      work_format: initialValues?.work_format ?? "unknown",
      job_type: initialValues?.job_type ?? "unknown",
      description: initialValues?.description ?? "",
    },
  });
  const {
    register: field,
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = form;

  const title = useDebouncedValue(watch("title"), 500);
  const companyName = useDebouncedValue(watch("company_name") ?? "", 500);
  const url = useDebouncedValue(watch("url") ?? "", 500);

  const duplicateInput = useMemo(
    () => ({
      title: title?.trim() ?? "",
      company_name: companyName.trim() || undefined,
      url: url.trim() || undefined,
      exclude_id: excludeId,
    }),
    [title, companyName, url, excludeId],
  );
  const { data: duplicates } = useQuery({
    queryKey: ["vacancy-duplicates", duplicateInput],
    queryFn: () => checkDuplicates(duplicateInput),
    enabled: showDuplicateCheck && duplicateInput.title.length >= 3,
  });

  const candidates = (showDuplicateCheck && duplicates?.candidates) || [];

  return (
    <>
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
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <fieldset disabled={disabled} className="flex flex-col gap-4">
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
                <Textarea
                  rows={5}
                  placeholder="Paste the job description..."
                  {...field("description")}
                />
              </FormField>
            </fieldset>
            {serverError && <p className="text-sm text-destructive">{serverError}</p>}
            {renderActions ? (
              renderActions(form)
            ) : (
              <div className="flex items-center gap-2">
                <Button type="submit" disabled={isSubmitting || submitting}>
                  {submitLabel}
                </Button>
                <Button type="button" variant="ghost" onClick={() => navigate(-1)}>
                  Cancel
                </Button>
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </>
  );
}
