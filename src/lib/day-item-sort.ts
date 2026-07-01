import { getItemSortTime } from "@/lib/item-schedule-datetime";
import type { ItineraryItem } from "@/lib/schema";

export function getItemScheduleSortTime(item: ItineraryItem): number | null {
  const time = getItemSortTime(item);
  return time === Number.MAX_SAFE_INTEGER ? null : time;
}

export function sortDayItems(items: ItineraryItem[]): ItineraryItem[] {
  return [...items].sort((left, right) => {
    const leftTime = getItemScheduleSortTime(left);
    const rightTime = getItemScheduleSortTime(right);

    if (leftTime == null && rightTime == null) {
      return left.sortOrder - right.sortOrder;
    }
    if (leftTime == null) return 1;
    if (rightTime == null) return -1;
    if (leftTime !== rightTime) return leftTime - rightTime;
    return left.sortOrder - right.sortOrder;
  });
}
