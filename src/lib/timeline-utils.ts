import type { ItineraryItem } from "@/lib/schema";
import { getActivityDetails } from "@/lib/types";

export function prepareDayItems(items: ItineraryItem[]): ItineraryItem[] {
  const activities = items.filter((item) => item.category === "activity");
  const linkedIds = new Set(
    activities
      .map((item) => getActivityDetails(item.details)?.linkedItemId)
      .filter((id): id is number => id != null),
  );

  const visible = items.filter(
    (item) => item.category === "activity" || !linkedIds.has(item.id),
  );

  return visible.sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    const timeA = a.startDatetime
      ? new Date(a.startDatetime).getTime()
      : Number.MAX_SAFE_INTEGER;
    const timeB = b.startDatetime
      ? new Date(b.startDatetime).getTime()
      : Number.MAX_SAFE_INTEGER;
    if (timeA !== timeB) return timeA - timeB;
    return a.id - b.id;
  });
}
