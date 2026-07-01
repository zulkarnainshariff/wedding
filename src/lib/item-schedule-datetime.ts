import { applyFlightDatetimeOverrides, resolveFlightSchedule } from "@/lib/flight-datetime";
import { getFlightItemSortTime } from "@/lib/flight-schedule-sort";
import {
  getAccommodationDetails,
  getActivityDetails,
  getCarRentalDetails,
  getPetRelocationDetails,
} from "@/lib/types";

export type ItemScheduleInput = {
  category: string;
  eventDate?: string | null;
  startDatetime?: Date | string | null;
  endDatetime?: Date | string | null;
  details?: unknown;
};

export type ResolvedItemSchedule = {
  startDatetime: Date | null;
  endDatetime: Date | null;
  eventDate: string | null;
};

function parseClock(value?: string | null): { hour: number; minute: number } | null {
  if (!value?.trim()) return null;
  const match = /^(\d{1,2}):(\d{2})/.exec(value.trim());
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

function dateFromInstant(value?: Date | string | null): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Build a Date from YYYY-MM-DD + HH:mm interpreted as a wall-clock instant. */
export function wallClockToDate(dateStr: string, timeStr?: string | null): Date | null {
  if (!dateStr) return null;
  const [year, month, day] = dateStr.split("-").map(Number);
  if ([year, month, day].some((part) => Number.isNaN(part))) return null;

  const clock = parseClock(timeStr);
  if (!clock) {
    return new Date(year, month - 1, day, 12, 0, 0);
  }

  return new Date(year, month - 1, day, clock.hour, clock.minute, 0);
}

function pickInstant(
  explicit: Date | string | null | undefined,
  derived: Date | null,
): Date | null {
  if (explicit) {
    const parsed = explicit instanceof Date ? explicit : new Date(explicit);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return derived;
}

export function resolveItemSchedule(
  input: ItemScheduleInput,
): ResolvedItemSchedule {
  if (input.category === "flight") {
    const schedule = resolveFlightSchedule(input);
    return {
      startDatetime: schedule.startDatetime,
      endDatetime: schedule.endDatetime,
      eventDate: schedule.eventDate,
    };
  }

  const fallbackStart = input.startDatetime
    ? new Date(input.startDatetime)
    : null;
  const fallbackEnd = input.endDatetime ? new Date(input.endDatetime) : null;
  let eventDate =
    input.eventDate ??
    dateFromInstant(fallbackStart) ??
    dateFromInstant(fallbackEnd);

  let derivedStart: Date | null = null;
  let derivedEnd: Date | null = null;

  if (input.category === "car_rental") {
    const details = getCarRentalDetails(input.details);
    if (details && eventDate) {
      derivedStart = wallClockToDate(eventDate, details.pickupTime);
      const returnDate = dateFromInstant(fallbackEnd) ?? eventDate;
      derivedEnd = wallClockToDate(returnDate, details.returnTime);
    }
  }

  if (input.category === "accommodation") {
    const details = getAccommodationDetails(input.details);
    if (details) {
      if (details.checkInDate) {
        eventDate = details.checkInDate;
        derivedStart = wallClockToDate(
          details.checkInDate,
          details.checkInTime,
        );
      }
      if (details.checkOutDate) {
        derivedEnd = wallClockToDate(
          details.checkOutDate,
          details.checkOutTime,
        );
      }
    }
  }

  const activityDetails =
    input.category === "activity" ? getActivityDetails(input.details) : null;
  if (activityDetails?.time && eventDate) {
    derivedStart = wallClockToDate(eventDate, activityDetails.time);
  }

  if (input.category === "pet_relocation") {
    const details = getPetRelocationDetails(input.details);
    if (details && eventDate) {
      derivedStart = wallClockToDate(eventDate, details.departureTime);
      derivedEnd = wallClockToDate(eventDate, details.arrivalTime);
    }
  }

  const startDatetime =
    input.category === "activity" && activityDetails?.time && eventDate
      ? derivedStart
      : pickInstant(
          fallbackStart && !Number.isNaN(fallbackStart.getTime())
            ? fallbackStart
            : null,
          derivedStart,
        );
  const endDatetime = pickInstant(
    fallbackEnd && !Number.isNaN(fallbackEnd.getTime()) ? fallbackEnd : null,
    derivedEnd,
  );

  if (!eventDate && startDatetime) {
    eventDate = dateFromInstant(startDatetime);
  }

  return {
    startDatetime,
    endDatetime,
    eventDate,
  };
}

export function applyItemScheduleOverrides<T extends ItemScheduleInput>(body: T): T {
  const resolved = resolveItemSchedule(body);
  return {
    ...body,
    eventDate: resolved.eventDate ?? body.eventDate ?? null,
    startDatetime:
      resolved.startDatetime?.toISOString() ??
      (typeof body.startDatetime === "string"
        ? body.startDatetime
        : body.startDatetime instanceof Date
          ? body.startDatetime.toISOString()
          : body.startDatetime ?? null),
    endDatetime:
      resolved.endDatetime?.toISOString() ??
      (typeof body.endDatetime === "string"
        ? body.endDatetime
        : body.endDatetime instanceof Date
          ? body.endDatetime.toISOString()
          : body.endDatetime ?? null),
  };
}

/** For flights, keep airport-timezone resolution. */
export function applyItemDatetimeOverrides<T extends ItemScheduleInput>(body: T): T {
  if (body.category === "flight") {
    return applyFlightDatetimeOverrides(body);
  }
  return applyItemScheduleOverrides(body);
}

export function getItemSortTime(item: {
  category: string;
  eventDate?: string | null;
  startDatetime?: Date | string | null;
  endDatetime?: Date | string | null;
  details?: unknown;
}): number {
  if (item.category === "flight") {
    return getFlightItemSortTime(item);
  }

  const schedule = resolveItemSchedule(item);
  const instant = schedule.startDatetime ?? schedule.endDatetime;
  return instant ? instant.getTime() : Number.MAX_SAFE_INTEGER;
}
