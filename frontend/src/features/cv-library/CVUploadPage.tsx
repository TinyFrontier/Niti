import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { uploadCVVersion } from "@/features/cv-library/api";
import { PageHeader } from "@/shared/layout/PageHeader";
import { ApiError } from "@/shared/api/client";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const schema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  language: z.string().max(16).optional(),
  specialization: z.string().max(255).optional(),
  notes: z.string().optional(),
  file: z
    .instanceof(FileList)
    .refine((files) => files.length === 1, "Choose a file")
    .refine(
      (files) => files.length === 0 || /\.(pdf|doc|docx)$/i.test(files[0].name),
      "Only pdf, doc or docx",
    )
    .refine(
      (files) => files.length === 0 || files[0].size <= MAX_FILE_SIZE,
      "File must be under 10MB",
    ),
});

type FormValues = z.infer<typeof schema>;

export function CVUploadPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register: field,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      uploadCVVersion({
        file: values.file[0],
        title: values.title,
        language: values.language?.trim() || undefined,
        specialization: values.specialization?.trim() || undefined,
        notes: values.notes?.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cv-versions"] });
      navigate("/cv-library");
    },
    onError: (error) => {
      setServerError(error instanceof ApiError ? error.detail : "Upload failed");
    },
  });

  return (
    <div className="max-w-xl">
      <PageHeader title="Upload CV" description="pdf, doc or docx, up to 10MB" />
      <Card>
        <CardContent className="p-5">
          <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>File *</Label>
              <Input type="file" accept=".pdf,.doc,.docx" {...field("file")} />
              {errors.file && <p className="text-xs text-destructive">{errors.file.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Title *</Label>
              <Input placeholder="Python Backend CV" {...field("title")} />
              {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label>Language</Label>
                <Input placeholder="en / ru / de" {...field("language")} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Specialization</Label>
                <Input placeholder="Backend / Frontend / Data" {...field("specialization")} />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Notes</Label>
              <Textarea rows={3} placeholder="What is different in this version..." {...field("notes")} />
            </div>
            {serverError && <p className="text-sm text-destructive">{serverError}</p>}
            <div className="flex items-center gap-2">
              <Button type="submit" disabled={isSubmitting || mutation.isPending}>
                {mutation.isPending ? "Uploading..." : "Upload"}
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
