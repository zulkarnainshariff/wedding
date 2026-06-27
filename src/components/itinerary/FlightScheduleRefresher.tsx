"use client";

import { useEffect, useRef } from "react";
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
  const refreshedRef = useRef(new Set<number>());

  useEffect(() => {
    const flights = items.filter((item) => item.category === "flight");
    for (const item of flights) {
      if (!item.id || refreshedRef.current.has(item.id)) continue;

      const details = getFlightDetails(item.details);
      if (!details) continue;
      const operatingFlightNumber = resolveOperatingFlightNumber(details);
      const flightDate = getItemCalendarDate(item);
      if (!operatingFlightNumber || !flightDate) continue;

      refreshedRef.current.add(item.id);
      void fetch(`/api/flights/${item.id}/status`, { cache: "no-store" }).catch(
        () => {
          refreshedRef.current.delete(item.id);
        },
      );
    }
  }, [items]);

  return null;
}
