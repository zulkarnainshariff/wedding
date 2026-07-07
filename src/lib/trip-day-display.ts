import type { ItineraryDay } from "@/lib/schema";

export function sortDaysByDate<T extends { date: string }>(days: T[]): T[] {
  return [...days].sort((a, b) => a.date.localeCompare(b.date));
}

/** Trip day label (Day 1, Day 2, …) from calendar order, not placeholder DB numbers. */
export function tripDayDisplayNumber(
  day: Pick<ItineraryDay, "id" | "dayNumber" | "date">,
  allDays: Array<Pick<ItineraryDay, "id" | "date">>,
): number {
  const ordered = sortDaysByDate(allDays);
  const index = ordered.findIndex((entry) => entry.id === day.id);
  if (index >= 0) return index + 1;
  return day.dayNumber >= 900_000 ? 0 : day.dayNumber;
}
