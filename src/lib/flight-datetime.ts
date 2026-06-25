import { getAirportTimezone } from "@/lib/airport-timezones";
import type { ItineraryItem } from "@/lib/schema";
import { getFlightDetails } from "@/lib/types";

export type FlightScheduleInput = {
  eventDate?: string | null;
  startDatetime?: Date | string | null;
  endDatetime?: Date | string | null;
  details?: unknown;
};

export type ResolvedFlightSchedule = {
  startDatetime: Date | null;
  endDatetime: Date | null;
  /** Departure-airport calendar date (YYYY-MM-DD). */
  eventDate: string | null;
  /** Arrival-airport calendar date (YYYY-MM-DD), when arrival time is known. */
  arrivalDate: string | null;
};

export type ParsedStoredClock = {
  clock: string;
  embeddedDate: string | null;
};

function parseClockTime(value: string): { hour: number; minute: number } | null {
  const trimmed = value.trim();
  const match = /^(\d{1,2}):(\d{2})$/.exec(trimmed);
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (
    Number.isNaN(hour) ||
    Number.isNaN(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  return { hour, minute };
}

/** Parse HH:mm or YYYY-MM-DDTHH:mm stored clock values — never treat as UTC. */
export function parseStoredClockTime(
  value: string | null | undefined,
): ParsedStoredClock | null {
  if (!value?.trim()) return null;
  const trimmed = value.trim();

  const clockOnly = parseClockTime(trimmed);
  if (clockOnly) {
    return {
      clock: `${String(clockOnly.hour).padStart(2, "0")}:${String(clockOnly.minute).padStart(2, "0")}`,
      embeddedDate: null,
    };
  }

  const dateTimeMatch = /^(\d{4}-\d{2}-\d{2})T(\d{1,2}):(\d{2})/.exec(trimmed);
  if (!dateTimeMatch) return null;

  const hour = Number(dateTimeMatch[2]);
  const minute = Number(dateTimeMatch[3]);
  if (
    Number.isNaN(hour) ||
    Number.isNaN(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  return {
    embeddedDate: dateTimeMatch[1],
    clock: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
  };
}

/** Compact HHmm for PDF output; never returns a raw ISO datetime string. */
export function formatStoredClockForPdf(
  value: string | null | undefined,
): string {
  const parsed = parseStoredClockTime(value);
  if (!parsed) return value?.trim() ? "TBC" : "TBC";
  return parsed.clock.replace(":", "");
}

export function calendarDateInTimezone(instant: Date, timeZone: string): string {
  return calendarDateInTimezoneInternal(instant, timeZone);
}

function addDaysToDateString(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days, 12, 0, 0));
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`;
}

function zonedParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(date);
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);

  return {
    year: pick("year"),
    month: pick("month"),
    day: pick("day"),
    hour: pick("hour"),
    minute: pick("minute"),
  };
}

/** Convert a local clock time at an airport into a UTC instant. */
export function zonedLocalToUtc(
  dateStr: string,
  timeStr: string,
  timeZone: string,
): Date | null {
  const clock = parseClockTime(timeStr);
  if (!clock) return null;

  const [year, month, day] = dateStr.split("-").map(Number);
  if ([year, month, day].some((value) => Number.isNaN(value))) return null;

  const desiredMs = Date.UTC(year, month - 1, day, clock.hour, clock.minute, 0);
  let utcMs = desiredMs;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const actual = zonedParts(new Date(utcMs), timeZone);
    const actualMs = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      0,
    );
    utcMs += desiredMs - actualMs;
  }

  return new Date(utcMs);
}

function calendarDateInTimezoneInternal(instant: Date, timeZone: string): string {
  const parts = zonedParts(instant, timeZone);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

function resolveEndDatetime(
  startDatetime: Date | null,
  eventDate: string | null,
  departureTime: string | null,
  arrivalTime: string | null,
  arrivalTz: string | null | undefined,
): { endDatetime: Date | null; arrivalDate: string | null } {
  const depParsed = parseStoredClockTime(departureTime);
  const arrParsed = parseStoredClockTime(arrivalTime);
  if (!arrParsed?.clock || !arrivalTz) {
    return { endDatetime: null, arrivalDate: null };
  }

  let arrivalDate =
    arrParsed.embeddedDate ??
    (eventDate
      ? resolveArrivalDate(
          eventDate,
          depParsed?.clock ?? departureTime,
          arrParsed.clock,
        )
      : null);

  if (!arrivalDate) {
    return { endDatetime: null, arrivalDate: null };
  }

  let resolvedEnd = zonedLocalToUtc(arrivalDate, arrParsed.clock, arrivalTz);
  let guard = 0;
  while (
    resolvedEnd &&
    startDatetime &&
    resolvedEnd.getTime() <= startDatetime.getTime() &&
    guard < 4
  ) {
    arrivalDate = addDaysToDateString(arrivalDate, 1);
    resolvedEnd = zonedLocalToUtc(arrivalDate, arrParsed.clock, arrivalTz);
    guard += 1;
  }

  if (!resolvedEnd) {
    return { endDatetime: null, arrivalDate: null };
  }

  return {
    endDatetime: resolvedEnd,
    arrivalDate: calendarDateInTimezoneInternal(resolvedEnd, arrivalTz),
  };
}

function resolveArrivalDate(
  departureDate: string,
  departureTime: string | null | undefined,
  arrivalTime: string,
): string {
  if (!departureTime) return departureDate;

  const dep = parseClockTime(departureTime);
  const arr = parseClockTime(arrivalTime);
  if (!dep || !arr) return departureDate;

  const depMinutes = dep.hour * 60 + dep.minute;
  const arrMinutes = arr.hour * 60 + arr.minute;
  if (arrMinutes < depMinutes) {
    return addDaysToDateString(departureDate, 1);
  }

  return departureDate;
}

function fallbackDate(input: FlightScheduleInput): string | null {
  if (input.eventDate) return input.eventDate;
  if (!input.startDatetime) return null;

  const start = new Date(input.startDatetime);
  if (Number.isNaN(start.getTime())) return null;

  const pad = (value: number) => String(value).padStart(2, "0");
  return `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`;
}

/** Resolve flight start/end using departure and arrival airport local times. */
export function resolveFlightSchedule(
  input: FlightScheduleInput,
): ResolvedFlightSchedule {
  const flight = getFlightDetails(input.details);
  const fallbackStart = input.startDatetime
    ? new Date(input.startDatetime)
    : null;
  const fallbackEnd = input.endDatetime ? new Date(input.endDatetime) : null;

  if (!flight) {
    return {
      startDatetime:
        fallbackStart && !Number.isNaN(fallbackStart.getTime())
          ? fallbackStart
          : null,
      endDatetime:
        fallbackEnd && !Number.isNaN(fallbackEnd.getTime()) ? fallbackEnd : null,
      eventDate: input.eventDate ?? fallbackDate(input),
      arrivalDate: null,
    };
  }

  const depParsed = parseStoredClockTime(flight.departureTime);
  const arrParsed = parseStoredClockTime(flight.arrivalTime);
  const departureTime = depParsed?.clock ?? null;
  const arrivalTime = arrParsed?.clock ?? null;
  const departureTz = getAirportTimezone(flight.fromIata ?? flight.from);
  const arrivalTz = getAirportTimezone(flight.toIata ?? flight.to);
  const travelDate = input.eventDate ?? fallbackDate(input);

  let startDatetime =
    fallbackStart && !Number.isNaN(fallbackStart.getTime())
      ? fallbackStart
      : null;
  let endDatetime =
    fallbackEnd && !Number.isNaN(fallbackEnd.getTime()) ? fallbackEnd : null;
  let eventDate = travelDate;
  let arrivalDate: string | null = arrParsed?.embeddedDate ?? null;

  if (travelDate && departureTime && departureTz) {
    const resolvedStart = zonedLocalToUtc(
      travelDate,
      departureTime,
      departureTz,
    );
    if (resolvedStart) {
      startDatetime = resolvedStart;
      eventDate = calendarDateInTimezoneInternal(resolvedStart, departureTz);
    }
  }

  const resolvedEnd = resolveEndDatetime(
    startDatetime,
    eventDate,
    flight.departureTime?.trim() ?? null,
    flight.arrivalTime?.trim() ?? null,
    arrivalTz,
  );
  if (resolvedEnd.endDatetime) {
    endDatetime = resolvedEnd.endDatetime;
    arrivalDate = resolvedEnd.arrivalDate;
  }

  return {
    startDatetime,
    endDatetime,
    eventDate,
    arrivalDate,
  };
}

export function utcToDatetimeLocalInTimezone(
  value: Date | string,
  timeZone: string,
): string {
  const date = typeof value === "string" ? new Date(value) : value;
  const parts = zonedParts(date, timeZone);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`;
}

export function formatInstantInTimezone(
  value: Date | string,
  timeZone: string,
  options?: { hour12?: boolean },
): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("en-GB", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: options?.hour12 ?? false,
  });
}

export function formatFlightEndpointLabel(
  item: ItineraryItem,
  endpoint: "departure" | "arrival",
  options?: { hour12?: boolean },
): string | null {
  if (item.category !== "flight") return null;

  const flight = getFlightDetails(item.details);
  const schedule = resolveFlightSchedule({
    eventDate: item.eventDate,
    startDatetime: item.startDatetime,
    endDatetime: item.endDatetime,
    details: item.details,
  });

  const instant =
    endpoint === "departure" ? schedule.startDatetime : schedule.endDatetime;
  const iata =
    endpoint === "departure"
      ? (flight?.fromIata ?? flight?.from)
      : (flight?.toIata ?? flight?.to);
  const clockTime =
    endpoint === "departure"
      ? flight?.departureTime
      : flight?.arrivalTime;
  const timeZone = getAirportTimezone(iata);
  const code = iata?.trim().toUpperCase();

  if (instant && timeZone) {
    const formatted = formatInstantInTimezone(instant, timeZone, options);
    return code ? `${formatted} (${code})` : formatted;
  }

  const travelDate =
    endpoint === "arrival"
      ? (schedule.arrivalDate ?? schedule.eventDate ?? item.eventDate)
      : (schedule.eventDate ?? item.eventDate);
  if (travelDate && clockTime?.trim()) {
    const dateLabel = new Date(`${travelDate}T12:00:00`).toLocaleDateString(
      "en-GB",
      {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      },
    );
    const timeLabel = formatClockForLabel(clockTime.trim(), options?.hour12);
    return code
      ? `${dateLabel}, ${timeLabel} (${code})`
      : `${dateLabel}, ${timeLabel}`;
  }

  if (instant) {
    const formatted = instant.toLocaleString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: options?.hour12 ?? false,
    });
    return code ? `${formatted} (${code})` : formatted;
  }

  return null;
}

function formatClockForLabel(time: string, hour12?: boolean): string {
  const parsed = parseStoredClockTime(time);
  const clock = parsed
    ? parseClockTime(parsed.clock)
    : parseClockTime(time);
  if (!clock) return "—";

  if (hour12) {
    const period = clock.hour >= 12 ? "PM" : "AM";
    const hour = clock.hour % 12 || 12;
    return `${hour}:${String(clock.minute).padStart(2, "0")} ${period}`;
  }

  return `${String(clock.hour).padStart(2, "0")}:${String(clock.minute).padStart(2, "0")}`;
}

export function formatFlightScheduleLines(
  item: ItineraryItem,
  options?: { hour12?: boolean },
): { departure: string | null; arrival: string | null } {
  if (item.category !== "flight") {
    return { departure: null, arrival: null };
  }

  const departure = formatFlightEndpointLabel(item, "departure", options);
  const arrival = formatFlightEndpointLabel(item, "arrival", options);

  return {
    departure:
      departure ??
      (item.startDatetime
        ? new Date(item.startDatetime).toLocaleString("en-GB", {
            weekday: "short",
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: options?.hour12 ?? false,
          })
        : null),
    arrival:
      arrival ??
      (item.endDatetime
        ? new Date(item.endDatetime).toLocaleString("en-GB", {
            weekday: "short",
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: options?.hour12 ?? false,
          })
        : null),
  };
}

export function flightFormDatetimes(item: ItineraryItem): {
  startDatetime: string;
  endDatetime: string;
} {
  const flight = getFlightDetails(item.details);
  const schedule = resolveFlightSchedule({
    eventDate: item.eventDate,
    startDatetime: item.startDatetime,
    endDatetime: item.endDatetime,
    details: item.details,
  });

  const departureTz = getAirportTimezone(flight?.fromIata ?? flight?.from);
  const arrivalTz = getAirportTimezone(flight?.toIata ?? flight?.to);

  return {
    startDatetime:
      schedule.startDatetime && departureTz
        ? utcToDatetimeLocalInTimezone(schedule.startDatetime, departureTz)
        : "",
    endDatetime:
      schedule.endDatetime && arrivalTz
        ? utcToDatetimeLocalInTimezone(schedule.endDatetime, arrivalTz)
        : "",
  };
}

export function applyFlightDatetimeOverrides<T extends {
  category: string;
  eventDate?: string | null;
  startDatetime?: Date | string | null;
  endDatetime?: Date | string | null;
  details?: unknown;
}>(body: T): T {
  if (body.category !== "flight") return body;

  const resolved = resolveFlightSchedule(body);
  return {
    ...body,
    eventDate: resolved.eventDate ?? body.eventDate ?? null,
    startDatetime: resolved.startDatetime?.toISOString() ?? body.startDatetime ?? null,
    endDatetime: resolved.endDatetime?.toISOString() ?? body.endDatetime ?? null,
  };
}
