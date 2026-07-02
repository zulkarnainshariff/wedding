import { getItemSortTimeForDay } from "@/lib/item-schedule-datetime";
import type { ItineraryItem } from "@/lib/schema";

export function getItemScheduleSortTime(
  item: ItineraryItem,
  dayDate?: string | null,
): number | null {
  const time = getItemSortTimeForDay(item, dayDate);
  return time === Number.MAX_SAFE_INTEGER ? null : time;
}

export function sortDayItems(
  items: ItineraryItem[],
  dayDate?: string | null,
): ItineraryItem[] {
  return [...items].sort((left, right) => {
    const leftTime = getItemScheduleSortTime(left, dayDate);
    const rightTime = getItemScheduleSortTime(right, dayDate);

    if (leftTime == null && rightTime == null) {
      return left.sortOrder - right.sortOrder;
    }
    if (leftTime == null) return 1;
    if (rightTime == null) return -1;
    if (leftTime !== rightTime) return leftTime - rightTime;
    return left.sortOrder - right.sortOrder;
  });
}
