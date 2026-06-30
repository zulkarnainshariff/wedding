"use client";

import { useMemo } from "react";
import { useTripTime } from "@/components/itinerary/TripTimeContext";
import {
  filterItineraryDays,
  type DayWithItems,
} from "@/lib/day-visibility";

export function useDayVisibility<T extends DayWithItems>(days: T[]) {
  const {
    effectiveDate,
    hidePast,
    hideFreeDays,
    hideUntouchedDays,
    hiddenDayIds,
    forceVisibleDayIds,
  } = useTripTime();

  const visibleDays = useMemo(
    () =>
      filterItineraryDays(days, {
        effectiveDate,
        hidePast,
        hideFreeDays,
        hideUntouchedDays,
        hiddenDayIds,
        forceVisibleDayIds,
      }),
    [
      days,
      effectiveDate,
      hidePast,
      hideFreeDays,
      hideUntouchedDays,
      hiddenDayIds,
      forceVisibleDayIds,
    ],
  );

  return { visibleDays, allDays: days };
}
