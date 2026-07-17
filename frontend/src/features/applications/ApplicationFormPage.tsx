import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { APPLICATION_STATUSES, createApplication } from "@/features/applications/api";
import { listCVVersions } from "@/features/cv-library/api";
import { listVacancies } from "@/features/vacancies/api";
import { PageHeader } from "@/shared/layout/PageHeader";
import { humanize } from "@/shared/lib/format";
import { ApiError } from "@/shared/api/client";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select } from "@/shared/ui/select";
import { Textarea } from "@/shared/ui/textarea";

const schema = z.object({
  vacancy_id: z.string().min(1, "Choose a vacancy"),
  cv_version_id: z.string().optional(),
  status: z.enum(APPLICATION_STATUSES),
  applied_at: z.string().optional(),
  source: z.string().max(50).optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function ApplicationFormPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [serverError, setServerError] = useState<string | null>(null);

  const { data: vacancies } = useQuery({
    queryKey: ["vacancies", { forSelect: true }],
    queryFn: () => listVacancies({ page_size: 100 }),
  });
  const { data: cvVersions } = useQuery({
    queryKey: ["cv-versions", { forSelect: true }],
    queryFn: () => listCVVersions({ page_size: 100 }),
  });

  const {
    register: field,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      vacancy_id: searchParams.get("vacancy_id") ?? "",
      status: "applied",
      applied_at: new Date().toISOString().slice(0, 10),
    },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      createApplication({
        vacancy_id: values.vacancy_id,
        cv_version_id: values.cv_version_id || null,
        status: values.status,
        applied_at: values.applied_at || null,
        source: values.source?.trim() || null,
        notes: values.notes?.trim() || null,
      }),
    onSuccess: (application) => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      navigate(`/applications/${application.id}`);
    },
    onError: (error) => {
      setServerError(error instanceof ApiError ? error.detail : "Something went wrong");
    },
  });

  return (
    <div className="max-w-2xl">
      <PageHeader title="New application" />
      <Card>
        <CardContent className="p-5">
          <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Vacancy *</Label>
              <Select {...field("vacancy_id")}>
                <option value="">Select a vacancy...</option>
                {vacancies?.items.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.title}
                    {v.company ? ` — ${v.company.name}` : ""}
                  </option>
                ))}
              </Select>
              {errors.vacancy_id && (
                <p className="text-xs text-destructive">{errors.vacancy_id.message}</p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>CV version</Label>
              <Select {...field("cv_version_id")}>
                <option value="">No CV linked</option>
                {cvVersions?.items.map((cv) => (
                  <option key={cv.id} value={cv.id}>
                    {cv.title}
                    {cv.language ? ` (${cv.language})` : ""}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <Label>Status</Label>
                <Select {...field("status")}>
                  {APPLICATION_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {humanize(s)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Applied on</Label>
                <Input type="date" {...field("applied_at")} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Source</Label>
                <Input placeholder="linkedin / hh / referral" {...field("source")} />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Notes</Label>
              <Textarea rows={4} placeholder="Anything worth remembering..." {...field("notes")} />
            </div>
            {serverError && <p className="text-sm text-destructive">{serverError}</p>}
            <div className="flex items-center gap-2">
              <Button type="submit" disabled={isSubmitting || mutation.isPending}>
                Create application
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
