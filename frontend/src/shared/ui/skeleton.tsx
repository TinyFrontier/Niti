import * as React from "react";
import { SkeletonLine } from "@cloudflare/kumo/components/loader";

export function Skeleton({ className }: React.HTMLAttributes<HTMLDivElement>) {
  return <SkeletonLine minWidth={100} maxWidth={100} className={className} />;
}
