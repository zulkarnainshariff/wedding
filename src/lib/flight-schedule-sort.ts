import {
  resolveFlightScheduleForItem,
  type FlightScheduleItem,
} from "@/lib/flight-segment-timing";

export type FlightScheduleSortBy = "arrival" | "departure";

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
  const instant =
    mode === "arrival" ? schedule.endDatetime : schedule.startDatetime;
  return instant?.getTime() ?? Number.MAX_SAFE_INTEGER;
}

export function normalizeFlightScheduleSortBy(
  item: FlightScheduleSortItem,
  requested: FlightScheduleSortBy | null | undefined,
): FlightScheduleSortBy {
  if (!isFlightArrivalOnEventDay(item)) return "departure";
  if (requested === "departure") return "departure";
  return "arrival";
}
