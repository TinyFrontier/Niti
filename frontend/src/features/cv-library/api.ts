import { api, API_URL, tokenStorage } from "@/shared/api/client";
import type { Page } from "@/shared/api/types";

export interface CVVersion {
  id: string;
  title: string;
  language: string | null;
  specialization: string | null;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function listCVVersions(
  params: { page?: number; page_size?: number; search?: string } = {},
) {
  return api<Page<CVVersion>>("/cv-versions", { params: { ...params } });
}

export function uploadCVVersion(data: {
  file: File;
  title: string;
  language?: string;
  specialization?: string;
  notes?: string;
}) {
  const formData = new FormData();
  formData.append("file", data.file);
  formData.append("title", data.title);
  if (data.language) formData.append("language", data.language);
  if (data.specialization) formData.append("specialization", data.specialization);
  if (data.notes) formData.append("notes", data.notes);
  return api<CVVersion>("/cv-versions/upload", { method: "POST", formData });
}

export function deleteCVVersion(id: string) {
  return api<void>(`/cv-versions/${id}`, { method: "DELETE" });
}

export async function downloadCVFile(cv: CVVersion): Promise<void> {
  const response = await fetch(`${API_URL}/cv-versions/${cv.id}/file`, {
    headers: { Authorization: `Bearer ${tokenStorage.get()}` },
  });
  if (!response.ok) throw new Error("Download failed");
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = cv.file_name;
  anchor.click();
  URL.revokeObjectURL(url);
}
