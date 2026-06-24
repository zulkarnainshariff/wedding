import type { ItineraryItem } from "@/lib/schema";

export type ItineraryItemWithSubItems = ItineraryItem & {
  subItems?: ItineraryItem[];
};

function sortSubItems(items: ItineraryItem[]): ItineraryItem[] {
  return [...items].sort((a, b) => {
    const order = a.sortOrder - b.sortOrder;
    if (order !== 0) return order;
    if (a.startDatetime && b.startDatetime) {
      return (
        new Date(a.startDatetime).getTime() -
        new Date(b.startDatetime).getTime()
      );
    }
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
    return date.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  }
  return null;
}
