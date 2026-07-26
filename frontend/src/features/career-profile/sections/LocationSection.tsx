import {
  PROFILE_WORK_FORMATS,
  RELOCATIONS,
  SALARY_PERIODS,
  type SalaryExpectation,
} from "@/features/career-profile/api";
import { ProfileField } from "@/features/career-profile/fields/ProfileField";
import { TagInput } from "@/features/career-profile/fields/TagInput";
import { humanize, toNumber, type SectionProps } from "@/features/career-profile/sections/types";
import { cn } from "@/shared/lib/utils";
import { Input } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";

const EMPTY_SALARY: SalaryExpectation = { min_amount: null, currency: null, period: "month" };

export function LocationSection({ value, onChange, sources }: SectionProps) {
  const salary = value.salary ?? EMPTY_SALARY;
  const patchSalary = (patch: Partial<SalaryExpectation>) => {
    const next = { ...salary, ...patch };
    // an entirely blank salary is "not stated", not a zero expectation
    const stated = next.min_amount !== null || next.currency;
    onChange({ salary: stated ? next : null });
  };

  const toggleFormat = (format: (typeof PROFILE_WORK_FORMATS)[number]) => {
    const chosen = value.work_formats.includes(format)
      ? value.work_formats.filter((item) => item !== format)
      : [...value.work_formats, format];
    onChange({ work_formats: chosen });
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <ProfileField label="Current location" required source={sources.current_location}>
          <Input
            placeholder="Lisbon, Portugal"
            value={value.current_location ?? ""}
            onChange={(event) => onChange({ current_location: event.target.value || null })}
          />
        </ProfileField>

        <ProfileField label="Relocation" source={sources.relocation}>
          <Select
            value={value.relocation ?? ""}
            onValueChange={(relocation) =>
              onChange({ relocation: (relocation || null) as typeof value.relocation })
            }
          >
            <option value="">Not set</option>
            {RELOCATIONS.map((option) => (
              <option key={option} value={option}>
                {{ no: "No", maybe: "Maybe", yes: "Yes" }[option]}
              </option>
            ))}
          </Select>
        </ProfileField>
      </div>

      <ProfileField
        label="Work format"
        required
        source={sources.work_formats}
        hint="Pick every format you would accept."
      >
        <div className="flex flex-wrap gap-2">
          {PROFILE_WORK_FORMATS.map((format) => {
            const active = value.work_formats.includes(format);
            return (
              <button
                key={format}
                type="button"
                aria-pressed={active}
                onClick={() => toggleFormat(format)}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-sm transition-colors",
                  active
                    ? "border-primary bg-primary-subtle font-medium text-primary"
                    : "border-border text-muted-foreground hover:border-primary/40",
                )}
              >
                {humanize(format)}
              </button>
            );
          })}
        </div>
      </ProfileField>

      <div className="grid gap-5 sm:grid-cols-2">
        <ProfileField
          label="Countries you can work from"
          source={sources.allowed_countries}
          hint="Leave empty if this does not constrain you."
        >
          <TagInput
            value={value.allowed_countries}
            onChange={(allowed_countries) => onChange({ allowed_countries })}
            placeholder="Portugal"
          />
        </ProfileField>

        <ProfileField label="Timezones" source={sources.allowed_timezones}>
          <TagInput
            value={value.allowed_timezones}
            onChange={(allowed_timezones) => onChange({ allowed_timezones })}
            placeholder="CET"
          />
        </ProfileField>
      </div>

      <ProfileField
        label="Minimum salary"
        source={sources.salary}
        hint="Used to flag vacancies that pay below what you would accept."
      >
        <div className="flex flex-wrap gap-2">
          <Input
            className="w-36"
            type="number"
            min={0}
            placeholder="5500"
            value={salary.min_amount ?? ""}
            onChange={(event) => patchSalary({ min_amount: toNumber(event.target.value) })}
          />
          <Input
            className="w-28"
            placeholder="EUR"
            maxLength={3}
            value={salary.currency ?? ""}
            onChange={(event) =>
              patchSalary({ currency: event.target.value.toUpperCase() || null })
            }
          />
          <Select
            className="w-36"
            value={salary.period ?? ""}
            onValueChange={(period) =>
              patchSalary({ period: (period || null) as SalaryExpectation["period"] })
            }
          >
            {SALARY_PERIODS.map((period) => (
              <option key={period} value={period}>
                per {period}
              </option>
            ))}
          </Select>
        </div>
      </ProfileField>
    </div>
  );
}
