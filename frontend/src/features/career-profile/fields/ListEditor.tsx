import type { ReactNode } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/shared/ui/button";

/**
 * Rows of structured entries — skills, languages, areas of experience.
 * The caller renders one row; adding, removing and the empty state are shared,
 * so the three editors differ only in their fields.
 */
export function ListEditor<T>({
  items,
  onChange,
  blank,
  addLabel,
  emptyHint,
  renderRow,
}: {
  items: T[];
  onChange: (items: T[]) => void;
  /** A fresh entry for the "add" button. */
  blank: () => T;
  addLabel: string;
  emptyHint?: string;
  renderRow: (item: T, update: (patch: Partial<T>) => void) => ReactNode;
}) {
  const replace = (index: number, patch: Partial<T>) =>
    onChange(items.map((item, at) => (at === index ? { ...item, ...patch } : item)));

  return (
    <div className="flex flex-col gap-2">
      {items.length === 0 && emptyHint && (
        <p className="text-xs text-muted-foreground">{emptyHint}</p>
      )}
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          <div className="flex flex-1 flex-wrap items-center gap-2">
            {renderRow(item, (patch) => replace(index, patch))}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Remove entry"
            onClick={() => onChange(items.filter((_, at) => at !== index))}
          >
            <X />
          </Button>
        </div>
      ))}
      <div>
        <Button type="button" variant="outline" size="sm" onClick={() => onChange([...items, blank()])}>
          <Plus /> {addLabel}
        </Button>
      </div>
    </div>
  );
}
