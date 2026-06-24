import {
  DEFAULT_USER_PREFERENCES,
  type UnitsPreference,
  type UserPreferences,
} from "./user-preferences";

export function formatDateTimeWithPrefs(
  iso: string | Date | null | undefined,
  preferences: UserPreferences = DEFAULT_USER_PREFERENCES,
): string {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleString("en-GB", {
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

  let hours: number;
  let minutes: number;

  if (time.includes("T")) {
    const d = new Date(time);
    if (Number.isNaN(d.getTime())) return time;
    hours = d.getHours();
    minutes = d.getMinutes();
  } else {
    const [h, m] = time.split(":");
    hours = Number(h);
    minutes = Number(m ?? 0);
    if (Number.isNaN(hours)) return time;
  }

  if (preferences.timeFormat === "12h") {
    const period = hours >= 12 ? "PM" : "AM";
    const h12 = hours % 12 || 12;
    return `${h12}:${String(minutes).padStart(2, "0")} ${period}`;
  }

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
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
