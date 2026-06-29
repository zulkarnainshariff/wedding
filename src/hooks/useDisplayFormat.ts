"use client";

import { useMemo } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  formatBaggageWithPrefs,
  formatClockTimeWithPrefs,
  formatDateOnlyWithPrefs,
  formatDateRangeCompactWithPrefs,
  formatDateTimeWithPrefs,
  formatInstantWithPrefs,
  formatStayDateTimeWithPrefs,
} from "@/lib/display-format";
import { formatFlightEndpointLabel, formatFlightScheduleLines } from "@/lib/flight-datetime";
import { DEFAULT_USER_PREFERENCES } from "@/lib/user-preferences";
import type { ItineraryItem } from "@/lib/schema";

export function useDisplayFormat() {
  const { user } = useAuth();
  const preferences = user?.preferences ?? DEFAULT_USER_PREFERENCES;

  return useMemo(
    () => ({
      preferences,
      formatDateTime: (iso: string | Date | null | undefined) =>
        formatDateTimeWithPrefs(iso, preferences),
      formatInstant: (
        iso: string | Date | null | undefined,
        timeZone: string | null | undefined,
        options?: { airportCode?: string | null },
      ) => formatInstantWithPrefs(iso, timeZone, preferences, options),
      formatDateOnly: (value: string | Date | null | undefined) =>
        formatDateOnlyWithPrefs(value, preferences),
      formatDateRange: (
        start: string | null | undefined,
        end: string | null | undefined,
      ) => formatDateRangeCompactWithPrefs(start, end, preferences),
      formatStayDateTime: (
        date: string | null | undefined,
        time: string | null | undefined,
      ) => formatStayDateTimeWithPrefs(date, time, preferences),
      formatClockTime: (time: string | null | undefined) =>
        formatClockTimeWithPrefs(time, preferences),
      formatBaggage: (value: number | null | undefined) =>
        formatBaggageWithPrefs(value, preferences.units),
      formatFlightEndpoint: (
        item: ItineraryItem,
        endpoint: "departure" | "arrival",
      ) =>
        formatFlightEndpointLabel(item, endpoint, {
          hour12: preferences.timeFormat === "12h",
        }),
      formatFlightSchedule: (item: ItineraryItem) =>
        formatFlightScheduleLines(item, {
          hour12: preferences.timeFormat === "12h",
        }),
    }),
    [preferences],
  );
}
