import { api } from "@/shared/api/client";

export const USER_ROLES = ["job_seeker", "recruiter", "mix"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export interface User {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole | null;
  created_at: string;
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

export function updateMe(payload: { full_name?: string | null; role?: UserRole }) {
  return api<User>("/auth/me", { method: "PATCH", body: payload });
}
