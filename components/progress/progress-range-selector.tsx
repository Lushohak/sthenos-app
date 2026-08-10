"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  PROGRESS_RANGES,
  progressRangeLabel,
  type ProgressRange
} from "@/lib/progress-analytics";
import { cn } from "@/lib/utils";

export function ProgressRangeSelector({ value }: { value: ProgressRange }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <nav aria-label="Progress date range" className="flex flex-wrap gap-2">
      {PROGRESS_RANGES.map((range) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("range", range);
        return (
          <Link
            key={range}
            href={`${pathname}?${params.toString()}`}
            aria-current={value === range ? "page" : undefined}
            className={cn(
              "rounded-md border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
              value === range
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border-emphasis bg-elevated text-muted-foreground hover:border-secondary hover:text-foreground"
            )}
          >
            {progressRangeLabel(range)}
          </Link>
        );
      })}
    </nav>
  );
}
