import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  rectIntersection,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Send } from "lucide-react";
import {
  listApplications,
  type Application,
  type ApplicationStatus,
} from "@/features/applications/api";
import { BoardCard, BoardCardContent } from "@/features/applications/board/BoardCard";
import { COLUMNS, columnForStatus, type BoardColumn } from "@/features/applications/board/columns";
import { useStatusMutation } from "@/features/applications/board/useStatusMutation";
import { humanize } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { EmptyState } from "@/shared/ui/empty-state";
import { Skeleton } from "@/shared/ui/skeleton";

// Backend PageParams caps page_size at 100, so the board accumulates pages.
const BOARD_PAGE_SIZE = 100;
const BOARD_MAX_PAGES = 10;

interface BoardData {
  items: Application[];
  total: number;
}

async function fetchBoardApplications(): Promise<BoardData> {
  const items: Application[] = [];
  let total = 0;
  for (let page = 1; page <= BOARD_MAX_PAGES; page += 1) {
    const result = await listApplications({ page, page_size: BOARD_PAGE_SIZE });
    items.push(...result.items);
    total = result.total;
    if (items.length >= total || result.items.length === 0) break;
  }
  return { items, total };
}

interface PendingDrop {
  application: Application;
  column: BoardColumn;
}

interface StatusPickerProps {
  pending: PendingDrop;
  onPick: (status: ApplicationStatus) => void;
  onCancel: () => void;
}

/**
 * Small confirmation panel shown when a card is dropped on a column that
 * groups several statuses. Defaults focus to the column's first status.
 */
function StatusPicker({ pending, onPick, onCancel }: StatusPickerProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    panelRef.current?.querySelector("button")?.focus();
    return () => previouslyFocused?.focus();
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Cancel status change"
        className="absolute inset-0 bg-foreground/20"
        onClick={onCancel}
        tabIndex={-1}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Choose a status in ${pending.column.title}`}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            onCancel();
            return;
          }
          // Minimal focus trap: keep Tab cycling within the dialog's buttons.
          if (e.key === "Tab") {
            const buttons = panelRef.current?.querySelectorAll<HTMLButtonElement>(
              "button:not([disabled])",
            );
            if (!buttons || buttons.length === 0) return;
            const first = buttons[0];
            const last = buttons[buttons.length - 1];
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first.focus();
            }
          }
        }}
        className="relative w-64 rounded-xl border border-kumo-hairline bg-kumo-base p-4 shadow-lg"
      >
        <p className="text-sm font-medium text-kumo-strong">
          Move to {pending.column.title}
        </p>
        <p className="mt-0.5 truncate text-xs text-kumo-subtle">
          {pending.application.vacancy.title}
        </p>
        <div className="mt-3 flex flex-col gap-1.5">
          {pending.column.statuses.map((status) => (
            <Button
              key={status}
              variant="outline"
              size="sm"
              className="justify-start"
              onClick={() => onPick(status)}
            >
              {humanize(status)}
            </Button>
          ))}
        </div>
        <Button variant="ghost" size="sm" className="mt-2 w-full" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

interface BoardColumnViewProps {
  column: BoardColumn;
  applications: Application[];
  onStatusChange: (application: Application, status: ApplicationStatus) => void;
}

function BoardColumnView({ column, applications, onStatusChange }: BoardColumnViewProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <section
      ref={setNodeRef}
      aria-label={`${column.title} column, ${applications.length} applications`}
      className={cn(
        "flex max-h-[calc(100vh-16rem)] w-72 shrink-0 snap-start flex-col rounded-xl border bg-kumo-recessed transition-colors",
        isOver ? "border-primary bg-primary-subtle" : "border-kumo-hairline",
      )}
    >
      <header className="flex items-center justify-between gap-2 px-3 pb-1 pt-3">
        <h2 className="text-sm font-semibold text-kumo-strong">{column.title}</h2>
        <span className="rounded-full bg-kumo-tint px-2 py-0.5 text-xs font-medium text-kumo-subtle">
          {applications.length}
        </span>
      </header>
      <div className="flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto p-2">
        {applications.map((application) => (
          <BoardCard
            key={application.id}
            application={application}
            onStatusChange={(status) => onStatusChange(application, status)}
          />
        ))}
        {applications.length === 0 && (
          <p className="px-2 py-4 text-center text-xs text-muted-foreground">
            Drop a card here
          </p>
        )}
      </div>
    </section>
  );
}

export function ApplicationsBoard() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pendingDrop, setPendingDrop] = useState<PendingDrop | null>(null);
  const statusMutation = useStatusMutation();

  const { data, isLoading } = useQuery({
    queryKey: ["applications", "board"],
    queryFn: fetchBoardApplications,
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const applications = data?.items ?? [];
  const activeApplication = applications.find((a) => a.id === activeId) ?? null;

  const changeStatus = (application: Application, status: ApplicationStatus) => {
    if (application.status === status) return;
    statusMutation.mutate({ id: application.id, status });
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    const application = applications.find((a) => a.id === String(active.id));
    const column = COLUMNS.find((c) => c.id === String(over.id));
    if (!application || !column) return;

    if (column.statuses.length === 1) {
      changeStatus(application, column.statuses[0]);
      return;
    }
    // Multi-status column: let the user pick the exact status.
    if (columnForStatus(application.status).id === column.id) return;
    setPendingDrop({ application, column });
  };

  if (isLoading) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map((column) => (
          <div
            key={column.id}
            className="flex w-72 shrink-0 flex-col gap-2 rounded-xl border border-kumo-hairline bg-kumo-recessed p-3"
          >
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (applications.length === 0) {
    return (
      <EmptyState
        icon={Send}
        title="No applications yet"
        description="Create an application when you apply to a vacancy."
        action={
          <Button variant="outline" size="sm" className="mt-1">
            <Link to="/applications/new">New application</Link>
          </Button>
        }
      />
    );
  }

  const truncated = (data?.total ?? 0) > applications.length;

  return (
    <>
      {truncated && (
        <p className="mb-3 text-xs text-muted-foreground" role="status">
          Showing the first {applications.length} of {data?.total} applications. Use the table
          view to browse the rest.
        </p>
      )}
      <DndContext
        sensors={sensors}
        collisionDetection={rectIntersection}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 md:snap-none">
          {COLUMNS.map((column) => (
            <BoardColumnView
              key={column.id}
              column={column}
              applications={applications.filter(
                (a) => columnForStatus(a.status).id === column.id,
              )}
              onStatusChange={changeStatus}
            />
          ))}
        </div>
        <DragOverlay>
          {activeApplication ? (
            <div className="rotate-2">
              <BoardCardContent application={activeApplication} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
      {pendingDrop && (
        <StatusPicker
          pending={pendingDrop}
          onPick={(status) => {
            changeStatus(pendingDrop.application, status);
            setPendingDrop(null);
          }}
          onCancel={() => setPendingDrop(null)}
        />
      )}
    </>
  );
}
