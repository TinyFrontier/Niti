import { BriefcaseBusiness } from "lucide-react";
import { cn } from "@/shared/lib/utils";

interface BrandMarkProps {
  className?: string;
  iconClassName?: string;
}

export function BrandMark({ className, iconClassName }: BrandMarkProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-xs",
        className,
      )}
    >
      <BriefcaseBusiness className={cn("size-4.5", iconClassName)} strokeWidth={2.2} />
    </span>
  );
}
