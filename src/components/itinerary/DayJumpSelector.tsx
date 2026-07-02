"use client";

import { CalendarDays, ChevronDown } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAnchoredDropdownPosition } from "@/hooks/useAnchoredDropdownPosition";
import { useDropdownDismiss } from "@/hooks/useDropdownDismiss";
import { useDisplayFormat } from "@/hooks/useDisplayFormat";
import {
  dayJumpCalendarBounds,
  daySectionId,
  findDayJumpTargetByDate,
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
  const [selectedDate, setSelectedDate] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuStyle = useAnchoredDropdownPosition(open, triggerRef, {
    minWidth: 320,
    maxHeight: 320,
  });
  const calendarBounds = useMemo(() => dayJumpCalendarBounds(days), [days]);

  useEffect(() => setMounted(true), []);
  useDropdownDismiss(open, () => setOpen(false), triggerRef, menuRef);

  if (days.length <= 1) return null;

  function jumpToDay(day: DayJumpTarget) {
    scrollToDaySection(daySectionId(day, variant));
    setSelectedDate(day.date);
    setOpen(false);
  }

  function jumpToDate(date: string) {
    const day = findDayJumpTargetByDate(days, date);
    if (!day) return;
    jumpToDay(day);
  }

  return (
    <div className="inline-flex items-stretch overflow-hidden rounded-xl border border-stone-200 bg-white text-sm shadow-sm">
      <label className="relative inline-flex min-w-0 items-center gap-2 px-3 py-2">
        <CalendarDays className="h-4 w-4 shrink-0 text-stone-400" aria-hidden />
        <span className="sr-only">Jump to date</span>
        <input
          type="date"
          value={selectedDate}
          min={calendarBounds?.min}
          max={calendarBounds?.max}
          onChange={(event) => {
            const nextDate = event.target.value;
            setSelectedDate(nextDate);
            jumpToDate(nextDate);
          }}
          className="min-w-0 border-0 bg-transparent p-0 text-stone-700 outline-none [color-scheme:light]"
          aria-label="Jump to date"
        />
      </label>

      <div className="w-px self-stretch bg-stone-200" aria-hidden />

      <div className="relative">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open}
          aria-haspopup="listbox"
          className="inline-flex h-full items-center gap-2 px-3 py-2 text-stone-700 hover:bg-stone-50"
        >
          <span className="font-medium">Jump to day</span>
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
                          aria-selected={selectedDate === day.date}
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
    </div>
  );
}
