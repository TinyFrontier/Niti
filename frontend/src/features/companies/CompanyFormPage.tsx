import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createCompany,
  getCompany,
  updateCompany,
  type CompanyPayload,
} from "@/features/companies/api";
import { PageHeader } from "@/shared/layout/PageHeader";
import { ApiError } from "@/shared/api/client";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select } from "@/shared/ui/select";
import { Skeleton } from "@/shared/ui/skeleton";
import { Textarea } from "@/shared/ui/textarea";

const schema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  website: z.string().max(500).optional(),
  industry: z.string().max(255).optional(),
  location: z.string().max(255).optional(),
  size: z.string().max(50).optional(),
  description: z.string().optional(),
  rating: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function CompanyFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);

  const { data: existing, isLoading: loadingExisting } = useQuery({
    queryKey: ["companies", id],
    queryFn: () => getCompany(id!),
    enabled: isEdit,
  });

  const {
    register: field,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: existing
      ? {
          name: existing.name,
          website: existing.website ?? "",
          industry: existing.industry ?? "",
          location: existing.location ?? "",
          size: existing.size ?? "",
          description: existing.description ?? "",
          rating: existing.rating?.toString() ?? "",
        }
      : { name: "" },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload: CompanyPayload = {
        name: values.name,
        website: values.website?.trim() || undefined,
        industry: values.industry?.trim() || undefined,
        location: values.location?.trim() || undefined,
        size: values.size?.trim() || undefined,
        description: values.description?.trim() || undefined,
        rating: values.rating ? Number(values.rating) : null,
      };
      return isEdit ? updateCompany(id!, payload) : createCompany(payload);
    },
    onSuccess: (company) => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      navigate(`/companies/${company.id}`);
    },
    onError: (error) => {
      setServerError(error instanceof ApiError ? error.detail : "Something went wrong");
    },
  });

  if (isEdit && loadingExisting) {
    return <Skeleton className="h-64 w-full max-w-xl" />;
  }

  return (
    <div className="max-w-xl">
      <PageHeader title={isEdit ? "Edit company" : "Add company"} />
      <Card>
        <CardContent className="p-5">
          <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Name *</Label>
              <Input placeholder="Acme Corp" {...field("name")} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label>Website</Label>
                <Input placeholder="https://acme.com" {...field("website")} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Industry</Label>
                <Input placeholder="Fintech" {...field("industry")} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <Label>Location</Label>
                <Input placeholder="Berlin" {...field("location")} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Size</Label>
                <Input placeholder="50-200" {...field("size")} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Interest (1-5)</Label>
                <Select {...field("rating")}>
                  <option value="">Not rated</option>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Notes / description</Label>
              <Textarea rows={4} {...field("description")} />
            </div>
            {serverError && <p className="text-sm text-destructive">{serverError}</p>}
            <div className="flex items-center gap-2">
              <Button type="submit" disabled={isSubmitting || mutation.isPending}>
                {isEdit ? "Save changes" : "Create company"}
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
