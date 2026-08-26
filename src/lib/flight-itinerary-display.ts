import { resolveAirportCitySync } from "@/lib/airport-cities";
import { getAirportTimezone } from "@/lib/airport-timezones";
import {
  calendarDateInTimezone,
  parseStoredClockTime,
} from "@/lib/flight-datetime";
import {
  formatClockTimeWithPrefs,
} from "@/lib/display-format";
import type { UserPreferences } from "@/lib/user-preferences";
import { formatFlightNumberDisplay } from "@/lib/flight-numbers";
import {
  buildFlightLegDisplayList,
  resolveSegmentSchedule,
  segmentLabel,
} from "@/lib/flight-segment-timing";
import type { ItineraryItem } from "@/lib/schema";
import { getFlightDetails, type FlightSegment } from "@/lib/types";

export type FlightLegSummary = {
  flightNumber: string | null;
  departureLabel: string;
  arrivalLabel: string;
  flightTime: string | null;
  transitAirport: string | null;
  transitLayoverMinutes: number | null;
  connectionMissing?: boolean;
};

function daysBetween(startDate: string, endDate: string): number {
  const start = Date.parse(`${startDate}T12:00:00Z`);
  const end = Date.parse(`${endDate}T12:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end)) return 0;
  return Math.max(0, Math.round((end - start) / 86_400_000));
}

function endpointPlaceLabel(
  segment: FlightSegment,
  endpoint: "from" | "to",
  preferCity = false,
): string {
  const iata = segmentLabel(segment, endpoint);
  const place = endpoint === "from" ? segment.from : segment.to;
  if (preferCity && place?.trim()) {
    const normalized = place.trim();
    if (normalized.toUpperCase() !== iata) return normalized;
  }
  if (preferCity) {
    const city = resolveAirportCitySync(iata);
    if (city) return city;
  }
  return iata;
}

function formatInstantClock(
  instant: Date,
  iata: string | null | undefined,
  preferences: UserPreferences,
): string {
  const timeZone = getAirportTimezone(iata);
  const locale = preferences.timeFormat === "12h" ? "en-US" : "en-GB";
  return instant.toLocaleString(locale, {
    ...(timeZone ? { timeZone } : {}),
    hour: "2-digit",
    minute: "2-digit",
    hour12: preferences.timeFormat === "12h",
  });
}

function formatSegmentClock(
  storedTime: string | null | undefined,
  instant: Date | undefined,
  iata: string | null | undefined,
  preferences: UserPreferences,
): string | null {
  if (instant && !Number.isNaN(instant.getTime())) {
    return formatInstantClock(instant, iata, preferences);
  }

  if (!storedTime?.trim()) return null;

  const parsed = parseStoredClockTime(storedTime);
  if (parsed?.clock) {
    return formatClockTimeWithPrefs(parsed.clock, preferences);
  }

  if (storedTime.includes("T")) {
    const iso = new Date(storedTime);
    if (!Number.isNaN(iso.getTime())) {
      return formatInstantClock(iso, iata, preferences);
    }
  }

  return formatClockTimeWithPrefs(storedTime, preferences);
}

function resolveArrivalDate(
  segment: FlightSegment,
  arrivalInstant: Date | undefined,
): string | null {
  const parsed = parseStoredClockTime(segment.arrivalTime);
  if (parsed?.embeddedDate) return parsed.embeddedDate;
  if (arrivalInstant && !Number.isNaN(arrivalInstant.getTime())) {
    return calendarDateInTimezone(
      arrivalInstant,
      getAirportTimezone(segment.toIata) ?? "UTC",
    );
  }
  return null;
}

export function formatFlightDurationLabel(value?: string | null): string | null {
  if (!value?.trim()) return null;
  const trimmed = value.trim();
  const hoursOnly = /^(\d+)\s*h(?:ours?)?$/i.exec(trimmed);
  if (hoursOnly) {
    const hours = Number(hoursOnly[1]);
    return hours === 1 ? "1 hour" : `${hours} hours`;
  }

  const hoursMinutes = /^(\d+)\s*h(?:ours?)?(?:\s*(\d+)\s*m(?:ins?)?)?$/i.exec(
    trimmed,
  );
  if (hoursMinutes) {
    const hours = Number(hoursMinutes[1]);
    const mins = Number(hoursMinutes[2] ?? 0);
    const hourLabel = hours === 1 ? "1 hour" : `${hours} hours`;
    if (mins <= 0) return hourLabel;
    const minLabel = mins === 1 ? "1 min" : `${mins} mins`;
    return `${hourLabel} ${minLabel}`;
  }

  const minsOnly = /^(\d+)\s*m(?:ins?)?$/i.exec(trimmed);
  if (minsOnly) {
    const mins = Number(minsOnly[1]);
    return mins === 1 ? "1 min" : `${mins} mins`;
  }

  return trimmed;
}

function buildLegSummary(
  segment: FlightSegment,
  windowDep: Date | undefined,
  windowArr: Date | undefined,
  journeyStartDate: string | null,
  preferences: UserPreferences,
): Omit<FlightLegSummary, "transitAirport" | "transitLayoverMinutes"> {
  const fromLabel = endpointPlaceLabel(segment, "from", true);
  const toLabel = endpointPlaceLabel(segment, "to", true);
  const depTime = formatSegmentClock(
    segment.departureTime,
    windowDep,
    segment.fromIata,
    preferences,
  );
  const arrTime = formatSegmentClock(
    segment.arrivalTime,
    windowArr,
    segment.toIata,
    preferences,
  );
  const arrivalDate = resolveArrivalDate(segment, windowArr);
  const daySuffix =
    journeyStartDate && arrivalDate
      ? daysBetween(journeyStartDate, arrivalDate)
      : 0;
  let flightTime = formatFlightDurationLabel(segment.flightTime);
  if (
    !flightTime &&
    windowDep &&
    windowArr &&
    !Number.isNaN(windowDep.getTime()) &&
    !Number.isNaN(windowArr.getTime()) &&
    windowArr.getTime() > windowDep.getTime()
  ) {
    flightTime = formatMinutesAsDurationLabel(
      Math.round((windowArr.getTime() - windowDep.getTime()) / 60_000),
    );
  }

  return {
    flightNumber:
      formatFlightNumberDisplay(
        segment.marketingFlightNumber,
        segment.operatingFlightNumber,
      ) ||
      segment.flightNumber?.trim() ||
      null,
    departureLabel: depTime ? `Dep ${fromLabel}: ${depTime}` : `Dep ${fromLabel}`,
    arrivalLabel: arrTime
      ? `Arrive ${toLabel}: ${arrTime}${daySuffix > 0 ? ` +${daySuffix}` : ""}`
      : `Arrive ${toLabel}`,
    flightTime,
  };
}

export function buildFlightItinerarySummaries(
  item: ItineraryItem,
  preferences: UserPreferences,
): FlightLegSummary[] {
  const details = getFlightDetails(item.details);
  if (!details) return [];

  const legs = buildFlightLegDisplayList(item);
  const resolved = resolveSegmentSchedule(item);
  const journeyStartDate =
    resolved?.eventDate ??
    item.eventDate?.trim().split("T")[0] ??
    null;

  if (legs.length > 0) {
    return legs.map(({ segment, layoverAfter, connectionMissing }, index) => {
      const window = resolved?.windows[index];
      const summary = buildLegSummary(
        segment,
        window?.dep,
        window?.arr,
        journeyStartDate,
        preferences,
      );
      return {
        ...summary,
        transitAirport: layoverAfter?.airport ?? null,
        transitLayoverMinutes: layoverAfter?.layoverMinutes ?? null,
        connectionMissing: Boolean(connectionMissing),
      };
    });
  }

  const summary = buildLegSummary(
    {
      from: details.from ?? undefined,
      to: details.to ?? undefined,
      fromIata: details.fromIata ?? undefined,
      toIata: details.toIata ?? undefined,
      marketingFlightNumber: details.marketingFlightNumber ?? undefined,
      operatingFlightNumber: details.operatingFlightNumber ?? undefined,
      flightNumber: details.flightNumber ?? undefined,
      departureTime: details.departureTime ?? undefined,
      arrivalTime: details.arrivalTime ?? undefined,
      flightTime: details.totalFlightTime ?? details.flightTime ?? undefined,
    },
    resolved?.scheduledStart,
    resolved?.scheduledEnd,
    journeyStartDate,
    preferences,
  );

  return [{ ...summary, transitAirport: null, transitLayoverMinutes: null }];
}

export function formatStoredFlightClock(
  time: string | null | undefined,
  preferences: UserPreferences,
  options?: {
    iata?: string | null;
    journeyStartDate?: string | null;
    preferCity?: string | null;
  },
): string {
  if (!time?.trim()) return "—";

  const parsed = parseStoredClockTime(time);
  const clock = parsed?.clock
    ? formatClockTimeWithPrefs(parsed.clock, preferences)
    : time.includes("T")
      ? (() => {
          const iso = new Date(time);
          return Number.isNaN(iso.getTime())
            ? formatClockTimeWithPrefs(time, preferences)
            : formatInstantClock(iso, options?.iata, preferences);
        })()
      : formatClockTimeWithPrefs(time, preferences);

  if (options?.preferCity && parsed?.embeddedDate && options.journeyStartDate) {
    const daySuffix = daysBetween(options.journeyStartDate, parsed.embeddedDate);
    if (daySuffix > 0) {
      return `${options.preferCity} ${clock} +${daySuffix}`;
    }
    return `${options.preferCity} ${clock}`;
  }

  if (parsed?.embeddedDate && options?.journeyStartDate) {
    const daySuffix = daysBetween(options.journeyStartDate, parsed.embeddedDate);
    if (daySuffix > 0) return `${clock} +${daySuffix}`;
  }

  return clock;
}

function parseDurationToMinutes(value?: string | null): number | null {
  if (!value?.trim()) return null;
  const trimmed = value.trim();
  const hoursMins = /^(\d+)\s*h(?:ours?)?(?:\s*(\d+)\s*m(?:ins?)?)?$/i.exec(
    trimmed,
  );
  if (hoursMins) {
    return Number(hoursMins[1]) * 60 + Number(hoursMins[2] ?? 0);
  }
  const minsOnly = /^(\d+)\s*m(?:ins?)?$/i.exec(trimmed);
  if (minsOnly) return Number(minsOnly[1]);
  return null;
}

function formatMinutesAsDurationLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const parts: string[] = [];
  if (hours > 0) {
    parts.push(hours === 1 ? "1 hour" : `${hours} hours`);
  }
  if (mins > 0) {
    parts.push(mins === 1 ? "1 min" : `${mins} mins`);
  }
  return parts.join(" ") || "0 mins";
}

export function resolveTotalJourneyTimeLabel(item: ItineraryItem): string | null {
  const details = getFlightDetails(item.details);
  if (!details) return null;

  const stored = formatFlightDurationLabel(details.totalFlightTime);
  if (stored) return stored;

  const legs = buildFlightLegDisplayList(item);
  let totalMinutes = 0;
  let hasAny = false;

  for (const leg of legs) {
    const segmentMinutes = parseDurationToMinutes(leg.segment.flightTime);
    if (segmentMinutes != null) {
      totalMinutes += segmentMinutes;
      hasAny = true;
    }
    if (leg.layoverAfter?.layoverMinutes) {
      totalMinutes += leg.layoverAfter.layoverMinutes;
      hasAny = true;
    }
  }

  if (!hasAny) {
    const singleLegMinutes = parseDurationToMinutes(
      details.flightTime ?? details.totalFlightTime,
    );
    if (singleLegMinutes != null) {
      totalMinutes = singleLegMinutes;
      hasAny = true;
    }
  }

  if (!hasAny && item.startDatetime && item.endDatetime) {
    const start = new Date(item.startDatetime).getTime();
    const end = new Date(item.endDatetime).getTime();
    if (end > start) {
      totalMinutes = Math.round((end - start) / 60_000);
      hasAny = true;
    }
  }

  if (!hasAny || totalMinutes <= 0) return null;
  return formatMinutesAsDurationLabel(totalMinutes);
}

export function flightPassengerSummaryParts(
  summary: string | null | undefined,
  routeLine: string | null,
): string[] {
  return flightSummaryExtraParts(summary, routeLine).filter(
    (part) => !/^Dep\s/i.test(part) && !/^Arrive\s/i.test(part),
  );
}

function flightSummaryExtraParts(
  summary: string | null | undefined,
  routeLine: string | null,
): string[] {
  if (!summary) return [];

  const FLIGHT_ROUTE_PART = /^[A-Z]{3}(?:\s*→\s*[A-Z]{3})+$/;

  return summary
    .split(" · ")
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => {
      if (!routeLine) return !FLIGHT_ROUTE_PART.test(part);
      if (part === routeLine) return false;
      return !FLIGHT_ROUTE_PART.test(part);
    });
}
