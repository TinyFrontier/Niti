import { useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { Input } from "@/shared/ui/input";

/**
 * Free-text chips. Enter or comma commits a value; Backspace on an empty input
 * removes the last one, so a mistyped entry costs one keystroke to undo.
 */
export function TagInput({
  value,
  onChange,
  placeholder,
  id,
}: {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  id?: string;
}) {
  const [draft, setDraft] = useState("");

  const commit = (raw: string) => {
    const entry = raw.trim();
    if (!entry) return;
    // the backend drops duplicates too, but silently re-adding one looks broken
    if (!value.some((existing) => existing.toLowerCase() === entry.toLowerCase())) {
      onChange([...value, entry]);
    }
    setDraft("");
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      commit(draft);
    } else if (event.key === "Backspace" && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {value.map((entry, index) => (
            <li
              key={`${entry}-${index}`}
              className="inline-flex items-center gap-1 rounded-md bg-kumo-recessed px-2 py-0.5 text-sm"
            >
              {entry}
              <button
                type="button"
                aria-label={`Remove ${entry}`}
                onClick={() => onChange(value.filter((_, at) => at !== index))}
                className="text-kumo-subtle hover:text-destructive"
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Input
        id={id}
        value={draft}
        placeholder={placeholder}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => commit(draft)}
      />
    </div>
  );
}
