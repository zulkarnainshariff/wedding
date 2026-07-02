import type { ItineraryItem } from "@/lib/schema";
import { getItemSortTime } from "@/lib/item-schedule-datetime";

export type ItineraryItemWithSubItems = ItineraryItem & {
  subItems?: ItineraryItem[];
  /** Parent item is shown because the user can view a sub-item, not the full parent. */
  limitedView?: boolean;
};

export function sortSubItems(items: ItineraryItem[]): ItineraryItem[] {
  return [...items].sort((a, b) => {
    const aTime = getItemSortTime(a);
    const bTime = getItemSortTime(b);
    if (aTime !== bTime) return aTime - bTime;
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.id - b.id;
  });
}

export function enrichItemsWithSubItems<T extends ItineraryItem>(
  parents: T[],
  children: ItineraryItem[],
): (T & { subItems: ItineraryItem[] })[] {
  const byParent = new Map<number, ItineraryItem[]>();
  for (const child of children) {
    if (child.parentItemId == null) continue;
    const list = byParent.get(child.parentItemId) ?? [];
    list.push(child);
    byParent.set(child.parentItemId, list);
  }

  return parents.map((parent) => ({
    ...parent,
    subItems: sortSubItems(byParent.get(parent.id) ?? []),
  }));
}

export function getSubItemTimeLabel(item: {
  startDatetime: Date | string | null;
  details: unknown;
}): string | null {
  const details =
    item.details && typeof item.details === "object"
      ? (item.details as Record<string, unknown>)
      : {};
  if (typeof details.time === "string" && details.time.trim()) {
    return details.time.trim();
  }
  if (item.startDatetime) {
    const date = new Date(item.startDatetime);
    const hours = date.getUTCHours();
    const minutes = date.getUTCMinutes();
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }
  return null;
}
