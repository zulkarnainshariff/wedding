import { resolveFlightSchedule } from "@/lib/flight-datetime";
import type { ItineraryItem } from "@/lib/schema";

export type FlightTimingSnapshot = {
  departure?: {
    scheduled?: string | null;
    estimated?: string | null;
    actual?: string | null;
  };
  arrival?: {
    scheduled?: string | null;
    estimated?: string | null;
    actual?: string | null;
  };
  flightStatus?: string;
};

export function parseFlightInstant(value?: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Prefer API when it reports a delay; fall back to itinerary anchor for timezone mismatches. */
export function pickApiScheduleInstant(
  api: Date | null,
  itemAnchor: Date | null,
): Date | null {
  if (!api) return null;
  if (!itemAnchor) return api;
  if (api.getTime() >= itemAnchor.getTime()) return api;
  if (Math.abs(api.getTime() - itemAnchor.getTime()) > 3 * 60 * 60 * 1000) {
    return itemAnchor;
  }
  return api;
}

function getFlightSchedule(item: ItineraryItem) {
  return resolveFlightSchedule({
    eventDate: item.eventDate,
    startDatetime: item.startDatetime,
    endDatetime: item.endDatetime,
    details: item.details,
  });
}

function isFlightActiveInAir(snapshot?: FlightTimingSnapshot): boolean {
  if (!snapshot) return false;
  const status = snapshot.flightStatus?.toLowerCase();
  return status === "active" || status === "en-route";
}

export function pickDepartureInstant(
  item: ItineraryItem,
  snapshot?: FlightTimingSnapshot,
): Date | null {
  const itemStd = getFlightSchedule(item).startDatetime;
  const actual = parseFlightInstant(snapshot?.departure?.actual);
  if (actual) return actual;
  if (itemStd) return itemStd;
  return pickApiScheduleInstant(
    parseFlightInstant(snapshot?.departure?.estimated) ??
      parseFlightInstant(snapshot?.departure?.scheduled),
    itemStd,
  );
}

/** Live ETA from tracking snapshot beats itinerary schedule while still airborne. */
export function pickArrivalInstant(
  item: ItineraryItem,
  snapshot?: FlightTimingSnapshot,
): Date | null {
  const itemSta = getFlightSchedule(item).endDatetime;
  const actual = parseFlightInstant(snapshot?.arrival?.actual);
  if (actual) return actual;

  const estimated = parseFlightInstant(snapshot?.arrival?.estimated);
  if (estimated) {
    return pickApiScheduleInstant(estimated, itemSta);
  }

  const apiScheduled = parseFlightInstant(snapshot?.arrival?.scheduled);
  if (apiScheduled && isFlightActiveInAir(snapshot)) {
    return pickApiScheduleInstant(apiScheduled, itemSta);
  }

  if (itemSta) return itemSta;

  return pickApiScheduleInstant(apiScheduled, itemSta);
}
