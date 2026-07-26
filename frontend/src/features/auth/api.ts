import { api } from "@/shared/api/client";

export const USER_ROLES = ["job_seeker", "recruiter", "mix"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export interface User {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole | null;
  created_at: string;
  /** Null keeps the user in the onboarding wizard. */
  onboarding_completed_at: string | null;
  /** Consent to send documents to the external AI provider. */
  ai_consent_at: string | null;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export function login(data: { email: string; password: string }) {
  return api<TokenResponse>("/auth/login", { method: "POST", body: data });
}

export function register(data: { email: string; password: string; full_name?: string }) {
  return api<User>("/auth/register", { method: "POST", body: data });
}

export function getMe() {
  return api<User>("/auth/me");
}

export function updateMe(payload: {
  full_name?: string | null;
  role?: UserRole;
  ai_consent?: boolean;
}) {
  return api<User>("/auth/me", { method: "PATCH", body: payload });
}

/** Lets the user into the app, whether they filled the profile or skipped it. */
export function completeOnboarding(skippedAtStep?: number) {
  return api<User>("/auth/onboarding/complete", {
    method: "POST",
    params: skippedAtStep === undefined ? undefined : { skipped_at_step: skippedAtStep },
  });
}

export interface SessionOut {
  id: string;
  created_at: string;
  last_used_at: string;
  user_agent: string | null;
  current: boolean;
}

export function logout() {
  return api<void>("/auth/logout", { method: "POST" });
}

export function logoutAll() {
  return api<void>("/auth/logout-all", { method: "POST" });
}

export function listSessions() {
  return api<SessionOut[]>("/auth/sessions");
}

export function revokeSession(id: string) {
  return api<void>(`/auth/sessions/${id}`, { method: "DELETE" });
}

export interface PasswordResetRequestResponse {
  detail: string;
  reset_url?: string;
}

export function requestPasswordReset(email: string) {
  return api<PasswordResetRequestResponse>("/auth/password-reset/request", {
    method: "POST",
    body: { email },
  });
}

export function confirmPasswordReset(token: string, new_password: string) {
  return api<{ detail: string }>("/auth/password-reset/confirm", {
    method: "POST",
    body: { token, new_password },
  });
}
