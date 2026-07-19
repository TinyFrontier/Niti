import type { LucideIcon } from "lucide-react";
import { Empty } from "@cloudflare/kumo/components/empty";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <Empty
      size="sm"
      icon={<Icon className="size-6" />}
      title={title}
      description={description}
      contents={action}
      className="rounded-lg border border-dashed border-kumo-line bg-kumo-recessed/40"
    />
  );
}
