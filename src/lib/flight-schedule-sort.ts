import { parseStoredClockTime } from "@/lib/flight-datetime";
import {
  resolveFlightScheduleForItem,
  type FlightScheduleItem,
} from "@/lib/flight-segment-timing";
import { getFlightDetails } from "@/lib/types";

export type FlightScheduleSortBy = "arrival" | "departure";

function wallClockSortMs(dateStr: string, clock: string): number | null {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hour, minute] = clock.split(":").map(Number);
  if (
    [year, month, day, hour, minute].some((part) => Number.isNaN(part)) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  return new Date(Date.UTC(year, month - 1, day, hour, minute, 0)).getTime();
}

function instantWallClockSortMs(instant: Date): number {
  const pad = (value: number) => String(value).padStart(2, "0");
  const date = `${instant.getUTCFullYear()}-${pad(instant.getUTCMonth() + 1)}-${pad(instant.getUTCDate())}`;
  const clock = `${pad(instant.getUTCHours())}:${pad(instant.getUTCMinutes())}`;
  return wallClockSortMs(date, clock) ?? instant.getTime();
}

function toFlightScheduleItem(item: FlightScheduleSortItem): FlightScheduleItem {
  return {
    category: item.category,
    eventDate: item.eventDate ?? null,
    startDatetime:
      item.startDatetime instanceof Date
        ? item.startDatetime
        : item.startDatetime
          ? new Date(item.startDatetime)
          : null,
    endDatetime:
      item.endDatetime instanceof Date
        ? item.endDatetime
        : item.endDatetime
          ? new Date(item.endDatetime)
          : null,
    details: item.details,
  };
}

export function extractFlightScheduleSortBy(
  details: unknown,
): FlightScheduleSortBy | null {
  if (!details || typeof details !== "object") return null;
  const raw = (details as Record<string, unknown>).scheduleSortBy;
  if (raw === "arrival" || raw === "departure") return raw;
  return null;
}

export type FlightScheduleSortItem = {
  category: string;
  eventDate?: string | null;
  startDatetime?: Date | string | null;
  endDatetime?: Date | string | null;
  details?: unknown;
};

export function isFlightArrivalOnEventDay(item: FlightScheduleSortItem): boolean {
  if (item.category !== "flight") return true;

  const schedule = resolveFlightScheduleForItem(toFlightScheduleItem(item));
  const eventDay = schedule.eventDate ?? item.eventDate;
  const arrivalDay = schedule.arrivalDate;
  if (!eventDay || !arrivalDay) return true;
  return eventDay === arrivalDay;
}

export function getEffectiveFlightScheduleSortBy(
  item: FlightScheduleSortItem,
): FlightScheduleSortBy {
  if (!isFlightArrivalOnEventDay(item)) return "departure";

  const stored = extractFlightScheduleSortBy(item.details);
  return stored === "departure" ? "departure" : "arrival";
}

export function getFlightItemSortTime(item: FlightScheduleSortItem): number {
  const schedule = resolveFlightScheduleForItem(toFlightScheduleItem(item));
  const mode = getEffectiveFlightScheduleSortBy(item);
  const flight = getFlightDetails(item.details);

  if (mode === "arrival") {
    const parsed = parseStoredClockTime(flight?.arrivalTime);
    const date =
      schedule.arrivalDate ??
      parsed?.embeddedDate ??
      schedule.eventDate ??
      item.eventDate;
    if (date && parsed?.clock) {
      const sortMs = wallClockSortMs(date, parsed.clock);
      if (sortMs != null) return sortMs;
    }
    if (schedule.endDatetime) {
      return instantWallClockSortMs(schedule.endDatetime);
    }
  } else {
    const parsed = parseStoredClockTime(flight?.departureTime);
    const date =
      schedule.eventDate ?? parsed?.embeddedDate ?? item.eventDate;
    if (date && parsed?.clock) {
      const sortMs = wallClockSortMs(date, parsed.clock);
      if (sortMs != null) return sortMs;
    }
    if (schedule.startDatetime) {
      return instantWallClockSortMs(schedule.startDatetime);
    }
  }

  return Number.MAX_SAFE_INTEGER;
}

export function normalizeFlightScheduleSortBy(
  item: FlightScheduleSortItem,
  requested: FlightScheduleSortBy | null | undefined,
): FlightScheduleSortBy {
  if (!isFlightArrivalOnEventDay(item)) return "departure";
  if (requested === "departure") return "departure";
  return "arrival";
}
