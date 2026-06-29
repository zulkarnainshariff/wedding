import {
  normalizeEventDate,
  parseStoredClockTime,
  resolveFlightSchedule,
  zonedLocalToUtc,
} from "@/lib/flight-datetime";
import { resolveAirportCitySync } from "@/lib/airport-cities";
import { getAirportTimezone } from "@/lib/airport-timezones";
import type { ItineraryItem } from "@/lib/schema";
import { getFlightDetails, type FlightDetails, type FlightSegment } from "@/lib/types";

export type FlightScheduleItem = Pick<
  ItineraryItem,
  "category" | "eventDate" | "startDatetime" | "endDatetime" | "details"
>;

export type ResolvedSegmentWindow = {
  segment: FlightSegment;
  dep: Date;
  arr: Date;
  fromLabel: string;
  toLabel: string;
};

function addDaysToDateString(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days, 12, 0, 0));
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`;
}

function parseFlightDurationMinutes(value?: string | null): number | null {
  if (!value?.trim()) return null;
  const trimmed = value.trim();
  const hoursMins = /^(\d+)\s*h(?:\s*(\d+)\s*m)?$/i.exec(trimmed);
  if (hoursMins) {
    return Number(hoursMins[1]) * 60 + Number(hoursMins[2] ?? 0);
  }
  const minsOnly = /^(\d+)\s*m$/i.exec(trimmed);
  if (minsOnly) return Number(minsOnly[1]);
  return null;
}

export function segmentLabel(
  segment: FlightSegment,
  endpoint: "from" | "to",
): string {
  if (endpoint === "from") {
    return (
      segment.fromIata?.trim().toUpperCase() ||
      segment.from?.trim().slice(0, 3).toUpperCase() ||
      "DEP"
    );
  }
  return (
    segment.toIata?.trim().toUpperCase() ||
    segment.to?.trim().slice(0, 3).toUpperCase() ||
    "ARR"
  );
}

function calendarDateForInstant(instant: Date, timeZone: string | null): string {
  if (!timeZone) {
    const pad = (value: number) => String(value).padStart(2, "0");
    return `${instant.getFullYear()}-${pad(instant.getMonth() + 1)}-${pad(instant.getDate())}`;
  }
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(instant);
}

function resolveClockInstant(
  clockValue: string | null | undefined,
  timeZone: string | null,
  afterInstant: Date,
  fallbackDate: string | null,
): Date | null {
  const parsed = parseStoredClockTime(clockValue);
  if (!parsed?.clock) return null;

  let date =
    parsed.embeddedDate ??
    (timeZone
      ? calendarDateForInstant(afterInstant, timeZone)
      : fallbackDate) ??
    calendarDateForInstant(afterInstant, null);

  for (let guard = 0; guard < 6; guard += 1) {
    const instant = timeZone
      ? zonedLocalToUtc(date, parsed.clock, timeZone)
      : (() => {
          const [year, month, day] = date.split("-").map(Number);
          const [hour, minute] = parsed.clock.split(":").map(Number);
          return new Date(year, month - 1, day, hour, minute, 0);
        })();

    if (!instant) return null;
    if (instant.getTime() > afterInstant.getTime()) return instant;
    date = addDaysToDateString(date, 1);
  }

  return null;
}

function normalizeSegmentIata(value?: string | null): string | null {
  const code = value?.trim().toUpperCase();
  return code && code.length === 3 ? code : null;
}

/**
 * When a multi-leg booking is split into segments, the first leg often still
 * carries the journey destination (JFK→MEL) instead of the connection airport
 * (JFK→LAX). That makes layovers appear at the final city for ~20 hours.
 */
export function normalizeConnectingFlightSegments(
  segments: FlightSegment[],
): FlightSegment[] {
  if (segments.length < 2) return segments;

  const normalized = segments.map((segment) => ({ ...segment }));
  const finalTo = normalizeSegmentIata(
    normalized[normalized.length - 1].toIata,
  );

  for (let index = 0; index < normalized.length - 1; index += 1) {
    const current = normalized[index];
    const next = normalized[index + 1];
    const currentTo = normalizeSegmentIata(current.toIata);
    const nextFrom = normalizeSegmentIata(next.fromIata);

    if (
      !nextFrom ||
      currentTo === nextFrom ||
      (finalTo && currentTo !== finalTo)
    ) {
      continue;
    }

    normalized[index] = {
      ...current,
      toIata: nextFrom,
      to: next.from ?? resolveAirportCitySync(nextFrom) ?? current.to,
    };
  }

  return normalized;
}

function flightSegmentsFromRawDetails(
  details: FlightDetails | null | undefined,
): FlightSegment[] {
  if (!details?.segments?.length) return [];
  return details.segments.filter(
    (segment) => !segment.transit && (segment.fromIata || segment.from),
  );
}

export function flightSegmentsFromDetails(
  details: FlightDetails | null | undefined,
): FlightSegment[] {
  const segments = flightSegmentsFromRawDetails(details);
  return normalizeConnectingFlightSegments(segments);
}

export function normalizeFlightDetailsSegments(
  details: FlightDetails,
): FlightDetails {
  if (!details.segments?.length) return details;

  const flightSegments = flightSegmentsFromRawDetails(details);
  if (flightSegments.length < 2) return details;

  const normalized = normalizeConnectingFlightSegments(flightSegments);
  let flightIndex = 0;

  const segments = details.segments.map((segment) => {
    if (segment.transit || !(segment.fromIata || segment.from)) {
      return segment;
    }
    const next = normalized[flightIndex];
    flightIndex += 1;
    return next;
  });

  return { ...details, segments };
}

export function isMultiSegmentFlightDetails(
  details: FlightDetails | null | undefined,
): boolean {
  return flightSegmentsFromDetails(details).length >= 2;
}

export function resolveSegmentWindows(
  segments: FlightSegment[],
  journeyStart: Date,
  journeyEnd: Date,
  eventDate: string | null,
): ResolvedSegmentWindow[] {
  const windows: ResolvedSegmentWindow[] = [];

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const fromLabel = segmentLabel(segment, "from");
    const toLabel = segmentLabel(segment, "to");
    const depTz = getAirportTimezone(segment.fromIata);
    const arrTz = getAirportTimezone(segment.toIata);

    let dep: Date;
    if (index === 0) {
      dep = journeyStart;
    } else {
      const previous = windows[index - 1];
      const depFromClock = resolveClockInstant(
        segment.departureTime,
        depTz,
        previous.arr,
        eventDate,
      );
      dep =
        depFromClock && depFromClock.getTime() > previous.arr.getTime()
          ? depFromClock
          : previous.arr;
    }

    let arr: Date | null = null;
    arr = resolveClockInstant(segment.arrivalTime, arrTz, dep, eventDate);

    if (!arr) {
      const durationMinutes = parseFlightDurationMinutes(segment.flightTime);
      if (durationMinutes != null) {
        arr = new Date(dep.getTime() + durationMinutes * 60_000);
      }
    }

    if (!arr) {
      arr = resolveClockInstant(segment.arrivalTime, arrTz, dep, eventDate);
    }

    if (!arr || arr.getTime() <= dep.getTime()) {
      const durationMinutes = parseFlightDurationMinutes(segment.flightTime) ?? 60;
      arr = new Date(dep.getTime() + durationMinutes * 60_000);
    }

    if (
      index === segments.length - 1 &&
      journeyEnd.getTime() > dep.getTime() &&
      arr &&
      journeyEnd.getTime() > arr.getTime() &&
      journeyEnd.getTime() - arr.getTime() <= 6 * 60 * 60_000
    ) {
      arr = journeyEnd;
    } else if (
      index === segments.length - 1 &&
      !arr &&
      journeyEnd.getTime() > dep.getTime()
    ) {
      arr = journeyEnd;
    }

    windows.push({ segment, dep, arr, fromLabel, toLabel });
  }

  return windows;
}

/** Index of the flight leg that should be active for tracking/progress right now. */
export function resolveActiveSegmentIndex(
  windows: ResolvedSegmentWindow[],
  nowMs: number,
): number {
  if (windows.length === 0) return 0;

  for (let index = windows.length - 1; index >= 0; index -= 1) {
    if (nowMs >= windows[index].dep.getTime()) {
      return index;
    }
  }

  return 0;
}

function parseStoredInstant(
  value: Date | string | null | undefined,
): Date | null {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function resolveJourneyStartFromFirstSegment(
  segment: FlightSegment,
  eventDate: string | null,
  fallbackStart: Date | null,
): Date {
  const depTz = getAirportTimezone(segment.fromIata);
  const depClock = parseStoredClockTime(segment.departureTime);
  if (eventDate && depClock?.clock && depTz) {
    const instant = zonedLocalToUtc(eventDate, depClock.clock, depTz);
    if (instant) return instant;
  }
  return fallbackStart ?? new Date();
}

function readTrackingDeparture(details: unknown): Date | null {
  if (!details || typeof details !== "object") return null;
  const raw = (details as Record<string, unknown>)._flightTracking;
  if (!raw || typeof raw !== "object") return null;
  const departure = (
    raw as {
      snapshot?: {
        departure?: {
          actual?: string | null;
          estimated?: string | null;
          scheduled?: string | null;
        };
      };
    }
  ).snapshot?.departure;
  for (const value of [
    departure?.actual,
    departure?.estimated,
    departure?.scheduled,
  ]) {
    if (!value) continue;
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

/** Correct journey start when event_date was bumped to a later connection day. */
function resolveAnchoredJourneyStart(
  item: FlightScheduleItem,
  segments: FlightSegment[],
  eventDate: string | null,
  fallbackStart: Date | null,
): { scheduledStart: Date; eventDate: string | null } {
  const firstSegment = segments[0];
  const depTz = getAirportTimezone(firstSegment.fromIata);
  const fromStoredDate = resolveJourneyStartFromFirstSegment(
    firstSegment,
    eventDate,
    fallbackStart,
  );

  const trackingDep = readTrackingDeparture(item.details);
  if (trackingDep && depTz) {
    const trackingTravelDate = calendarDateForInstant(trackingDep, depTz);
    const fromTrackingDate = resolveJourneyStartFromFirstSegment(
      firstSegment,
      trackingTravelDate,
      trackingDep,
    );

    if (
      fromTrackingDate.getTime() + 12 * 60 * 60_000 <
      fromStoredDate.getTime()
    ) {
      return {
        scheduledStart: fromTrackingDate,
        eventDate: trackingTravelDate,
      };
    }

    const nowMs = Date.now();
    if (
      fromStoredDate.getTime() > nowMs + 2 * 60 * 60_000 &&
      trackingDep.getTime() <= nowMs
    ) {
      return {
        scheduledStart:
          fromTrackingDate.getTime() < fromStoredDate.getTime()
            ? fromTrackingDate
            : trackingDep,
        eventDate: trackingTravelDate ?? eventDate,
      };
    }
  }

  return { scheduledStart: fromStoredDate, eventDate };
}

function topLevelDestinationMatchesFinal(
  details: unknown,
  segments: FlightSegment[],
): boolean {
  const flightDetails = getFlightDetails(details);
  const finalIata = segmentLabel(segments[segments.length - 1], "to");
  const topTo = flightDetails?.toIata?.trim().toUpperCase();
  return !topTo || topTo === finalIata;
}

/** Segment-derived journey bounds — ignores stale top-level route fields from live API. */
export function resolveMultiSegmentJourneyBounds(
  item: FlightScheduleItem,
  segments: FlightSegment[],
): { scheduledStart: Date; scheduledEnd: Date; eventDate: string | null } {
  const storedEventDate =
    normalizeEventDate(item.eventDate) ??
    normalizeEventDate(item.startDatetime);
  const fallbackStart = parseStoredInstant(item.startDatetime);
  const fallbackEnd = parseStoredInstant(item.endDatetime);

  const { scheduledStart, eventDate } = resolveAnchoredJourneyStart(
    item,
    segments,
    storedEventDate,
    fallbackStart,
  );

  const provisionalEnd = new Date(scheduledStart.getTime() + 48 * 60 * 60_000);
  const windows = resolveSegmentWindows(
    segments,
    scheduledStart,
    provisionalEnd,
    eventDate ?? storedEventDate,
  );
  let scheduledEnd = windows[windows.length - 1].arr;

  if (
    fallbackEnd &&
    fallbackEnd.getTime() > scheduledStart.getTime() &&
    topLevelDestinationMatchesFinal(item.details, segments)
  ) {
    const lastTz = getAirportTimezone(segments[segments.length - 1].toIata);
    const storedArrivalDate = lastTz
      ? calendarDateForInstant(fallbackEnd, lastTz)
      : null;
    const computedArrivalDate = lastTz
      ? calendarDateForInstant(scheduledEnd, lastTz)
      : null;

    if (
      storedArrivalDate &&
      computedArrivalDate &&
      storedArrivalDate > computedArrivalDate
    ) {
      scheduledEnd = fallbackEnd;
    } else if (
      fallbackEnd.getTime() > windows[0].arr.getTime() &&
      fallbackEnd.getTime() - scheduledEnd.getTime() <= 6 * 60 * 60_000
    ) {
      scheduledEnd = fallbackEnd;
    }
  }

  return { scheduledStart, scheduledEnd, eventDate };
}

export function resolveFlightScheduleForItem(
  item: FlightScheduleItem,
): ReturnType<typeof resolveFlightSchedule> {
  const flightDetails = getFlightDetails(item.details);
  const segments = flightSegmentsFromDetails(flightDetails);

  if (segments.length >= 2) {
    const bounds = resolveMultiSegmentJourneyBounds(item, segments);
    const lastTz = getAirportTimezone(segments[segments.length - 1].toIata);
    return {
      startDatetime: bounds.scheduledStart,
      endDatetime: bounds.scheduledEnd,
      eventDate: bounds.eventDate,
      arrivalDate: calendarDateForInstant(bounds.scheduledEnd, lastTz),
    };
  }

  return resolveFlightSchedule({
    eventDate: item.eventDate,
    startDatetime: item.startDatetime,
    endDatetime: item.endDatetime,
    details: item.details,
  });
}

export function syncMultiSegmentRouteFields(
  details: FlightDetails,
): FlightDetails {
  const normalizedDetails = normalizeFlightDetailsSegments(details);
  const segments = flightSegmentsFromDetails(normalizedDetails);
  if (segments.length < 2) return normalizedDetails;

  const first = segments[0];
  const last = segments[segments.length - 1];

  return {
    ...normalizedDetails,
    from: first.from ?? normalizedDetails.from,
    to: last.to ?? normalizedDetails.to,
    fromIata: first.fromIata ?? normalizedDetails.fromIata,
    toIata: last.toIata ?? normalizedDetails.toIata,
  };
}

export function resolveSegmentSchedule(
  item: FlightScheduleItem,
): {
  segments: FlightSegment[];
  windows: ResolvedSegmentWindow[];
  scheduledStart: Date;
  scheduledEnd: Date;
  eventDate: string | null;
} | null {
  if (item.category !== "flight") return null;

  const schedule = resolveFlightScheduleForItem(item);

  if (!schedule.startDatetime || !schedule.endDatetime) return null;

  const flightDetails = getFlightDetails(item.details);
  const segments = flightSegmentsFromDetails(flightDetails);
  if (segments.length === 0) return null;

  const windows = resolveSegmentWindows(
    segments,
    schedule.startDatetime,
    schedule.endDatetime,
    schedule.eventDate,
  );

  return {
    segments,
    windows,
    scheduledStart: schedule.startDatetime,
    scheduledEnd: schedule.endDatetime,
    eventDate: schedule.eventDate,
  };
}

export type FlightLegLayover = {
  airport: string;
  layoverMinutes: number;
  departureAtMs: number;
};

export type FlightLegDisplay = {
  segment: FlightSegment;
  segmentIndex: number;
  layoverAfter: FlightLegLayover | null;
};

/** Flight legs only, with layovers derived from segment arrival → next departure. */
export function buildFlightLegDisplayList(
  item: FlightScheduleItem,
): FlightLegDisplay[] {
  const flightDetails = getFlightDetails(item.details);
  const segments = flightSegmentsFromDetails(flightDetails);
  if (segments.length === 0) return [];

  const resolved = resolveSegmentSchedule(item);
  if (!resolved || segments.length === 1) {
    return segments.map((segment, segmentIndex) => ({
      segment,
      segmentIndex,
      layoverAfter: null,
    }));
  }

  const { windows } = resolved;
  return segments.map((segment, index) => {
    if (index >= windows.length - 1) {
      return { segment, segmentIndex: index, layoverAfter: null };
    }

    const current = windows[index];
    const next = windows[index + 1];
    const layoverMinutes = Math.round(
      (next.dep.getTime() - current.arr.getTime()) / 60_000,
    );

    return {
      segment,
      segmentIndex: index,
      layoverAfter:
        layoverMinutes > 0
          ? {
              airport:
                current.toLabel === next.fromLabel
                  ? current.toLabel
                  : next.fromLabel,
              layoverMinutes: Math.max(1, layoverMinutes),
              departureAtMs: next.dep.getTime(),
            }
          : null,
    };
  });
}

/** Departure/arrival IATA codes for the leg that should be queried live right now. */
export function resolveTrackingLegEndpoints(
  item: FlightScheduleItem,
  now = new Date(),
): {
  depIata: string;
  arrIata: string;
  segmentIndex: number;
} | null {
  const resolved = resolveSegmentSchedule(item);
  if (!resolved) return null;

  const { segments, windows } = resolved;
  if (segments.length < 2) {
    const first = segments[0];
    const depIata = first.fromIata?.trim().toUpperCase();
    const arrIata = first.toIata?.trim().toUpperCase();
    if (!depIata || !arrIata) return null;
    return { depIata, arrIata, segmentIndex: 0 };
  }

  const segmentIndex = resolveActiveSegmentIndex(windows, now.getTime());
  const segment = segments[segmentIndex];
  const depIata = segment.fromIata?.trim().toUpperCase();
  const arrIata = segment.toIata?.trim().toUpperCase();
  if (!depIata || !arrIata) return null;

  return { depIata, arrIata, segmentIndex };
}

/** True when a tracking ETA belongs to an intermediate stop, not the final destination. */
export function isIntermediateArrivalInstant(
  instant: Date,
  windows: ResolvedSegmentWindow[],
  journeyEndMs: number,
  nowMs?: number,
): boolean {
  if (windows.length < 2) return false;

  const finalWindow = windows[windows.length - 1];
  if (instant.getTime() < finalWindow.dep.getTime() - 15 * 60_000) {
    return true;
  }

  if (nowMs != null && nowMs >= finalWindow.dep.getTime()) {
    if (instant.getTime() < finalWindow.dep.getTime() + 30 * 60_000) {
      return true;
    }
    if (instant.getTime() < journeyEndMs - 2 * 60 * 60_000) {
      return true;
    }
  }

  if (instant.getTime() < journeyEndMs - 3 * 60 * 60_000) {
    return true;
  }

  return false;
}
