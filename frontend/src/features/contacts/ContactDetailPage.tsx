import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ExternalLink,
  MessageSquare,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import {
  COMM_CHANNELS,
  COMM_DIRECTIONS,
  createCommunication,
  deleteCommunication,
  deleteContact,
  getContact,
  listCommunications,
  type CommunicationLog,
} from "@/features/contacts/api";
import { ContactStatusBadge, ContactTypeBadge } from "@/features/contacts/badges";
import { NotesCard } from "@/features/notes/NotesCard";
import { PageHeader } from "@/shared/layout/PageHeader";
import { humanize } from "@/shared/lib/format";
import { ApiError } from "@/shared/api/client";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { EmptyState } from "@/shared/ui/empty-state";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select } from "@/shared/ui/select";
import { Skeleton } from "@/shared/ui/skeleton";
import { Textarea } from "@/shared/ui/textarea";

const commSchema = z.object({
  channel: z.enum(COMM_CHANNELS),
  direction: z.enum(COMM_DIRECTIONS),
  subject: z.string().max(500).optional(),
  body: z.string().optional(),
  occurred_at: z.string().min(1, "Date is required"),
  next_follow_up_at: z.string().optional(),
});

type CommFormValues = z.infer<typeof commSchema>;

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium">{children}</span>
    </div>
  );
}

function CommunicationItem({
  log,
  onDelete,
}: {
  log: CommunicationLog;
  onDelete: () => void;
}) {
  const Icon = log.direction === "outbound" ? ArrowUpRight : ArrowDownLeft;
  return (
    <li className="flex items-start gap-3 py-3">
      <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted">
        <Icon className="size-3.5 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm">
          <span className="font-medium">{humanize(log.channel)}</span>
          <span className="text-muted-foreground">
            {" "}
            · {log.direction} · {format(new Date(log.occurred_at), "d MMM yyyy, HH:mm")}
          </span>
        </p>
        {log.subject && <p className="text-sm">{log.subject}</p>}
        {log.body && (
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{log.body}</p>
        )}
        {log.next_follow_up_at && (
          <p className="mt-1 text-xs font-medium text-amber-600">
            Follow up by {format(new Date(log.next_follow_up_at), "d MMM yyyy")}
          </p>
        )}
      </div>
      <Button variant="ghost" size="icon" title="Delete" onClick={onDelete}>
        <Trash2 className="size-3.5 text-muted-foreground" />
      </Button>
    </li>
  );
}

export function ContactDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showCommForm, setShowCommForm] = useState(false);
  const [commError, setCommError] = useState<string | null>(null);

  const { data: contact, isLoading } = useQuery({
    queryKey: ["contacts", id],
    queryFn: () => getContact(id!),
  });
  const { data: communications } = useQuery({
    queryKey: ["communications", id],
    queryFn: () => listCommunications(id!),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteContact(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      navigate("/contacts");
    },
  });

  const {
    register: field,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CommFormValues>({
    resolver: zodResolver(commSchema),
    defaultValues: {
      channel: "email",
      direction: "outbound",
      occurred_at: new Date().toISOString().slice(0, 16),
    },
  });

  const commMutation = useMutation({
    mutationFn: (values: CommFormValues) =>
      createCommunication(id!, {
        channel: values.channel,
        direction: values.direction,
        subject: values.subject?.trim() || undefined,
        body: values.body?.trim() || undefined,
        occurred_at: new Date(values.occurred_at).toISOString(),
        next_follow_up_at: values.next_follow_up_at
          ? new Date(values.next_follow_up_at).toISOString()
          : null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["communications", id] });
      reset();
      setShowCommForm(false);
      setCommError(null);
    },
    onError: (error) => {
      setCommError(error instanceof ApiError ? error.detail : "Failed to log communication");
    },
  });

  const deleteCommMutation = useMutation({
    mutationFn: (communicationId: string) => deleteCommunication(id!, communicationId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["communications", id] }),
  });

  if (isLoading || !contact) {
    return <Skeleton className="h-64 w-full" />;
  }

  return (
    <div>
      <PageHeader
        title={`${contact.first_name} ${contact.last_name ?? ""}`.trim()}
        description={contact.position ?? undefined}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => navigate(`/contacts/${id}/edit`)}>
              <Pencil /> Edit
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (window.confirm("Delete this contact?")) deleteMutation.mutate();
              }}
            >
              <Trash2 /> Delete
            </Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border">
            <InfoRow label="Type">
              <ContactTypeBadge type={contact.contact_type} />
            </InfoRow>
            <InfoRow label="Status">
              <ContactStatusBadge status={contact.status} />
            </InfoRow>
            <InfoRow label="Company">
              {contact.company ? (
                <Link to={`/companies/${contact.company.id}`} className="text-primary hover:underline">
                  {contact.company.name}
                </Link>
              ) : (
                "—"
              )}
            </InfoRow>
            <InfoRow label="Email">
              {contact.email ? (
                <a href={`mailto:${contact.email}`} className="text-primary hover:underline">
                  {contact.email}
                </a>
              ) : (
                "—"
              )}
            </InfoRow>
            <InfoRow label="Phone">{contact.phone ?? "—"}</InfoRow>
            <InfoRow label="Telegram">{contact.telegram ?? "—"}</InfoRow>
            <InfoRow label="LinkedIn">
              {contact.linkedin_url ? (
                <a
                  href={contact.linkedin_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  Profile <ExternalLink className="size-3.5" />
                </a>
              ) : (
                "—"
              )}
            </InfoRow>
            <InfoRow label="Added">{format(new Date(contact.created_at), "d MMM yyyy")}</InfoRow>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Communication log</CardTitle>
            <Button variant="outline" size="sm" onClick={() => setShowCommForm(!showCommForm)}>
              <Plus /> Log communication
            </Button>
          </CardHeader>
          <CardContent>
            {showCommForm && (
              <form
                onSubmit={handleSubmit((v) => commMutation.mutate(v))}
                className="mb-4 flex flex-col gap-3 rounded-xl border border-border bg-muted/30 p-4"
              >
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="flex flex-col gap-1.5">
                    <Label>Channel</Label>
                    <Select {...field("channel")}>
                      {COMM_CHANNELS.map((c) => (
                        <option key={c} value={c}>
                          {humanize(c)}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>Direction</Label>
                    <Select {...field("direction")}>
                      {COMM_DIRECTIONS.map((d) => (
                        <option key={d} value={d}>
                          {humanize(d)}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>When</Label>
                    <Input type="datetime-local" {...field("occurred_at")} />
                    {errors.occurred_at && (
                      <p className="text-xs text-destructive">{errors.occurred_at.message}</p>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Subject</Label>
                  <Input placeholder="Follow-up on the Python role" {...field("subject")} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Details</Label>
                  <Textarea rows={3} {...field("body")} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Next follow-up (optional)</Label>
                  <Input type="date" {...field("next_follow_up_at")} />
                </div>
                {commError && <p className="text-sm text-destructive">{commError}</p>}
                <div className="flex items-center gap-2">
                  <Button type="submit" size="sm" disabled={commMutation.isPending}>
                    Save
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowCommForm(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            )}
            {communications && communications.length > 0 ? (
              <ul className="divide-y divide-border">
                {communications.map((log) => (
                  <CommunicationItem
                    key={log.id}
                    log={log}
                    onDelete={() => {
                      if (window.confirm("Delete this communication entry?"))
                        deleteCommMutation.mutate(log.id);
                    }}
                  />
                ))}
              </ul>
            ) : (
              !showCommForm && (
                <EmptyState
                  icon={MessageSquare}
                  title="No communication yet"
                  description="Log emails, calls and messages to keep the history in one place."
                />
              )
            )}
          </CardContent>
        </Card>
      </div>

      <NotesCard entityType="contact" entityId={contact.id} className="mt-4" />
    </div>
  );
}
