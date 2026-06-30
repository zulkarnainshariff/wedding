import type { ItineraryDay, ItineraryItem } from "@/lib/schema";
import { resolveFlightSchedule } from "@/lib/flight-datetime";
import { toDateString } from "@/lib/trip-time";

export function getItemCalendarDate(item: ItineraryItem): string | null {
  if (item.eventDate) return item.eventDate;
  if (item.category === "flight") {
    const resolved = resolveFlightSchedule({
      eventDate: item.eventDate,
      startDatetime: item.startDatetime,
      endDatetime: item.endDatetime,
      details: item.details,
    });
    if (resolved.eventDate) return resolved.eventDate;
  }
  if (item.startDatetime) {
    const start = new Date(item.startDatetime);
    return toDateString(
      new Date(start.getFullYear(), start.getMonth(), start.getDate(), 12, 0, 0),
    );
  }
  return null;
}

export function resolveDayIdForDate(
  days: ItineraryDay[],
  date: string | null,
): number | null {
  if (!date) return null;
  const day = days.find((entry) => entry.date === date);
  return day?.id ?? null;
}

export function normalizeItemSchedule<T extends {
  dayId?: number | null;
  eventDate?: string | null;
  startDatetime?: Date | string | null;
}>(
  item: T,
  days: ItineraryDay[],
): T & { dayId: number | null; eventDate: string | null } {
  let eventDate = item.eventDate ?? null;
  if (!eventDate && item.startDatetime) {
    const start =
      item.startDatetime instanceof Date
        ? item.startDatetime
        : new Date(item.startDatetime);
    eventDate = toDateString(
      new Date(start.getFullYear(), start.getMonth(), start.getDate(), 12, 0, 0),
    );
  }

  const dayId =
    item.dayId ?? (eventDate ? resolveDayIdForDate(days, eventDate) : null);

  return {
    ...item,
    eventDate,
    dayId,
  };
}

export type DayWithItems = ItineraryDay & { items: ItineraryItem[] };

/** Attach items to days by dayId or matching calendar date; add synthetic days for orphans. */
export function buildDaysWithItems(
  days: ItineraryDay[],
  items: ItineraryItem[],
  prepareItems: (items: ItineraryItem[]) => ItineraryItem[],
): DayWithItems[] {
  const dayDates = new Set(days.map((day) => day.date));
  const byDayId = new Map<number, ItineraryItem[]>();
  const orphansByDate = new Map<string, ItineraryItem[]>();

  for (const item of items) {
    const itemDate = getItemCalendarDate(item);
    if (item.dayId != null && days.some((day) => day.id === item.dayId)) {
      const list = byDayId.get(item.dayId) ?? [];
      list.push(item);
      byDayId.set(item.dayId, list);
      continue;
    }

    if (itemDate && dayDates.has(itemDate)) {
      const day = days.find((entry) => entry.date === itemDate);
      if (day) {
        const list = byDayId.get(day.id) ?? [];
        list.push(item);
        byDayId.set(day.id, list);
        continue;
      }
    }

    if (itemDate) {
      const list = orphansByDate.get(itemDate) ?? [];
      list.push(item);
      orphansByDate.set(itemDate, list);
    }
  }

  const linkedDays: DayWithItems[] = days.map((day) => ({
    ...day,
    items: prepareItems(byDayId.get(day.id) ?? []),
  }));

  const syntheticDays: DayWithItems[] = [...orphansByDate.entries()]
    .filter(([date]) => !dayDates.has(date))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, orphanItems], index) => ({
      id: -(index + 1),
      dayNumber: 0,
      date,
      title: "Additional items",
      notes: null,
      hidden: false,
      items: prepareItems(orphanItems),
    }));

  return [...linkedDays, ...syntheticDays].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
}
