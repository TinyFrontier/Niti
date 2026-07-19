import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listApplications } from "@/features/applications/api";
import { createInterview, INTERVIEW_FORMATS } from "@/features/interviews/api";
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
  application_id: z.string().min(1, "Choose an application"),
  scheduled_at: z.string().min(1, "Date and time are required"),
  duration_minutes: z.string().optional(),
  format: z.enum(INTERVIEW_FORMATS),
  location_or_link: z.string().max(500).optional(),
  participants: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function InterviewFormPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [serverError, setServerError] = useState<string | null>(null);

  const { data: applications } = useQuery({
    queryKey: ["applications", { forSelect: true }],
    queryFn: () => listApplications({ page_size: 100 }),
  });

  const {
    register: field,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      application_id: searchParams.get("application_id") ?? "",
      format: "video",
    },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      createInterview({
        application_id: values.application_id,
        scheduled_at: new Date(values.scheduled_at).toISOString(),
        duration_minutes: values.duration_minutes ? Number(values.duration_minutes) : null,
        format: values.format,
        location_or_link: values.location_or_link?.trim() || null,
        participants: values.participants?.trim() || null,
        notes: values.notes?.trim() || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["interviews"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
      navigate("/interviews");
    },
    onError: (error) => {
      setServerError(error instanceof ApiError ? error.detail : "Something went wrong");
    },
  });

  return (
    <div className="max-w-2xl">
      <PageHeader title="Schedule interview" />
      <Card>
        <CardContent className="p-5">
          <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Application *</Label>
              <Controller
                name="application_id"
                control={control}
                render={({ field: selectField }) => (
                  <Select {...selectField}>
                    <option value="">Select an application...</option>
                    {applications?.items.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.vacancy.title}
                        {a.vacancy.company ? ` — ${a.vacancy.company.name}` : ""}
                      </option>
                    ))}
                  </Select>
                )}
              />
              {errors.application_id && (
                <p className="text-xs text-destructive">{errors.application_id.message}</p>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <Label>When *</Label>
                <Input type="datetime-local" {...field("scheduled_at")} />
                {errors.scheduled_at && (
                  <p className="text-xs text-destructive">{errors.scheduled_at.message}</p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Duration (min)</Label>
                <Input type="number" placeholder="60" {...field("duration_minutes")} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Format</Label>
                <Controller
                  name="format"
                  control={control}
                  render={({ field: selectField }) => (
                    <Select {...selectField}>
                      {INTERVIEW_FORMATS.map((f) => (
                        <option key={f} value={f}>
                          {humanize(f)}
                        </option>
                      ))}
                    </Select>
                  )}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Location or link</Label>
              <Input placeholder="https://meet.google.com/..." {...field("location_or_link")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Participants</Label>
              <Input placeholder="Jane Doe (recruiter), Max Weber (EM)" {...field("participants")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Prep notes</Label>
              <Textarea rows={3} {...field("notes")} />
            </div>
            {serverError && <p className="text-sm text-destructive">{serverError}</p>}
            <div className="flex items-center gap-2">
              <Button type="submit" disabled={isSubmitting || mutation.isPending}>
                Schedule
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
