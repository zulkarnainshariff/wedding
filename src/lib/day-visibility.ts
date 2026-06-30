import type { ItineraryDay, ItineraryItem } from "@/lib/schema";
import { filterPastDays, isDayPast } from "@/lib/trip-time";

export type DayWithItems = ItineraryDay & { items: ItineraryItem[] };

/** Day has no scheduled itinerary items. */
export function isDayWithoutItems(day: Pick<DayWithItems, "items">): boolean {
  return day.items.length === 0;
}

/** Generated day with no title, notes, or items — never customized. */
export function isUntouchedDay(
  day: Pick<DayWithItems, "items" | "title" | "notes">,
): boolean {
  return (
    day.items.length === 0 &&
    !day.title?.trim() &&
    !day.notes?.trim()
  );
}

/** @deprecated Use isDayWithoutItems or isUntouchedDay */
export function isFreeDay(day: Pick<DayWithItems, "items" | "title">): boolean {
  return isDayWithoutItems(day);
}

export type DayVisibilityOptions = {
  effectiveDate: Date;
  hidePast: boolean;
  hideFreeDays: boolean;
  hideUntouchedDays: boolean;
  hiddenDayIds: ReadonlySet<number>;
  forceVisibleDayIds: ReadonlySet<number>;
  showAdminHidden?: boolean;
};

function passesDayFilters(
  day: DayWithItems,
  options: DayVisibilityOptions,
): boolean {
  if (!options.showAdminHidden && day.hidden) return false;
  if (options.hidePast && isDayPast(day.date, options.effectiveDate)) return false;

  if (
    options.hideFreeDays &&
    isDayWithoutItems(day) &&
    !options.forceVisibleDayIds.has(day.id)
  ) {
    return false;
  }

  if (
    options.hideUntouchedDays &&
    isUntouchedDay(day) &&
    !options.forceVisibleDayIds.has(day.id)
  ) {
    return false;
  }

  if (options.hiddenDayIds.has(day.id)) return false;
  return true;
}

export function filterItineraryDays<T extends DayWithItems>(
  days: T[],
  options: DayVisibilityOptions,
): T[] {
  return days.filter((day) => passesDayFilters(day, options));
}

export function isDayVisibleOnPage(
  day: DayWithItems,
  options: DayVisibilityOptions,
): boolean {
  return passesDayFilters(day, options);
}
