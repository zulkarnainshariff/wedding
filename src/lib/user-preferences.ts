export type UnitsPreference = "metric" | "imperial";
export type TimeFormatPreference = "12h" | "24h";
export type DateFormatPreference = "dmy" | "mdy";

export type UserPreferences = {
  units: UnitsPreference;
  timeFormat: TimeFormatPreference;
  dateFormat: DateFormatPreference;
  hidePastDays: boolean;
  hideFreeDays: boolean;
  hideUntouchedDays: boolean;
  hiddenDayIds: number[];
  forceVisibleDayIds: number[];
};

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  units: "metric",
  timeFormat: "24h",
  dateFormat: "dmy",
  hidePastDays: false,
  hideFreeDays: true,
  hideUntouchedDays: false,
  hiddenDayIds: [],
  forceVisibleDayIds: [],
};

function normalizeHiddenDayIds(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.map((value) => Number(value)).filter((id) => Number.isFinite(id) && id > 0))];
}

export function normalizeUserPreferences(raw: unknown): UserPreferences {
  if (!raw || typeof raw !== "object") return DEFAULT_USER_PREFERENCES;
  const value = raw as Partial<UserPreferences>;
  return {
    units: value.units === "imperial" ? "imperial" : "metric",
    timeFormat: value.timeFormat === "12h" ? "12h" : "24h",
    dateFormat: value.dateFormat === "mdy" ? "mdy" : "dmy",
    hidePastDays: value.hidePastDays ?? DEFAULT_USER_PREFERENCES.hidePastDays,
    hideFreeDays: value.hideFreeDays ?? DEFAULT_USER_PREFERENCES.hideFreeDays,
    hideUntouchedDays:
      value.hideUntouchedDays ?? DEFAULT_USER_PREFERENCES.hideUntouchedDays,
    hiddenDayIds: normalizeHiddenDayIds(value.hiddenDayIds),
    forceVisibleDayIds: normalizeHiddenDayIds(value.forceVisibleDayIds),
  };
}
