import { api } from "@/shared/api/client";
import type { EntityType } from "@/features/tasks/api";

export interface Note {
  id: string;
  entity_type: EntityType;
  entity_id: string;
  title: string | null;
  body: string;
  created_at: string;
  updated_at: string;
}

export function listNotes(entityType: EntityType, entityId: string) {
  return api<Note[]>("/notes", { params: { entity_type: entityType, entity_id: entityId } });
}

export function createNote(payload: {
  entity_type: EntityType;
  entity_id: string;
  title?: string;
  body: string;
}) {
  return api<Note>("/notes", { method: "POST", body: payload });
}

export function deleteNote(id: string) {
  return api<void>(`/notes/${id}`, { method: "DELETE" });
}
