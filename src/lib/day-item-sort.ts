import { resolveFlightScheduleForItem } from "@/lib/flight-segment-timing";
import type { ItineraryItem } from "@/lib/schema";

export type FlightDaySortMode = "arrival" | "departure";

export function dayHasFlight(items: ItineraryItem[]): boolean {
  return items.some((item) => item.category === "flight");
}

export function getItemScheduleSortTime(
  item: ItineraryItem,
  mode: FlightDaySortMode,
): number | null {
  if (item.category === "flight") {
    const schedule = resolveFlightScheduleForItem(item);
    const instant =
      mode === "arrival" ? schedule.endDatetime : schedule.startDatetime;
    return instant?.getTime() ?? null;
  }

  if (!item.startDatetime) return null;
  return new Date(item.startDatetime).getTime();
}

export function sortDayItems(
  items: ItineraryItem[],
  mode: FlightDaySortMode,
): ItineraryItem[] {
  if (!dayHasFlight(items)) {
    return items;
  }

  return [...items].sort((left, right) => {
    const leftTime = getItemScheduleSortTime(left, mode);
    const rightTime = getItemScheduleSortTime(right, mode);

    if (leftTime == null && rightTime == null) {
      return left.sortOrder - right.sortOrder;
    }
    if (leftTime == null) return 1;
    if (rightTime == null) return -1;
    if (leftTime !== rightTime) return leftTime - rightTime;
    return left.sortOrder - right.sortOrder;
  });
}
