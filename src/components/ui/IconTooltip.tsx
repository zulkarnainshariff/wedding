"use client";

import type { ReactNode } from "react";

export function IconTooltip({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={["group/tooltip relative inline-flex", className].join(" ")}
    >
      {children}
      <span
        role="tooltip"
        className={[
          "pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 w-max max-w-xs",
          "-translate-x-1/2 rounded-lg bg-stone-800 px-2.5 py-1.5 text-left text-xs leading-snug font-normal whitespace-pre-wrap text-white shadow-lg",
          "invisible opacity-0 transition-opacity group-hover/tooltip:visible group-hover/tooltip:opacity-100",
          "group-focus-within/tooltip:visible group-focus-within/tooltip:opacity-100",
        ].join(" ")}
      >
        {label}
      </span>
    </span>
  );
}
