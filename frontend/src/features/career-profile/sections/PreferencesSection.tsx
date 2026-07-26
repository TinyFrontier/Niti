import { LANGUAGE_LEVELS, type LanguageItem } from "@/features/career-profile/api";
import { ListEditor } from "@/features/career-profile/fields/ListEditor";
import { ProfileField } from "@/features/career-profile/fields/ProfileField";
import { TagInput } from "@/features/career-profile/fields/TagInput";
import type { SectionProps } from "@/features/career-profile/sections/types";
import { Input } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";
import { Textarea } from "@/shared/ui/textarea";

const LEVEL_LABELS: Record<(typeof LANGUAGE_LEVELS)[number], string> = {
  a1: "A1 — beginner",
  a2: "A2 — elementary",
  b1: "B1 — intermediate",
  b2: "B2 — upper intermediate",
  c1: "C1 — advanced",
  c2: "C2 — proficient",
  native: "Native",
};

export function PreferencesSection({ value, onChange, sources }: SectionProps) {
  return (
    <div className="flex flex-col gap-5">
      <ProfileField
        label="Languages"
        required
        source={sources.languages}
        hint="A required language you do not speak is a hard blocker, so this matters."
      >
        <ListEditor
          items={value.languages}
          onChange={(languages) => onChange({ languages })}
          blank={() => ({ language: "", level: "b2" }) as LanguageItem}
          addLabel="Add language"
          emptyHint="No languages yet."
          renderRow={(item, update) => (
            <>
              <Input
                className="w-full sm:min-w-40 sm:flex-1"
                placeholder="English"
                value={item.language}
                onChange={(event) => update({ language: event.target.value })}
              />
              <Select
                className="flex-1 sm:w-56 sm:flex-none"
                value={item.level}
                onValueChange={(level) => update({ level: level as LanguageItem["level"] })}
              >
                {LANGUAGE_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {LEVEL_LABELS[level]}
                  </option>
                ))}
              </Select>
            </>
          )}
        />
      </ProfileField>

      <ProfileField
        label="Work authorization"
        source={sources.work_authorization}
        hint="Citizenship, visas or permits you already hold."
      >
        <TagInput
          value={value.work_authorization}
          onChange={(work_authorization) => onChange({ work_authorization })}
          placeholder="EU citizenship"
        />
      </ProfileField>

      <div className="grid gap-5 sm:grid-cols-2">
        <ProfileField label="Preferred domains" source={sources.preferred_domains}>
          <TagInput
            value={value.preferred_domains}
            onChange={(preferred_domains) => onChange({ preferred_domains })}
            placeholder="Fintech"
          />
        </ProfileField>

        <ProfileField label="Domains to avoid" source={sources.avoided_domains}>
          <TagInput
            value={value.avoided_domains}
            onChange={(avoided_domains) => onChange({ avoided_domains })}
            placeholder="Gambling"
          />
        </ProfileField>
      </div>

      <ProfileField
        label="Hard constraints"
        source={sources.hard_constraints}
        hint="Deal breakers. A vacancy that violates one is marked as a blocker, not a gap."
      >
        <TagInput
          value={value.hard_constraints}
          onChange={(hard_constraints) => onChange({ hard_constraints })}
          placeholder="No on-site work"
        />
      </ProfileField>

      <ProfileField label="Anything else" source={sources.notes}>
        <Textarea
          rows={3}
          placeholder="Context that does not fit the fields above..."
          value={value.notes ?? ""}
          onChange={(event) => onChange({ notes: event.target.value || null })}
        />
      </ProfileField>
    </div>
  );
}
