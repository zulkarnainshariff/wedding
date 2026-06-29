import type { ItineraryDay } from "@/lib/schema";

export type DayJumpTarget = Pick<
  ItineraryDay,
  "id" | "dayNumber" | "title" | "date"
>;

export type DayJumpVariant = "timeline" | "schedule";

export function daySectionId(
  day: DayJumpTarget,
  variant: DayJumpVariant,
): string {
  return variant === "timeline" ? `day-${day.dayNumber}` : `schedule-${day.date}`;
}

export function scrollToDaySection(sectionId: string): void {
  const element = document.getElementById(sectionId);
  if (!element) return;
  element.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function formatDayJumpPrimary(
  day: DayJumpTarget,
  formatDateOnly: (value: string | Date | null | undefined) => string,
): string {
  return `Day ${day.dayNumber} · ${formatDateOnly(day.date)}`;
}

export function formatDayJumpSecondary(day: DayJumpTarget): string | null {
  return day.title?.trim() || null;
}

export function formatDayJumpLabel(
  day: DayJumpTarget,
  formatDateOnly: (value: string | Date | null | undefined) => string,
): string {
  const title = formatDayJumpSecondary(day);
  const primary = formatDayJumpPrimary(day, formatDateOnly);
  return title ? `${primary} · ${title}` : primary;
}
