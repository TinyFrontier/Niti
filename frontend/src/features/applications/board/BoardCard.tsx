import { Link, useNavigate } from "react-router-dom";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { DropdownMenu } from "@cloudflare/kumo/components/dropdown";
import { differenceInCalendarDays } from "date-fns";
import { CalendarPlus, ListTodo, MoreHorizontal, ThumbsDown, Trophy } from "lucide-react";
import {
  APPLICATION_STATUSES,
  type Application,
  type ApplicationStatus,
} from "@/features/applications/api";
import { StatusBadge } from "@/features/applications/StatusBadge";
import { humanize } from "@/shared/lib/format";
import { Button } from "@/shared/ui/button";

function daysInStatusLabel(application: Application): string {
  const since = application.updated_at ?? application.created_at;
  const days = differenceInCalendarDays(new Date(), new Date(since));
  if (days <= 0) return "Updated today";
  return `${days}d in stage`;
}

interface BoardCardMenuProps {
  application: Application;
  onStatusChange: (status: ApplicationStatus) => void;
}

function BoardCardMenu({ application, onStatusChange }: BoardCardMenuProps) {
  const navigate = useNavigate();

  return (
    <DropdownMenu>
      <DropdownMenu.Trigger>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Actions for ${application.vacancy.title}`}
          className="-mr-1 -mt-1 shrink-0 text-kumo-subtle"
        >
          <MoreHorizontal />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end">
        <DropdownMenu.Sub>
          <DropdownMenu.SubTrigger>Change status</DropdownMenu.SubTrigger>
          <DropdownMenu.SubContent>
            {APPLICATION_STATUSES.map((status) => (
              <DropdownMenu.Item
                key={status}
                selected={status === application.status}
                disabled={status === application.status}
                onClick={() => onStatusChange(status)}
              >
                {humanize(status)}
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.SubContent>
        </DropdownMenu.Sub>
        <DropdownMenu.Separator />
        <DropdownMenu.Item
          icon={<CalendarPlus />}
          onClick={() => navigate(`/interviews/new?application_id=${application.id}`)}
        >
          Add interview
        </DropdownMenu.Item>
        <DropdownMenu.Item icon={<ListTodo />} onClick={() => navigate("/tasks")}>
          Add task
        </DropdownMenu.Item>
        <DropdownMenu.Separator />
        <DropdownMenu.Item
          icon={<Trophy />}
          disabled={application.status === "offer"}
          onClick={() => onStatusChange("offer")}
        >
          Mark offer
        </DropdownMenu.Item>
        <DropdownMenu.Item
          icon={<ThumbsDown />}
          variant="danger"
          disabled={application.status === "rejected"}
          onClick={() => onStatusChange("rejected")}
        >
          Mark rejected
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}

interface BoardCardContentProps {
  application: Application;
  onStatusChange?: (status: ApplicationStatus) => void;
}

/** Static card body — reused by the drag overlay without draggable wiring. */
export function BoardCardContent({ application, onStatusChange }: BoardCardContentProps) {
  return (
    <div className="rounded-lg border border-kumo-hairline bg-kumo-base p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <Link
          to={`/applications/${application.id}`}
          className="min-w-0 text-sm font-medium leading-snug text-kumo-strong hover:underline"
        >
          {application.vacancy.title}
        </Link>
        {onStatusChange && (
          <BoardCardMenu application={application} onStatusChange={onStatusChange} />
        )}
      </div>
      <p className="mt-0.5 truncate text-xs text-kumo-subtle">
        {application.vacancy.company?.name ?? "No company"}
      </p>
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <StatusBadge status={application.status} />
        <span className="shrink-0 text-xs text-muted-foreground">
          {daysInStatusLabel(application)}
        </span>
      </div>
    </div>
  );
}

interface BoardCardProps {
  application: Application;
  onStatusChange: (status: ApplicationStatus) => void;
}

export function BoardCard({ application, onStatusChange }: BoardCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: application.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={isDragging ? "opacity-40" : undefined}
      {...listeners}
      {...attributes}
    >
      <BoardCardContent application={application} onStatusChange={onStatusChange} />
    </div>
  );
}
