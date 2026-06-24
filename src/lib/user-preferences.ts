export type UnitsPreference = "metric" | "imperial";
export type TimeFormatPreference = "12h" | "24h";

export type UserPreferences = {
  units: UnitsPreference;
  timeFormat: TimeFormatPreference;
  hidePastDays: boolean;
};

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  units: "metric",
  timeFormat: "24h",
  hidePastDays: false,
};

export function normalizeUserPreferences(raw: unknown): UserPreferences {
  if (!raw || typeof raw !== "object") return DEFAULT_USER_PREFERENCES;
  const value = raw as Partial<UserPreferences>;
  return {
    units: value.units === "imperial" ? "imperial" : "metric",
    timeFormat: value.timeFormat === "12h" ? "12h" : "24h",
    hidePastDays: Boolean(value.hidePastDays),
  };
}
