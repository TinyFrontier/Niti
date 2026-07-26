import type { CareerProfileData, ProfileFieldSource } from "@/features/career-profile/api";

export interface SectionProps {
  value: CareerProfileData;
  onChange: (patch: Partial<CareerProfileData>) => void;
  /** Which fields the AI proposed, so they can be marked until confirmed. */
  sources: Partial<Record<keyof CareerProfileData, ProfileFieldSource>>;
}

export const humanize = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, " ");

/** Number inputs hand back strings; empty means "not stated", not zero. */
export const toNumber = (raw: string): number | null => {
  const parsed = Number(raw);
  return raw.trim() === "" || Number.isNaN(parsed) ? null : parsed;
};
