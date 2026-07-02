import {
  DEFAULT_USER_PREFERENCES,
  type UnitsPreference,
  type UserPreferences,
} from "./user-preferences";
import { parseStoredClockTime } from "./flight-datetime";

function parseCalendarDate(value: string): { y: string; m: string; d: string } | null {
  const datePart = value.trim().split("T")[0];
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
  if (!match) return null;
  return { y: match[1], m: match[2], d: match[3] };
}

export function formatDateOnlyWithPrefs(
  value: string | Date | null | undefined,
  preferences: UserPreferences = DEFAULT_USER_PREFERENCES,
): string {
  if (!value) return "—";

  if (typeof value === "string") {
    const parts = parseCalendarDate(value);
    if (parts) {
      return preferences.dateFormat === "mdy"
        ? `${parts.m}-${parts.d}-${parts.y}`
        : `${parts.d}-${parts.m}-${parts.y}`;
    }
  }

  const d = typeof value === "string" ? new Date(value) : value;
  const pad = (n: number) => String(n).padStart(2, "0");
  const y = String(d.getFullYear());
  const m = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  return preferences.dateFormat === "mdy" ? `${m}-${day}-${y}` : `${day}-${m}-${y}`;
}

function weekdayLabel(value: string | Date): string {
  let datePart: string;
  if (typeof value === "string") {
    datePart = value.trim().split("T")[0];
  } else {
    const pad = (n: number) => String(n).padStart(2, "0");
    datePart = `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  }
  const parsed = parseCalendarDate(datePart);
  if (!parsed) return "";
  const weekday = new Date(
    `${parsed.y}-${parsed.m}-${parsed.d}T12:00:00`,
  ).toLocaleDateString("en-US", { weekday: "long" });
  return weekday;
}

export function formatDateOnlyWithWeekdayWithPrefs(
  value: string | Date | null | undefined,
  preferences: UserPreferences = DEFAULT_USER_PREFERENCES,
): string {
  if (!value) return "—";
  const dateLabel = formatDateOnlyWithPrefs(value, preferences);
  const weekday = weekdayLabel(value);
  return weekday ? `${dateLabel} - ${weekday}` : dateLabel;
}

export function formatDayOptionLabel(
  day: Pick<{ dayNumber: number; title?: string | null; date: string }, "dayNumber" | "title" | "date">,
  preferences: UserPreferences = DEFAULT_USER_PREFERENCES,
): string {
  const title = day.title?.trim();
  const dateLabel = formatDateOnlyWithWeekdayWithPrefs(day.date, preferences);
  if (title) {
    return `Day ${day.dayNumber} — ${dateLabel} — ${title}`;
  }
  return `Day ${day.dayNumber} — ${dateLabel}`;
}

export function formatDateRangeCompactWithPrefs(
  start: string | null | undefined,
  end: string | null | undefined,
  preferences: UserPreferences = DEFAULT_USER_PREFERENCES,
): string | null {
  if (!start) return null;
  const startLabel = formatDateOnlyWithPrefs(start, preferences);
  if (!end) return `From ${startLabel}`;
  return `${startLabel} ${formatDateOnlyWithPrefs(end, preferences)}`;
}

export function formatStayDateTimeWithPrefs(
  date: string | null | undefined,
  time: string | null | undefined,
  preferences: UserPreferences = DEFAULT_USER_PREFERENCES,
): string | null {
  if (!date) return null;
  const clock = time?.trim() || "00:00";
  const parts = parseCalendarDate(date);
  if (!parts) return formatDateOnlyWithPrefs(date, preferences);

  const locale = preferences.dateFormat === "mdy" ? "en-US" : "en-GB";
  const weekdayDate = new Date(
    Date.UTC(Number(parts.y), Number(parts.m) - 1, Number(parts.d), 12, 0, 0),
  );
  const datePart = weekdayDate.toLocaleDateString(locale, {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return `${datePart}, ${formatClockTimeWithPrefs(clock, preferences)}`;
}

export function formatWallClockDateTimeWithPrefs(
  iso: string | Date | null | undefined,
  preferences: UserPreferences = DEFAULT_USER_PREFERENCES,
): string {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return "—";
  const locale = preferences.dateFormat === "mdy" ? "en-US" : "en-GB";
  return d.toLocaleString(locale, {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: preferences.timeFormat === "12h",
  });
}

export function formatDateTimeWithPrefs(
  iso: string | Date | null | undefined,
  preferences: UserPreferences = DEFAULT_USER_PREFERENCES,
): string {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const locale = preferences.dateFormat === "mdy" ? "en-US" : "en-GB";
  return d.toLocaleString(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: preferences.timeFormat === "12h",
  });
}

export function formatClockTimeWithPrefs(
  time: string | null | undefined,
  preferences: UserPreferences = DEFAULT_USER_PREFERENCES,
): string {
  if (!time) return "—";

  const parsed = parseStoredClockTime(time);
  let hours: number;
  let minutes: number;

  if (parsed) {
    const [h, m] = parsed.clock.split(":");
    hours = Number(h);
    minutes = Number(m);
  } else {
    const [h, m] = time.split(":");
    hours = Number(h);
    minutes = Number(m ?? 0);
    if (Number.isNaN(hours)) return "—";
  }

  if (preferences.timeFormat === "12h") {
    const period = hours >= 12 ? "PM" : "AM";
    const h12 = hours % 12 || 12;
    return `${h12}:${String(minutes).padStart(2, "0")} ${period}`;
  }

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function formatInstantWithPrefs(
  iso: string | Date | null | undefined,
  timeZone: string | null | undefined,
  preferences: UserPreferences = DEFAULT_USER_PREFERENCES,
  options?: { airportCode?: string | null },
): string | null {
  if (!iso) return null;
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return null;

  const locale = preferences.dateFormat === "mdy" ? "en-US" : "en-GB";
  const formatted = d.toLocaleString(locale, {
    ...(timeZone ? { timeZone } : {}),
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: preferences.timeFormat === "12h",
  });

  const code = options?.airportCode?.trim().toUpperCase();
  return code ? `${formatted} (${code})` : formatted;
}

export function formatBaggageWithPrefs(
  value: number | null | undefined,
  units: UnitsPreference = DEFAULT_USER_PREFERENCES.units,
): string {
  if (value == null) return "N/A";
  if (units === "imperial") {
    return `${Math.round(value * 2.20462)} lb`;
  }
  return `${value} kg`;
}
