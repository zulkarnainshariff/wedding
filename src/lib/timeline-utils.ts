import type { ItineraryItem } from "@/lib/schema";
import { getItemSortTime } from "@/lib/item-schedule-datetime";
import { getActivityDetails } from "@/lib/types";

function sortDayItems(items: ItineraryItem[]): ItineraryItem[] {
  return [...items].sort((a, b) => {
    const timeA = getItemSortTime(a);
    const timeB = getItemSortTime(b);
    if (timeA !== timeB) return timeA - timeB;
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.id - b.id;
  });
}

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

  return sortDayItems(visible);
}

/** Daily schedule: activities plus flights/pet relocation, preferring flight cards over linked stubs. */
export function prepareScheduleDayItems(items: ItineraryItem[]): ItineraryItem[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  const activities = items.filter((item) => item.category === "activity");
  const travelItems = items.filter(
    (item) => item.category === "flight" || item.category === "pet_relocation",
  );

  const activitiesToShow = activities.filter((activity) => {
    const linkId = getActivityDetails(activity.details)?.linkedItemId;
    if (!linkId) return true;
    const linked = byId.get(linkId);
    return !(
      linked &&
      (linked.category === "flight" || linked.category === "pet_relocation")
    );
  });

  return sortDayItems([...activitiesToShow, ...travelItems]);
}
