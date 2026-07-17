import { Construction } from "lucide-react";
import { PageHeader } from "@/shared/layout/PageHeader";
import { EmptyState } from "@/shared/ui/empty-state";

export function PlaceholderPage({ title }: { title: string }) {
  return (
    <div>
      <PageHeader title={title} />
      <EmptyState
        icon={Construction}
        title="Coming soon"
        description="This screen will be implemented in an upcoming build step."
      />
    </div>
  );
}
