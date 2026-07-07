import type { ItineraryDay } from "@/lib/schema";

export const DEFAULT_ITINERARY_START_DATE = "2026-07-08";

export function sortDaysByDate<T extends { date: string }>(days: T[]): T[] {
  return [...days].sort((a, b) => a.date.localeCompare(b.date));
}

export function resolveItineraryStartDate(
  itineraryStartDate?: string | null,
): string {
  return itineraryStartDate?.trim() || DEFAULT_ITINERARY_START_DATE;
}

export function isPreparationDay(
  date: string,
  itineraryStartDate?: string | null,
): boolean {
  return date < resolveItineraryStartDate(itineraryStartDate);
}

/** Trip day label (Day 1, Day 2, …) from itinerary start; null for preparation days. */
export function tripDayDisplayNumber(
  day: Pick<ItineraryDay, "id" | "dayNumber" | "date">,
  allDays: Array<Pick<ItineraryDay, "id" | "date">>,
  itineraryStartDate?: string | null,
): number | null {
  const start = resolveItineraryStartDate(itineraryStartDate);
  if (day.date < start) return null;

  const ordered = sortDaysByDate(allDays).filter((entry) => entry.date >= start);
  const index = ordered.findIndex((entry) => entry.id === day.id);
  if (index >= 0) return index + 1;
  return day.dayNumber >= 900_000 ? 0 : day.dayNumber;
}

export function tripDaySubtitle(
  day: Pick<ItineraryDay, "id" | "dayNumber" | "date">,
  allDays: Array<Pick<ItineraryDay, "id" | "date">>,
  itineraryStartDate?: string | null,
): string {
  const displayNumber = tripDayDisplayNumber(day, allDays, itineraryStartDate);
  return displayNumber === null ? "PREPARATION" : `Day ${displayNumber}`;
}
