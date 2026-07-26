import { api } from "@/shared/api/client";

export const SENIORITIES = [
  "intern",
  "junior",
  "middle",
  "senior",
  "lead",
  "principal",
  "head",
] as const;
export type Seniority = (typeof SENIORITIES)[number];

export const SKILL_LEVELS = ["beginner", "intermediate", "advanced", "expert"] as const;
export type SkillLevel = (typeof SKILL_LEVELS)[number];

export const LANGUAGE_LEVELS = ["a1", "a2", "b1", "b2", "c1", "c2", "native"] as const;
export type LanguageLevel = (typeof LANGUAGE_LEVELS)[number];

export const RELOCATIONS = ["no", "maybe", "yes"] as const;
export type Relocation = (typeof RELOCATIONS)[number];

export const SALARY_PERIODS = ["year", "month", "day", "hour"] as const;
export type SalaryPeriod = (typeof SALARY_PERIODS)[number];

export const PROFILE_WORK_FORMATS = ["remote", "hybrid", "onsite", "flexible"] as const;
export type ProfileWorkFormat = (typeof PROFILE_WORK_FORMATS)[number];

export interface SkillItem {
  name: string;
  level: SkillLevel | null;
  years: number | null;
}

export interface AreaExperience {
  area: string;
  years: number;
}

export interface LanguageItem {
  language: string;
  level: LanguageLevel;
}

export interface SalaryExpectation {
  min_amount: number | null;
  currency: string | null;
  period: SalaryPeriod | null;
}

export interface CareerProfileData {
  target_roles: string[];
  seniority: Seniority | null;
  core_skills: SkillItem[];
  additional_skills: SkillItem[];
  total_experience_years: number | null;
  relevant_experience: AreaExperience[];
  current_location: string | null;
  allowed_countries: string[];
  allowed_timezones: string[];
  work_formats: ProfileWorkFormat[];
  relocation: Relocation | null;
  salary: SalaryExpectation | null;
  languages: LanguageItem[];
  work_authorization: string[];
  preferred_domains: string[];
  avoided_domains: string[];
  hard_constraints: string[];
  notes: string | null;
}

export interface CareerProfile {
  data: CareerProfileData;
  revision: number;
  confirmed_at: string | null;
  updated_at: string | null;
  completeness: number;
  is_ready_for_matching: boolean;
  /** Human-readable labels of what still blocks job matching. */
  missing_for_matching: string[];
}

/** Where a drafted value came from; "ai" when both sources were sent at once. */
export type ProfileFieldSource = "cv_ai" | "text_ai" | "ai";

export interface ProfileDraft {
  data: CareerProfileData;
  sources: Partial<Record<keyof CareerProfileData, ProfileFieldSource>>;
}

export const EMPTY_PROFILE: CareerProfileData = {
  target_roles: [],
  seniority: null,
  core_skills: [],
  additional_skills: [],
  total_experience_years: null,
  relevant_experience: [],
  current_location: null,
  allowed_countries: [],
  allowed_timezones: [],
  work_formats: [],
  relocation: null,
  salary: null,
  languages: [],
  work_authorization: [],
  preferred_domains: [],
  avoided_domains: [],
  hard_constraints: [],
  notes: null,
};

export function getCareerProfile() {
  return api<CareerProfile>("/career-profile");
}

/** Saves one wizard step: only the keys sent are replaced. */
export function patchCareerProfile(data: Partial<CareerProfileData>) {
  return api<CareerProfile>("/career-profile", { method: "PATCH", body: { data } });
}

export function putCareerProfile(data: CareerProfileData) {
  return api<CareerProfile>("/career-profile", { method: "PUT", body: { data } });
}

export function confirmCareerProfile() {
  return api<CareerProfile>("/career-profile/confirm", { method: "POST" });
}

export function draftCareerProfile(input: { cv_version_id?: string; free_text?: string }) {
  return api<ProfileDraft>("/career-profile/draft", { method: "POST", body: input });
}
