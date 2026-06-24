import { getAirportTimezone } from "@/lib/airport-timezones";
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
  eventDate: string | null;
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

function calendarDateInTimezone(instant: Date, timeZone: string): string {
  const parts = zonedParts(instant, timeZone);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
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
    };
  }

  const departureTime = flight.departureTime?.trim() || null;
  const arrivalTime = flight.arrivalTime?.trim() || null;
  const departureTz = getAirportTimezone(flight.fromIata);
  const arrivalTz = getAirportTimezone(flight.toIata);
  const travelDate = input.eventDate ?? fallbackDate(input);

  let startDatetime =
    fallbackStart && !Number.isNaN(fallbackStart.getTime())
      ? fallbackStart
      : null;
  let endDatetime =
    fallbackEnd && !Number.isNaN(fallbackEnd.getTime()) ? fallbackEnd : null;
  let eventDate = travelDate;

  if (travelDate && departureTime && departureTz) {
    const resolvedStart = zonedLocalToUtc(
      travelDate,
      departureTime,
      departureTz,
    );
    if (resolvedStart) {
      startDatetime = resolvedStart;
      eventDate = calendarDateInTimezone(resolvedStart, departureTz);
    }
  }

  if (eventDate && arrivalTime && arrivalTz) {
    const arrivalDate = resolveArrivalDate(
      eventDate,
      departureTime,
      arrivalTime,
    );
    const resolvedEnd = zonedLocalToUtc(arrivalDate, arrivalTime, arrivalTz);
    if (resolvedEnd) {
      endDatetime = resolvedEnd;
    }
  }

  return {
    startDatetime,
    endDatetime,
    eventDate,
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
