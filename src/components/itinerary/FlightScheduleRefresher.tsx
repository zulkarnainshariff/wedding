"use client";

import { useEffect, useRef } from "react";
import { useTripTime } from "@/components/itinerary/TripTimeContext";
import { shouldFetchFlightLiveStatus } from "@/lib/flight-live-eligibility";
import type { ItineraryItem } from "@/lib/schema";
import { resolveOperatingFlightNumber } from "@/lib/flight-numbers";
import { getFlightDetails } from "@/lib/types";
import { getItemCalendarDate } from "@/lib/item-scheduling";

/** Refresh stored flight times from the schedule API when the app is opened. */
export function FlightScheduleRefresher({
  items,
}: {
  items: ItineraryItem[];
}) {
  const { effectiveDate, effectiveDateString } = useTripTime();
  const refreshedRef = useRef(new Set<number>());

  useEffect(() => {
    const flights = items.filter((item) => item.category === "flight");
    for (const item of flights) {
      if (!item.id || refreshedRef.current.has(item.id)) continue;
      if (!shouldFetchFlightLiveStatus(item, effectiveDate)) continue;

      const details = getFlightDetails(item.details);
      if (!details) continue;
      const operatingFlightNumber = resolveOperatingFlightNumber(details);
      const flightDate = getItemCalendarDate(item);
      if (!operatingFlightNumber || !flightDate) continue;

      refreshedRef.current.add(item.id);
      void fetch(
        `/api/flights/${item.id}/status?asOf=${encodeURIComponent(effectiveDateString)}`,
        { cache: "no-store" },
      ).catch(() => {
        refreshedRef.current.delete(item.id);
      });
    }
  }, [items, effectiveDate, effectiveDateString]);

  return null;
}
