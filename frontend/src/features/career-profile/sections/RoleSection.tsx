import { SENIORITIES, SKILL_LEVELS, type SkillItem } from "@/features/career-profile/api";
import { ListEditor } from "@/features/career-profile/fields/ListEditor";
import { ProfileField } from "@/features/career-profile/fields/ProfileField";
import { TagInput } from "@/features/career-profile/fields/TagInput";
import { humanize, toNumber, type SectionProps } from "@/features/career-profile/sections/types";
import { Input } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";

function SkillRows({
  items,
  onChange,
  addLabel,
  emptyHint,
}: {
  items: SkillItem[];
  onChange: (items: SkillItem[]) => void;
  addLabel: string;
  emptyHint?: string;
}) {
  return (
    <ListEditor
      items={items}
      onChange={onChange}
      blank={() => ({ name: "", level: null, years: null })}
      addLabel={addLabel}
      emptyHint={emptyHint}
      renderRow={(skill, update) => (
        <>
          {/* full width on a phone, one line from sm up */}
          <Input
            className="w-full sm:min-w-40 sm:flex-1"
            placeholder="Python"
            value={skill.name}
            onChange={(event) => update({ name: event.target.value })}
          />
          <Select
            className="flex-1 sm:w-40 sm:flex-none"
            value={skill.level ?? ""}
            onValueChange={(level) =>
              update({ level: (level || null) as SkillItem["level"] })
            }
          >
            <option value="">Level</option>
            {SKILL_LEVELS.map((level) => (
              <option key={level} value={level}>
                {humanize(level)}
              </option>
            ))}
          </Select>
          <Input
            className="w-24"
            type="number"
            min={0}
            placeholder="Years"
            value={skill.years ?? ""}
            onChange={(event) => update({ years: toNumber(event.target.value) })}
          />
        </>
      )}
    />
  );
}

export function RoleSection({ value, onChange, sources }: SectionProps) {
  return (
    <div className="flex flex-col gap-5">
      <ProfileField
        label="Target roles"
        required
        source={sources.target_roles}
        hint="The jobs you actually want. Press Enter after each one."
      >
        <TagInput
          value={value.target_roles}
          onChange={(target_roles) => onChange({ target_roles })}
          placeholder="Backend Engineer"
        />
      </ProfileField>

      <div className="grid gap-5 sm:grid-cols-2">
        <ProfileField label="Seniority" required source={sources.seniority}>
          <Select
            value={value.seniority ?? ""}
            onValueChange={(seniority) =>
              onChange({ seniority: (seniority || null) as typeof value.seniority })
            }
          >
            <option value="">Not set</option>
            {SENIORITIES.map((level) => (
              <option key={level} value={level}>
                {humanize(level)}
              </option>
            ))}
          </Select>
        </ProfileField>

        <ProfileField label="Total experience, years" source={sources.total_experience_years}>
          <Input
            type="number"
            min={0}
            placeholder="7"
            value={value.total_experience_years ?? ""}
            onChange={(event) =>
              onChange({ total_experience_years: toNumber(event.target.value) })
            }
          />
        </ProfileField>
      </div>

      <ProfileField
        label="Core skills"
        required
        source={sources.core_skills}
        hint="Technologies you have actually worked with. At least three are needed for job matching."
      >
        <SkillRows
          items={value.core_skills}
          onChange={(core_skills) => onChange({ core_skills })}
          addLabel="Add skill"
          emptyHint="No skills yet."
        />
      </ProfileField>

      <ProfileField label="Additional skills" source={sources.additional_skills}>
        <SkillRows
          items={value.additional_skills}
          onChange={(additional_skills) => onChange({ additional_skills })}
          addLabel="Add skill"
        />
      </ProfileField>

      <ProfileField
        label="Experience by area"
        source={sources.relevant_experience}
        hint="Where those years were spent — backend, data, payments."
      >
        <ListEditor
          items={value.relevant_experience}
          onChange={(relevant_experience) => onChange({ relevant_experience })}
          blank={() => ({ area: "", years: 0 })}
          addLabel="Add area"
          renderRow={(entry, update) => (
            <>
              <Input
                className="w-full sm:min-w-40 sm:flex-1"
                placeholder="Payments"
                value={entry.area}
                onChange={(event) => update({ area: event.target.value })}
              />
              <Input
                className="w-24"
                type="number"
                min={0}
                placeholder="Years"
                value={entry.years}
                onChange={(event) => update({ years: toNumber(event.target.value) ?? 0 })}
              />
            </>
          )}
        />
      </ProfileField>
    </div>
  );
}
