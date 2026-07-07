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
  return variant === "timeline" ? `day-${day.date}` : `schedule-${day.date}`;
}

export function adminDayRowId(dayId: number): string {
  return `admin-day-${dayId}`;
}

export function adminUserRowId(userId: number): string {
  return `admin-user-${userId}`;
}

export function adminDayEditSectionId(): string {
  return "admin-day-edit-section";
}

export function adminItemEditSectionId(): string {
  return "admin-item-edit-section";
}

export function taskEditSectionId(): string {
  return "task-edit-section";
}

export function taskRowId(taskId: number): string {
  return `task-row-${taskId}`;
}

export function itemSectionId(itemId: number): string {
  return `item-${itemId}`;
}

export function scrollToDaySection(sectionId: string): void {
  scrollToElementById(sectionId);
}

export function scrollToElementById(sectionId: string): void {
  const element = document.getElementById(sectionId);
  if (!element) return;

  // Use the outermost scrollable ancestor (e.g. PageShell), not inner SectionShell panels.
  let scrollParent: HTMLElement | null = null;
  let node: HTMLElement | null = element.parentElement;
  while (node) {
    const { overflowY } = getComputedStyle(node);
    if (overflowY === "auto" || overflowY === "scroll") {
      scrollParent = node;
    }
    node = node.parentElement;
  }

  if (scrollParent) {
    const offset = 0;
    const parentTop = scrollParent.getBoundingClientRect().top;
    const elementTop = element.getBoundingClientRect().top;
    scrollParent.scrollTo({
      behavior: "smooth",
      top: scrollParent.scrollTop + (elementTop - parentTop) - offset,
    });
    return;
  }

  element.scrollIntoView({ behavior: "smooth", block: "center" });
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

export function dayJumpCalendarBounds(
  days: DayJumpTarget[],
): { min: string; max: string } | null {
  if (days.length === 0) return null;
  const sorted = [...days].sort((left, right) => left.date.localeCompare(right.date));
  return { min: sorted[0].date, max: sorted[sorted.length - 1].date };
}

export function findDayJumpTargetByDate(
  days: DayJumpTarget[],
  date: string,
): DayJumpTarget | null {
  const trimmed = date.trim();
  if (!trimmed) return null;

  const exact = days.find((day) => day.date === trimmed);
  if (exact) return exact;

  const targetMs = Date.parse(`${trimmed}T12:00:00Z`);
  if (Number.isNaN(targetMs)) return null;

  let nearest: DayJumpTarget | null = null;
  let nearestDiff = Number.POSITIVE_INFINITY;
  for (const day of days) {
    const dayMs = Date.parse(`${day.date}T12:00:00Z`);
    if (Number.isNaN(dayMs)) continue;
    const diff = Math.abs(dayMs - targetMs);
    if (diff < nearestDiff) {
      nearestDiff = diff;
      nearest = day;
    }
  }

  return nearest;
}
