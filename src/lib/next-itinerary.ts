import { isItemCompleted } from "@/lib/item-completion";
import { resolveFlightScheduleForItem } from "@/lib/flight-segment-timing";
import type { ItineraryItem } from "@/lib/schema";
import type { ItineraryItemWithSubItems } from "@/lib/item-subitem-utils";

function itemTimeBounds(item: ItineraryItem): {
  start: Date | null;
  end: Date | null;
} {
  if (item.category === "flight") {
    const schedule = resolveFlightScheduleForItem(item);
    return {
      start: schedule.startDatetime,
      end: schedule.endDatetime,
    };
  }

  const start = item.startDatetime ? new Date(item.startDatetime) : null;
  const end = item.endDatetime
    ? new Date(item.endDatetime)
    : start;
  return { start, end };
}

function flattenScheduleItems(
  items: ItineraryItemWithSubItems[],
): ItineraryItem[] {
  const flattened: ItineraryItem[] = [];
  for (const item of items) {
    flattened.push(item);
    for (const subItem of item.subItems ?? []) {
      flattened.push(subItem);
    }
  }
  return flattened;
}

export function findNextItineraryItem(
  items: ItineraryItemWithSubItems[],
  now: Date,
): ItineraryItem | null {
  let best: { item: ItineraryItem; start: Date } | null = null;

  for (const item of flattenScheduleItems(items)) {
    if (isItemCompleted(item)) continue;

    const { start, end } = itemTimeBounds(item);
    if (!start) continue;

    const effectiveEnd = end ?? start;
    if (effectiveEnd.getTime() < now.getTime()) continue;

    if (!best || start.getTime() < best.start.getTime()) {
      best = { item, start };
    }
  }

  return best?.item ?? null;
}
