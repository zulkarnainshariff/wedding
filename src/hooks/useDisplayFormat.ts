"use client";

import { useMemo } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  formatBaggageWithPrefs,
  formatClockTimeWithPrefs,
  formatDateTimeWithPrefs,
} from "@/lib/display-format";
import { DEFAULT_USER_PREFERENCES } from "@/lib/user-preferences";

export function useDisplayFormat() {
  const { user } = useAuth();
  const preferences = user?.preferences ?? DEFAULT_USER_PREFERENCES;

  return useMemo(
    () => ({
      preferences,
      formatDateTime: (iso: string | Date | null | undefined) =>
        formatDateTimeWithPrefs(iso, preferences),
      formatClockTime: (time: string | null | undefined) =>
        formatClockTimeWithPrefs(time, preferences),
      formatBaggage: (value: number | null | undefined) =>
        formatBaggageWithPrefs(value, preferences.units),
    }),
    [preferences.timeFormat, preferences.units],
  );
}
