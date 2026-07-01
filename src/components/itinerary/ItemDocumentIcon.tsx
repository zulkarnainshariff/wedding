"use client";

import { Paperclip } from "lucide-react";

export function ItemDocumentIcon({
  count,
  className = "",
}: {
  count: number;
  className?: string;
}) {
  if (!count) return null;

  const label = `${count} document${count === 1 ? "" : "s"}`;

  return (
    <span
      className={[
        "group/doc relative inline-flex shrink-0 align-middle",
        className,
      ].join(" ")}
    >
      <span
        className="inline-flex items-center rounded-full bg-stone-100 p-0.5 text-stone-600 ring-1 ring-stone-200"
        aria-label={label}
      >
        <Paperclip className="h-3 w-3" />
      </span>
      <span
        role="tooltip"
        className={[
          "pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 w-max max-w-xs",
          "-translate-x-1/2 rounded-lg bg-stone-800 px-2.5 py-1.5 text-left text-xs leading-snug font-normal text-white shadow-lg",
          "invisible opacity-0 group-hover/doc:visible group-hover/doc:opacity-100",
          "group-focus-within/doc:visible group-focus-within/doc:opacity-100",
        ].join(" ")}
      >
        {label}
      </span>
    </span>
  );
}
