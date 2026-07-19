import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listCompanies } from "@/features/companies/api";
import {
  CONTACT_STATUSES,
  CONTACT_TYPES,
  createContact,
  getContact,
  updateContact,
  type ContactPayload,
} from "@/features/contacts/api";
import { PageHeader } from "@/shared/layout/PageHeader";
import { humanize } from "@/shared/lib/format";
import { ApiError } from "@/shared/api/client";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select } from "@/shared/ui/select";
import { Skeleton } from "@/shared/ui/skeleton";

const schema = z.object({
  first_name: z.string().min(1, "First name is required").max(100),
  last_name: z.string().max(100).optional(),
  contact_type: z.enum(CONTACT_TYPES),
  status: z.enum(CONTACT_STATUSES),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().max(50).optional(),
  telegram: z.string().max(100).optional(),
  linkedin_url: z.string().max(500).optional(),
  position: z.string().max(255).optional(),
  company_id: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

function Field({
  label,
  children,
  error,
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function ContactFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);

  const { data: existing, isLoading: loadingExisting } = useQuery({
    queryKey: ["contacts", id],
    queryFn: () => getContact(id!),
    enabled: isEdit,
  });
  const { data: companies } = useQuery({
    queryKey: ["companies", { forSelect: true }],
    queryFn: () => listCompanies({ page_size: 100 }),
  });

  const {
    register: field,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: existing
      ? {
          first_name: existing.first_name,
          last_name: existing.last_name ?? "",
          contact_type: existing.contact_type,
          status: existing.status,
          email: existing.email ?? "",
          phone: existing.phone ?? "",
          telegram: existing.telegram ?? "",
          linkedin_url: existing.linkedin_url ?? "",
          position: existing.position ?? "",
          company_id: existing.company?.id ?? "",
        }
      : { first_name: "", contact_type: "recruiter", status: "new" },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload: ContactPayload = {
        first_name: values.first_name,
        last_name: values.last_name?.trim() || undefined,
        contact_type: values.contact_type,
        status: values.status,
        email: values.email?.trim() || null,
        phone: values.phone?.trim() || undefined,
        telegram: values.telegram?.trim() || undefined,
        linkedin_url: values.linkedin_url?.trim() || undefined,
        position: values.position?.trim() || undefined,
        company_id: values.company_id || null,
      };
      return isEdit ? updateContact(id!, payload) : createContact(payload);
    },
    onSuccess: (contact) => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      navigate(`/contacts/${contact.id}`);
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
      <PageHeader title={isEdit ? "Edit contact" : "Add contact"} />
      <Card>
        <CardContent className="p-5">
          <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="First name *" error={errors.first_name?.message}>
                <Input placeholder="Jane" {...field("first_name")} />
              </Field>
              <Field label="Last name">
                <Input placeholder="Doe" {...field("last_name")} />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Type">
                <Controller
                  name="contact_type"
                  control={control}
                  render={({ field: selectField }) => (
                    <Select {...selectField}>
                      {CONTACT_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {humanize(t)}
                        </option>
                      ))}
                    </Select>
                  )}
                />
              </Field>
              <Field label="Status">
                <Controller
                  name="status"
                  control={control}
                  render={({ field: selectField }) => (
                    <Select {...selectField}>
                      {CONTACT_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {humanize(s)}
                        </option>
                      ))}
                    </Select>
                  )}
                />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Company">
                <Controller
                  name="company_id"
                  control={control}
                  render={({ field: selectField }) => (
                    <Select {...selectField}>
                      <option value="">No company</option>
                      {companies?.items.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </Select>
                  )}
                />
              </Field>
              <Field label="Position">
                <Input placeholder="Tech Recruiter" {...field("position")} />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Email" error={errors.email?.message}>
                <Input placeholder="jane@company.com" {...field("email")} />
              </Field>
              <Field label="Phone">
                <Input placeholder="+49..." {...field("phone")} />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Telegram">
                <Input placeholder="@username" {...field("telegram")} />
              </Field>
              <Field label="LinkedIn">
                <Input placeholder="https://linkedin.com/in/..." {...field("linkedin_url")} />
              </Field>
            </div>
            {serverError && <p className="text-sm text-destructive">{serverError}</p>}
            <div className="flex items-center gap-2">
              <Button type="submit" disabled={isSubmitting || mutation.isPending}>
                {isEdit ? "Save changes" : "Create contact"}
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
