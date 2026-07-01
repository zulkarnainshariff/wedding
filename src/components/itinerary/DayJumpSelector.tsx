"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAnchoredDropdownPosition } from "@/hooks/useAnchoredDropdownPosition";
import { useDropdownDismiss } from "@/hooks/useDropdownDismiss";
import { useDisplayFormat } from "@/hooks/useDisplayFormat";
import {
  daySectionId,
  formatDayJumpPrimary,
  formatDayJumpSecondary,
  scrollToDaySection,
  type DayJumpTarget,
  type DayJumpVariant,
} from "@/lib/day-jump";

export function DayJumpSelector({
  days,
  variant,
}: {
  days: DayJumpTarget[];
  variant: DayJumpVariant;
}) {
  const { formatDateOnly } = useDisplayFormat();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuStyle = useAnchoredDropdownPosition(open, triggerRef, {
    minWidth: 320,
    maxHeight: 320,
  });

  useEffect(() => setMounted(true), []);
  useDropdownDismiss(open, () => setOpen(false), triggerRef, menuRef);

  if (days.length <= 1) return null;

  function jumpToDay(day: DayJumpTarget) {
    scrollToDaySection(daySectionId(day, variant));
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm shadow-sm"
      >
        <span className="font-medium text-stone-700">Jump to day</span>
        <ChevronDown
          className={[
            "h-4 w-4 text-stone-400 transition-transform",
            open ? "rotate-180" : "",
          ].join(" ")}
        />
      </button>

      {open && mounted
        ? createPortal(
            <div
              ref={menuRef}
              role="listbox"
              aria-label="Jump to day"
              style={menuStyle}
              className="overflow-y-auto overscroll-contain rounded-xl border border-stone-200 bg-white shadow-xl"
            >
              <ul className="p-2">
                {days.map((day) => {
                  const title = formatDayJumpSecondary(day);
                  return (
                    <li key={day.id}>
                      <button
                        type="button"
                        role="option"
                        onClick={() => jumpToDay(day)}
                        className="w-full rounded-lg px-3 py-2.5 text-left hover:bg-stone-50 active:bg-stone-100"
                      >
                        <span className="block text-sm font-medium text-stone-800">
                          {formatDayJumpPrimary(day, formatDateOnly)}
                        </span>
                        {title ? (
                          <span className="mt-0.5 block text-xs leading-snug text-stone-500">
                            {title}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
