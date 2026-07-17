import { Badge, type BadgeProps } from "@/shared/ui/badge";
import { humanize } from "@/shared/lib/format";
import type { ContactStatus, ContactType } from "@/features/contacts/api";

const STATUS_VARIANTS: Record<ContactStatus, BadgeProps["variant"]> = {
  new: "muted",
  contacted: "default",
  responded: "default",
  active_conversation: "success",
  follow_up_needed: "warning",
  not_relevant: "muted",
  archived: "muted",
};

export function ContactStatusBadge({ status }: { status: ContactStatus }) {
  return <Badge variant={STATUS_VARIANTS[status] ?? "muted"}>{humanize(status)}</Badge>;
}

export function ContactTypeBadge({ type }: { type: ContactType }) {
  return <Badge variant="muted">{humanize(type)}</Badge>;
}
