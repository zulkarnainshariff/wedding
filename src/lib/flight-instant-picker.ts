import { resolveFlightSchedule } from "@/lib/flight-datetime";
import {
  flightSegmentsFromDetails,
  isIntermediateArrivalInstant,
  isMultiSegmentFlightDetails,
  resolveActiveSegmentIndex,
  resolveFlightScheduleForItem,
  resolveSegmentWindows,
} from "@/lib/flight-segment-timing";
import type { ItineraryItem } from "@/lib/schema";
import { getFlightDetails } from "@/lib/types";

type FlightScheduleFields = Pick<
  ItineraryItem,
  "eventDate" | "startDatetime" | "endDatetime" | "details"
>;

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

function getFlightSchedule(item: FlightScheduleFields) {
  return resolveFlightScheduleForItem({
    category: "flight",
    ...item,
  });
}

function isFlightActiveInAir(snapshot?: FlightTimingSnapshot): boolean {
  if (!snapshot) return false;
  const status = snapshot.flightStatus?.toLowerCase();
  return status === "active" || status === "en-route";
}

function resolveMultiSegmentContext(item: FlightScheduleFields, now = new Date()) {
  const schedule = getFlightSchedule(item);
  if (!schedule.startDatetime || !schedule.endDatetime) return null;

  const segments = flightSegmentsFromDetails(getFlightDetails(item.details));
  if (segments.length < 2) return null;

  const windows = resolveSegmentWindows(
    segments,
    schedule.startDatetime,
    schedule.endDatetime,
    schedule.eventDate,
  );

  const activeIndex = resolveActiveSegmentIndex(windows, now.getTime());
  return {
    schedule,
    windows,
    activeIndex,
    activeWindow: windows[activeIndex],
  };
}

export function pickDepartureInstant(
  item: FlightScheduleFields,
  snapshot?: FlightTimingSnapshot,
  now = new Date(),
): Date | null {
  const itemStd = getFlightSchedule(item).startDatetime;
  const multiSegment = resolveMultiSegmentContext(item, now);

  if (multiSegment && multiSegment.activeIndex > 0) {
    const actual = parseFlightInstant(snapshot?.departure?.actual);
    const previousArr =
      multiSegment.windows[multiSegment.activeIndex - 1]?.arr ?? null;
    if (
      actual &&
      (!previousArr || actual.getTime() >= previousArr.getTime() - 30 * 60_000)
    ) {
      return actual;
    }
    return multiSegment.activeWindow.dep;
  }

  const actual = parseFlightInstant(snapshot?.departure?.actual);
  if (actual) return actual;
  if (itemStd) return itemStd;
  return pickApiScheduleInstant(
    parseFlightInstant(snapshot?.departure?.estimated) ??
      parseFlightInstant(snapshot?.departure?.scheduled),
    itemStd,
  );
}

function isMultiSegmentFlight(item: FlightScheduleFields): boolean {
  return isMultiSegmentFlightDetails(getFlightDetails(item.details));
}

/** Live ETA from tracking snapshot beats itinerary schedule while still airborne. */
export function pickArrivalInstant(
  item: FlightScheduleFields,
  snapshot?: FlightTimingSnapshot,
  now = new Date(),
): Date | null {
  const schedule = getFlightSchedule(item);
  const itemSta = schedule.endDatetime;
  const actual = parseFlightInstant(snapshot?.arrival?.actual);
  const multiSegment = isMultiSegmentFlight(item);
  const segmentContext = multiSegment
    ? resolveMultiSegmentContext(item, now)
    : null;
  const onFinalLeg =
    segmentContext != null &&
    segmentContext.activeIndex === segmentContext.windows.length - 1;
  const activeLegAnchor = segmentContext?.activeWindow.arr ?? itemSta;

  if (actual) {
    if (
      multiSegment &&
      itemSta &&
      isIntermediateArrivalInstant(
        actual,
        segmentContext!.windows,
        itemSta.getTime(),
        now.getTime(),
      )
    ) {
      // Ignore intermediate-leg arrivals (e.g. NRT) on connecting itineraries.
    } else {
      return actual;
    }
  }

  const estimated = parseFlightInstant(snapshot?.arrival?.estimated);
  if (estimated) {
    if (
      multiSegment &&
      itemSta &&
      isIntermediateArrivalInstant(
        estimated,
        segmentContext!.windows,
        itemSta.getTime(),
        now.getTime(),
      )
    ) {
      if (onFinalLeg) {
        return itemSta;
      }
      return pickApiScheduleInstant(estimated, activeLegAnchor);
    }
    if (
      multiSegment &&
      itemSta &&
      estimated.getTime() < itemSta.getTime() - 3 * 60 * 60_000 &&
      !isFlightActiveInAir(snapshot)
    ) {
      return itemSta;
    }
    return pickApiScheduleInstant(estimated, onFinalLeg ? itemSta : activeLegAnchor);
  }

  const apiScheduled = parseFlightInstant(snapshot?.arrival?.scheduled);
  if (apiScheduled && isFlightActiveInAir(snapshot)) {
    if (
      multiSegment &&
      itemSta &&
      isIntermediateArrivalInstant(
        apiScheduled,
        segmentContext!.windows,
        itemSta.getTime(),
        now.getTime(),
      )
    ) {
      return onFinalLeg ? itemSta : pickApiScheduleInstant(apiScheduled, activeLegAnchor);
    }
    return pickApiScheduleInstant(apiScheduled, itemSta);
  }

  if (itemSta) return itemSta;

  return pickApiScheduleInstant(apiScheduled, itemSta);
}
