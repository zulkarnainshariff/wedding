"use client";

import { CheckSquare } from "lucide-react";
import type { ItemTaskSummary } from "@/lib/task-queries";

export function ItemTaskIcon({
  summary,
  className = "",
}: {
  summary?: ItemTaskSummary;
  className?: string;
}) {
  if (!summary?.count) return null;

  const tone = summary.hasUrgent
    ? "bg-red-50 text-red-700 ring-red-200"
    : summary.mine > 0
      ? "bg-amber-50 text-amber-800 ring-amber-200"
      : "bg-sky-50 text-sky-800 ring-sky-200";

  return (
    <span
      className={[
        "group/task relative inline-flex shrink-0 align-middle",
        className,
      ].join(" ")}
    >
      <span
        className={[
          "inline-flex items-center rounded-full p-0.5 ring-1",
          tone,
        ].join(" ")}
        aria-label={summary.label}
      >
        <CheckSquare className="h-3 w-3" />
      </span>
      <span
        role="tooltip"
        className={[
          "pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 w-max max-w-xs",
          "-translate-x-1/2 rounded-lg bg-stone-800 px-2.5 py-1.5 text-left text-xs leading-snug font-normal text-white shadow-lg",
          "invisible opacity-0 group-hover/task:visible group-hover/task:opacity-100",
          "group-focus-within/task:visible group-focus-within/task:opacity-100",
        ].join(" ")}
      >
        {summary.label}
      </span>
    </span>
  );
}
