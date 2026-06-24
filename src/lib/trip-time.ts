import type { ItineraryDay, ItineraryItem } from "@/lib/schema";

export function parseTripDate(dateStr: string): Date {
  return new Date(`${dateStr}T12:00:00`);
}

export function toDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getTodayDate(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
}

export function getEffectiveDate(
  devMode: boolean,
  simulatedDate: string | null,
): Date {
  if (devMode && simulatedDate) {
    return parseTripDate(simulatedDate);
  }
  return getTodayDate();
}

export function isDayPast(dayDate: string, effectiveDate: Date): boolean {
  return dayDate < toDateString(effectiveDate);
}

export function isDayToday(dayDate: string, effectiveDate: Date): boolean {
  return dayDate === toDateString(effectiveDate);
}

export function filterPastDays<T extends { date: string }>(
  days: T[],
  effectiveDate: Date,
  hidePast: boolean,
): T[] {
  if (!hidePast) return days;
  const cutoff = toDateString(effectiveDate);
  return days.filter((day) => day.date >= cutoff);
}

export function isItemPast(
  item: ItineraryItem,
  effectiveDate: Date,
): boolean {
  const cutoff = toDateString(effectiveDate);

  if (item.endDatetime) {
    const end = new Date(item.endDatetime);
    const endDay = toDateString(
      new Date(end.getFullYear(), end.getMonth(), end.getDate(), 12, 0, 0),
    );
    return endDay < cutoff;
  }

  if (item.startDatetime) {
    const start = new Date(item.startDatetime);
    return toDateString(start) < cutoff;
  }

  if (item.eventDate) {
    return item.eventDate < cutoff;
  }

  return false;
}

export function filterPastItems(
  items: ItineraryItem[],
  effectiveDate: Date,
  hidePast: boolean,
): ItineraryItem[] {
  if (!hidePast) return items;
  return items.filter((item) => !isItemPast(item, effectiveDate));
}

export type TripProgress = {
  startDate: string;
  endDate: string;
  currentDate: string;
  currentDayNumber: number;
  totalDays: number;
  progressPercent: number;
  status: "upcoming" | "in-progress" | "complete";
  currentDayTitle: string | null;
  daysUntilStart: number | null;
};

export function formatDaysUntilStart(days: number): string {
  if (days === 1) return "1 day to go";
  return `${days} days to go`;
}

export function computeTripProgress(
  days: Pick<ItineraryDay, "date" | "dayNumber" | "title">[],
  effectiveDate: Date,
): TripProgress | null {
  if (days.length === 0) return null;

  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const startDate = sorted[0].date;
  const endDate = sorted[sorted.length - 1].date;
  const currentDate = toDateString(effectiveDate);
  const startMs = parseTripDate(startDate).getTime();
  const endMs = parseTripDate(endDate).getTime();
  const currentMs = effectiveDate.getTime();

  let status: TripProgress["status"];
  if (currentMs < startMs) status = "upcoming";
  else if (currentMs > endMs) status = "complete";
  else status = "in-progress";

  const progressPercent =
    status === "upcoming"
      ? 0
      : status === "complete"
        ? 100
        : Math.min(
            100,
            Math.max(0, ((currentMs - startMs) / (endMs - startMs)) * 100),
          );

  const todayIndex = sorted.findIndex((day) => day.date === currentDate);
  let currentDayNumber: number;
  let currentDay: (typeof sorted)[number] | undefined;

  if (todayIndex >= 0) {
    currentDayNumber = todayIndex + 1;
    currentDay = sorted[todayIndex];
  } else if (status === "upcoming") {
    currentDayNumber = 0;
    currentDay = sorted[0];
  } else if (status === "complete") {
    currentDayNumber = sorted.length;
    currentDay = sorted[sorted.length - 1];
  } else {
    const nextIndex = sorted.findIndex((day) => day.date > currentDate);
    currentDayNumber = nextIndex >= 0 ? nextIndex + 1 : sorted.length;
    currentDay = sorted[nextIndex >= 0 ? nextIndex : sorted.length - 1];
  }

  return {
    startDate,
    endDate,
    currentDate,
    currentDayNumber,
    totalDays: sorted.length,
    progressPercent,
    status,
    currentDayTitle: currentDay?.title ?? null,
    daysUntilStart:
      status === "upcoming"
        ? Math.round((startMs - currentMs) / (24 * 60 * 60 * 1000))
        : null,
  };
}
