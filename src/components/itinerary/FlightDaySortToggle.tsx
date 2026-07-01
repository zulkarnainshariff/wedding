"use client";

import { useMemo } from "react";
import { dayHasFlight, sortDayItems } from "@/lib/day-item-sort";
import { useFlightDaySortMode } from "@/hooks/useFlightDaySortMode";
import type { ItineraryDay, ItineraryItem } from "@/lib/schema";

type DayWithItems = ItineraryDay & { items: ItineraryItem[] };

export function FlightDaySortToggle({
  days,
}: {
  days: DayWithItems[];
}) {
  const { mode, setMode } = useFlightDaySortMode();
  const hasFlights = useMemo(
    () => days.some((day) => dayHasFlight(day.items)),
    [days],
  );

  if (!hasFlights) return null;

  return (
    <div className="inline-flex rounded-xl border border-stone-200 bg-white p-1 text-sm">
      <button
        type="button"
        onClick={() => setMode("arrival")}
        className={[
          "rounded-lg px-3 py-1.5 font-medium transition",
          mode === "arrival"
            ? "bg-brand-deep text-white"
            : "text-stone-600 hover:bg-stone-50",
        ].join(" ")}
      >
        Sort by arrival
      </button>
      <button
        type="button"
        onClick={() => setMode("departure")}
        className={[
          "rounded-lg px-3 py-1.5 font-medium transition",
          mode === "departure"
            ? "bg-brand-deep text-white"
            : "text-stone-600 hover:bg-stone-50",
        ].join(" ")}
      >
        Sort by departure
      </button>
    </div>
  );
}

export function useFlightSortedDays(days: DayWithItems[]): DayWithItems[] {
  const { mode } = useFlightDaySortMode();

  return useMemo(
    () =>
      days.map((day) => ({
        ...day,
        items: sortDayItems(day.items, mode),
      })),
    [days, mode],
  );
}
