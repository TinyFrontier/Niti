import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Plus, StickyNote, Trash2 } from "lucide-react";
import { createNote, deleteNote, listNotes } from "@/features/notes/api";
import type { EntityType } from "@/features/tasks/api";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { EmptyState } from "@/shared/ui/empty-state";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";

interface NotesCardProps {
  entityType: EntityType;
  entityId: string;
  className?: string;
}

export function NotesCard({ entityType, entityId, className }: NotesCardProps) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const queryKey = ["notes", entityType, entityId];
  const { data: notes } = useQuery({
    queryKey,
    queryFn: () => listNotes(entityType, entityId),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createNote({
        entity_type: entityType,
        entity_id: entityId,
        title: title.trim() || undefined,
        body: body.trim(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setTitle("");
      setBody("");
      setShowForm(false);
    },
  });
  const deleteMutation = useMutation({
    mutationFn: deleteNote,
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return (
    <Card className={className}>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base">Notes</CardTitle>
        <Button variant="outline" size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus /> Add note
        </Button>
      </CardHeader>
      <CardContent>
        {showForm && (
          <form
            className="mb-4 flex flex-col gap-2 rounded-xl border border-border bg-muted/30 p-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (body.trim()) createMutation.mutate();
            }}
          >
            <Input
              placeholder="Title (optional)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <Textarea
              rows={3}
              placeholder="Write a note..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
            <div className="flex items-center gap-2">
              <Button type="submit" size="sm" disabled={!body.trim() || createMutation.isPending}>
                Save
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </form>
        )}
        {notes && notes.length > 0 ? (
          <ul className="divide-y divide-border">
            {notes.map((note) => (
              <li key={note.id} className="flex items-start gap-3 py-3">
                <div className="min-w-0 flex-1">
                  {note.title && <p className="text-sm font-medium">{note.title}</p>}
                  <p className="whitespace-pre-wrap text-sm text-foreground/90">{note.body}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {format(new Date(note.created_at), "d MMM yyyy, HH:mm")}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    if (window.confirm("Delete this note?")) deleteMutation.mutate(note.id);
                  }}
                >
                  <Trash2 className="size-3.5 text-muted-foreground" />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          !showForm && (
            <EmptyState
              icon={StickyNote}
              title="No notes yet"
              description="Keep context here so you don't lose it."
            />
          )
        )}
      </CardContent>
    </Card>
  );
}
