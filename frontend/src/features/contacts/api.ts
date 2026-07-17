import { api } from "@/shared/api/client";
import type { Page } from "@/shared/api/types";
import type { Company } from "@/features/companies/api";

export const CONTACT_TYPES = [
  "recruiter",
  "hiring_manager",
  "candidate",
  "professional_contact",
  "other",
] as const;

export const CONTACT_STATUSES = [
  "new",
  "contacted",
  "responded",
  "active_conversation",
  "follow_up_needed",
  "not_relevant",
  "archived",
] as const;

export const COMM_CHANNELS = ["email", "telegram", "linkedin", "phone", "other"] as const;
export const COMM_DIRECTIONS = ["outbound", "inbound"] as const;

export type ContactType = (typeof CONTACT_TYPES)[number];
export type ContactStatus = (typeof CONTACT_STATUSES)[number];
export type CommChannel = (typeof COMM_CHANNELS)[number];
export type CommDirection = (typeof COMM_DIRECTIONS)[number];

export interface Contact {
  id: string;
  first_name: string;
  last_name: string | null;
  contact_type: ContactType;
  status: ContactStatus;
  email: string | null;
  phone: string | null;
  telegram: string | null;
  linkedin_url: string | null;
  position: string | null;
  company: Company | null;
  created_at: string;
  updated_at: string;
}

export interface ContactPayload {
  first_name: string;
  last_name?: string;
  contact_type?: ContactType;
  status?: ContactStatus;
  email?: string | null;
  phone?: string;
  telegram?: string;
  linkedin_url?: string;
  position?: string;
  company_id?: string | null;
}

export interface CommunicationLog {
  id: string;
  channel: CommChannel;
  direction: CommDirection;
  subject: string | null;
  body: string | null;
  occurred_at: string;
  next_follow_up_at: string | null;
  application_id: string | null;
  created_at: string;
}

export interface CommunicationPayload {
  channel: CommChannel;
  direction: CommDirection;
  subject?: string;
  body?: string;
  occurred_at: string;
  next_follow_up_at?: string | null;
  application_id?: string | null;
}

export interface ContactListParams {
  page?: number;
  page_size?: number;
  search?: string;
  contact_type?: ContactType;
  status?: ContactStatus;
  company_id?: string;
}

export function listContacts(params: ContactListParams = {}) {
  return api<Page<Contact>>("/contacts", { params: { ...params } });
}

export function getContact(id: string) {
  return api<Contact>(`/contacts/${id}`);
}

export function createContact(payload: ContactPayload) {
  return api<Contact>("/contacts", { method: "POST", body: payload });
}

export function updateContact(id: string, payload: Partial<ContactPayload>) {
  return api<Contact>(`/contacts/${id}`, { method: "PATCH", body: payload });
}

export function deleteContact(id: string) {
  return api<void>(`/contacts/${id}`, { method: "DELETE" });
}

export function listCommunications(contactId: string) {
  return api<CommunicationLog[]>(`/contacts/${contactId}/communications`);
}

export function createCommunication(contactId: string, payload: CommunicationPayload) {
  return api<CommunicationLog>(`/contacts/${contactId}/communications`, {
    method: "POST",
    body: payload,
  });
}

export function deleteCommunication(contactId: string, communicationId: string) {
  return api<void>(`/contacts/${contactId}/communications/${communicationId}`, {
    method: "DELETE",
  });
}
