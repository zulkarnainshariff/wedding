"use client";

import { CalendarDays, ChevronDown } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTripTime } from "@/components/itinerary/TripTimeContext";
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
  const { itineraryStartDate } = useTripTime();
  const { formatDateOnly } = useDisplayFormat();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [selectedDate, setSelectedDate] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuStyle = useAnchoredDropdownPosition(open, triggerRef, {
    minWidth: 320,
    maxHeight: 320,
  });
  const calendarBounds = useMemo(() => dayJumpCalendarBounds(days), [days]);
  const selectedDay = useMemo(
    () => days.find((day) => day.date === selectedDate) ?? null,
    [days, selectedDate],
  );

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

  function openCalendarPicker() {
    const input = dateInputRef.current;
    if (!input) return;
    if (typeof input.showPicker === "function") {
      input.showPicker();
      return;
    }
    input.click();
  }

  const jumpLabel = selectedDay
    ? formatDayJumpPrimary(
        selectedDay,
        formatDateOnly,
        days,
        itineraryStartDate,
      )
    : "Jump to day";

  return (
    <div className="inline-flex items-stretch overflow-hidden rounded-xl border border-stone-200 bg-white text-sm shadow-sm">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="inline-flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left text-stone-700 hover:bg-stone-50"
      >
        <span className="truncate font-medium">{jumpLabel}</span>
        <ChevronDown
          className={[
            "ml-auto h-4 w-4 shrink-0 text-stone-400 transition-transform",
            open ? "rotate-180" : "",
          ].join(" ")}
        />
      </button>

      <div className="w-px self-stretch bg-stone-200" aria-hidden />

      <button
        type="button"
        onClick={openCalendarPicker}
        className="inline-flex items-center px-2.5 py-2 text-stone-500 hover:bg-stone-50"
        aria-label="Pick date on calendar"
      >
        <CalendarDays className="h-4 w-4" aria-hidden />
      </button>

      <input
        ref={dateInputRef}
        type="date"
        value={selectedDate}
        min={calendarBounds?.min}
        max={calendarBounds?.max}
        onChange={(event) => {
          const nextDate = event.target.value;
          setSelectedDate(nextDate);
          jumpToDate(nextDate);
        }}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
      />

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
                          {formatDayJumpPrimary(
                            day,
                            formatDateOnly,
                            days,
                            itineraryStartDate,
                          )}
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
