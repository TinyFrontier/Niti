import { cn } from "@/shared/lib/utils";

interface BrandLogoProps {
  className?: string;
}

export function BrandLogo({ className }: BrandLogoProps) {
  return (
    <span
      role="img"
      aria-label="Niti"
      className={cn("inline-flex h-12 shrink-0 items-center gap-3", className)}
    >
      <img aria-hidden="true" src="/brand/niti-mark.svg" alt="" className="h-full w-auto" />
      <span className="relative block h-[65%] aspect-[570/260] shrink-0">
        <img
          aria-hidden="true"
          src="/brand/niti-wordmark.svg"
          alt=""
          className="size-full dark:hidden"
        />
        <img
          aria-hidden="true"
          src="/brand/niti-wordmark-inverse.svg"
          alt=""
          className="hidden size-full dark:block"
        />
      </span>
    </span>
  );
}
