import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, isBefore, startOfToday } from "date-fns";
import { CheckSquare, Plus, Trash2 } from "lucide-react";
import {
  createTask,
  deleteTask,
  listTasks,
  TASK_PRIORITIES,
  TASK_STATUSES,
  updateTask,
  type Task,
  type TaskPriority,
  type TaskStatus,
} from "@/features/tasks/api";
import { PageHeader } from "@/shared/layout/PageHeader";
import { humanize } from "@/shared/lib/format";
import { Badge, type BadgeProps } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { EmptyState } from "@/shared/ui/empty-state";
import { Input } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";
import { Skeleton } from "@/shared/ui/skeleton";
import { cn } from "@/shared/lib/utils";

const PRIORITY_VARIANTS: Record<TaskPriority, BadgeProps["variant"]> = {
  low: "muted",
  medium: "default",
  high: "warning",
  urgent: "destructive",
};

const ENTITY_ROUTES: Record<string, string> = {
  vacancy: "/vacancies",
  application: "/applications",
  company: "/companies",
  contact: "/contacts",
  interview: "/interviews",
};

function TaskRow({ task }: { task: Task }) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
    queryClient.invalidateQueries({ queryKey: ["analytics"] });
  };
  const toggleMutation = useMutation({
    mutationFn: () =>
      updateTask(task.id, { status: task.status === "done" ? "todo" : "done" }),
    onSuccess: invalidate,
  });
  const deleteMutation = useMutation({ mutationFn: () => deleteTask(task.id), onSuccess: invalidate });

  const isDone = task.status === "done";
  const isOverdue =
    !isDone &&
    task.status !== "cancelled" &&
    task.due_date !== null &&
    isBefore(new Date(task.due_date), startOfToday());

  return (
    <li className="flex items-center gap-3 py-2.5">
      <input
        type="checkbox"
        checked={isDone}
        disabled={toggleMutation.isPending}
        onChange={() => toggleMutation.mutate()}
        className="size-4 shrink-0 accent-[var(--primary)]"
      />
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm font-medium", isDone && "text-muted-foreground line-through")}>
          {task.title}
        </p>
        {task.description && (
          <p className="truncate text-xs text-muted-foreground">{task.description}</p>
        )}
      </div>
      {task.entity_type && task.entity_id && (
        <Link
          to={`${ENTITY_ROUTES[task.entity_type]}/${task.entity_id}`}
          className="text-xs text-primary hover:underline"
        >
          {humanize(task.entity_type)}
        </Link>
      )}
      <Badge variant={PRIORITY_VARIANTS[task.priority]}>{humanize(task.priority)}</Badge>
      <span
        className={cn(
          "w-24 text-right text-xs",
          isOverdue ? "font-medium text-destructive" : "text-muted-foreground",
        )}
      >
        {task.due_date ? format(new Date(task.due_date), "d MMM yyyy") : "—"}
      </span>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => {
          if (window.confirm("Delete this task?")) deleteMutation.mutate();
        }}
      >
        <Trash2 className="size-3.5 text-muted-foreground" />
      </Button>
    </li>
  );
}

export function TasksPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<TaskStatus | "">("");
  const [priority, setPriority] = useState<TaskPriority | "">("");
  const [newTitle, setNewTitle] = useState("");
  const [newDue, setNewDue] = useState("");
  const [newPriority, setNewPriority] = useState<TaskPriority>("medium");

  const params = { status: status || undefined, priority: priority || undefined, page_size: 100 };
  const { data, isLoading } = useQuery({
    queryKey: ["tasks", params],
    queryFn: () => listTasks(params),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createTask({
        title: newTitle.trim(),
        due_date: newDue || null,
        priority: newPriority,
      }),
    onSuccess: () => {
      setNewTitle("");
      setNewDue("");
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
    },
  });

  return (
    <div>
      <PageHeader title="Tasks" description="Follow-ups and to-dos" />
      <Card className="mb-4">
        <CardContent className="p-4">
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (newTitle.trim()) createMutation.mutate();
            }}
          >
            <Input
              placeholder="Add a task, e.g. Follow up with Acme recruiter..."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="min-w-64 flex-1"
            />
            <Input
              type="date"
              value={newDue}
              onChange={(e) => setNewDue(e.target.value)}
              className="w-40"
            />
            <Select
              value={newPriority}
              onChange={(e) => setNewPriority(e.target.value as TaskPriority)}
              className="w-28"
            >
              {TASK_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {humanize(p)}
                </option>
              ))}
            </Select>
            <Button type="submit" size="sm" disabled={!newTitle.trim() || createMutation.isPending}>
              <Plus /> Add
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="mb-4 flex items-center gap-2">
        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value as TaskStatus | "")}
          className="w-36"
        >
          <option value="">All statuses</option>
          {TASK_STATUSES.map((s) => (
            <option key={s} value={s}>
              {humanize(s)}
            </option>
          ))}
        </Select>
        <Select
          value={priority}
          onChange={(e) => setPriority(e.target.value as TaskPriority | "")}
          className="w-36"
        >
          <option value="">All priorities</option>
          {TASK_PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {humanize(p)}
            </option>
          ))}
        </Select>
      </div>

      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : data && data.items.length > 0 ? (
        <Card>
          <CardContent className="px-4 py-1">
            <ul className="divide-y divide-border">
              {data.items.map((task) => (
                <TaskRow key={task.id} task={task} />
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          icon={CheckSquare}
          title="No tasks"
          description="Add follow-ups so nothing slips through."
        />
      )}
    </div>
  );
}
