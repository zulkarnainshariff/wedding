import type { ItineraryItem } from "@/lib/schema";
import { getActivityDetails } from "@/lib/types";

function sortDayItems(items: ItineraryItem[]): ItineraryItem[] {
  return [...items].sort((a, b) => {
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
