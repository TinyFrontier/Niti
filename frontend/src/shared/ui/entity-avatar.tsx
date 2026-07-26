import { cn } from "@/shared/lib/utils";

/**
 * Square initials tile standing in for a logo — we do not store company logos,
 * so the colour is derived from the name to stay stable across renders.
 */
const PALETTES = [
  "bg-slate-800 text-white",
  "bg-indigo-600 text-white",
  "bg-emerald-600 text-white",
  "bg-amber-500 text-white",
  "bg-rose-500 text-white",
  "bg-sky-600 text-white",
  "bg-violet-600 text-white",
  "bg-teal-600 text-white",
];

function hash(value: string): number {
  let result = 0;
  for (let i = 0; i < value.length; i += 1) {
    result = (result * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(result);
}

function initials(name: string): string {
  const words = name.trim().split(/[\s.-]+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

interface EntityAvatarProps {
  name: string | null | undefined;
  className?: string;
}

export function EntityAvatar({ name, className }: EntityAvatarProps) {
  const label = name?.trim() || "—";
  const palette = name?.trim() ? PALETTES[hash(label) % PALETTES.length] : "bg-kumo-recessed text-kumo-subtle";

  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-lg text-xs font-semibold",
        palette,
        className,
      )}
    >
      {initials(label)}
    </span>
  );
}
