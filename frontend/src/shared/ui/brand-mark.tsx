import { cn } from "@/shared/lib/utils";

interface BrandMarkProps {
  className?: string;
  iconClassName?: string;
}

export function BrandMark({ className, iconClassName }: BrandMarkProps) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-flex size-9 shrink-0 overflow-hidden rounded-[22%]", className)}
    >
      <img
        src="/brand/niti-app-icon.svg"
        alt=""
        className={cn("size-full", iconClassName)}
      />
    </span>
  );
}
