"use client";

import { MessageSquare } from "lucide-react";

export function TaskNoteIcon({
  preview,
  className = "",
}: {
  preview?: string;
  className?: string;
}) {
  if (!preview) return null;

  return (
    <span
      className={[
        "group/note relative inline-flex shrink-0 align-middle",
        className,
      ].join(" ")}
    >
      <span
        className="inline-flex items-center rounded-full bg-stone-100 p-0.5 text-stone-600 ring-1 ring-stone-200"
        aria-label="Task notes"
      >
        <MessageSquare className="h-3 w-3" />
      </span>
      <span
        role="tooltip"
        className={[
          "pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 w-max max-w-xs",
          "-translate-x-1/2 rounded-lg bg-stone-800 px-2.5 py-1.5 text-left text-xs leading-snug font-normal whitespace-pre-wrap text-white shadow-lg",
          "invisible opacity-0 group-hover/note:visible group-hover/note:opacity-100",
          "group-focus-within/note:visible group-focus-within/note:opacity-100",
        ].join(" ")}
      >
        {preview}
      </span>
    </span>
  );
}
