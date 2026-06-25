import type { ItineraryItem } from "@/lib/schema";
import { getItemSortTime } from "@/lib/item-schedule-datetime";
import { getActivityDetails } from "@/lib/types";

const NO_TIME = Number.MAX_SAFE_INTEGER;

function hasSortTime(item: ItineraryItem): boolean {
  return getItemSortTime(item) !== NO_TIME;
}

/** Timed items by clock order; untimed items keep editorial sortOrder between them. */
function sortDayItems(items: ItineraryItem[]): ItineraryItem[] {
  const timed = items
    .filter(hasSortTime)
    .sort((a, b) => {
      const timeA = getItemSortTime(a);
      const timeB = getItemSortTime(b);
      if (timeA !== timeB) return timeA - timeB;
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return a.id - b.id;
    });

  const untimed = items
    .filter((item) => !hasSortTime(item))
    .sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return a.id - b.id;
    });

  if (untimed.length === 0) return timed;
  if (timed.length === 0) return untimed;

  const merged: ItineraryItem[] = [];
  let untimedIndex = 0;

  for (const timedItem of timed) {
    while (
      untimedIndex < untimed.length &&
      untimed[untimedIndex].sortOrder < timedItem.sortOrder
    ) {
      merged.push(untimed[untimedIndex]);
      untimedIndex += 1;
    }
    merged.push(timedItem);
  }

  while (untimedIndex < untimed.length) {
    merged.push(untimed[untimedIndex]);
    untimedIndex += 1;
  }

  return merged;
}

function isTravelCategory(category: string): boolean {
  return category === "flight" || category === "pet_relocation";
}

function shouldHideLinkedActivity(
  activity: ItineraryItem,
  byId: Map<number, ItineraryItem>,
): boolean {
  const linkId = getActivityDetails(activity.details)?.linkedItemId;
  if (!linkId) return false;
  const linked = byId.get(linkId);
  return Boolean(linked && isTravelCategory(linked.category));
}

function hiddenNonTravelBookingIds(
  activities: ItineraryItem[],
  byId: Map<number, ItineraryItem>,
): Set<number> {
  const hidden = new Set<number>();
  for (const activity of activities) {
    const linkId = getActivityDetails(activity.details)?.linkedItemId;
    if (!linkId) continue;
    const linked = byId.get(linkId);
    if (linked && !isTravelCategory(linked.category)) {
      hidden.add(linkId);
    }
  }
  return hidden;
}

export function prepareDayItems(items: ItineraryItem[]): ItineraryItem[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  const activities = items.filter((item) => item.category === "activity");
  const hiddenBookings = hiddenNonTravelBookingIds(activities, byId);

  const activitiesToShow = activities.filter(
    (activity) => !shouldHideLinkedActivity(activity, byId),
  );
  const bookingsToShow = items.filter(
    (item) =>
      item.category !== "activity" &&
      (isTravelCategory(item.category) || !hiddenBookings.has(item.id)),
  );

  return sortDayItems([...activitiesToShow, ...bookingsToShow]);
}

/** Daily schedule: activities plus flights/pet relocation, preferring flight cards over linked stubs. */
export function prepareScheduleDayItems(items: ItineraryItem[]): ItineraryItem[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  const activities = items.filter((item) => item.category === "activity");
  const travelItems = items.filter((item) => isTravelCategory(item.category));

  const activitiesToShow = activities.filter(
    (activity) => !shouldHideLinkedActivity(activity, byId),
  );

  return sortDayItems([...activitiesToShow, ...travelItems]);
}
