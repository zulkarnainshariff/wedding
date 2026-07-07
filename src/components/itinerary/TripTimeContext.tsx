"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  DEFAULT_USER_PREFERENCES,
  type UserPreferences,
} from "@/lib/user-preferences";
import {
  getEffectiveDate,
  getTodayDate,
  toDateString,
} from "@/lib/trip-time";
import { resolveItineraryStartDate } from "@/lib/trip-day-display";

const DEV_MODE_KEY = "wedding-dev-mode";
const SIMULATED_DATE_KEY = "wedding-simulated-date";

type TripTimeContextValue = {
  devMode: boolean;
  setDevMode: (enabled: boolean) => void;
  simulatedDate: string;
  setSimulatedDate: (date: string) => void;
  resetSimulatedDate: () => void;
  hidePast: boolean;
  setHidePast: (hide: boolean) => Promise<void>;
  hideFreeDays: boolean;
  setHideFreeDays: (hide: boolean) => Promise<void>;
  hideUntouchedDays: boolean;
  setHideUntouchedDays: (hide: boolean) => Promise<void>;
  hiddenDayIds: ReadonlySet<number>;
  forceVisibleDayIds: ReadonlySet<number>;
  setDayVisible: (dayId: number, visible: boolean, isFree: boolean) => Promise<void>;
  effectiveDate: Date;
  effectiveDateString: string;
  itineraryStartDate: string;
};

const TripTimeContext = createContext<TripTimeContextValue | null>(null);

function readStoredDevMode(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(DEV_MODE_KEY) === "true";
}

function readStoredSimulatedDate(): string {
  if (typeof window === "undefined") return toDateString(getTodayDate());
  return localStorage.getItem(SIMULATED_DATE_KEY) ?? toDateString(getTodayDate());
}

async function persistPreferences(
  preferences: UserPreferences,
): Promise<boolean> {
  const response = await fetch("/api/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ preferences }),
  });
  return response.ok;
}

export function TripTimeProvider({
  children,
  itineraryStartDate: itineraryStartDateProp,
}: {
  children: React.ReactNode;
  itineraryStartDate?: string | null;
}) {
  const { user, refreshUser } = useAuth();
  const [devMode, setDevModeState] = useState(false);
  const [simulatedDate, setSimulatedDateState] = useState(() =>
    toDateString(getTodayDate()),
  );
  const [hydrated, setHydrated] = useState(false);
  const [optimisticPreferences, setOptimisticPreferences] =
    useState<UserPreferences | null>(null);

  useEffect(() => {
    setDevModeState(readStoredDevMode());
    setSimulatedDateState(readStoredSimulatedDate());
    setHydrated(true);
  }, []);

  const serverPreferences = user?.preferences ?? DEFAULT_USER_PREFERENCES;
  const preferences = optimisticPreferences ?? serverPreferences;
  const serverPreferencesKey = JSON.stringify(serverPreferences);

  useEffect(() => {
    setOptimisticPreferences(null);
  }, [serverPreferencesKey]);

  const isAdmin = user?.isAdmin ?? false;
  const activeDevMode = hydrated && isAdmin && devMode;

  const setDevMode = useCallback(
    (enabled: boolean) => {
      if (!isAdmin) return;
      setDevModeState(enabled);
      localStorage.setItem(DEV_MODE_KEY, String(enabled));
    },
    [isAdmin],
  );

  const setSimulatedDate = useCallback(
    (date: string) => {
      if (!isAdmin) return;
      setSimulatedDateState(date);
      localStorage.setItem(SIMULATED_DATE_KEY, date);
    },
    [isAdmin],
  );

  const resetSimulatedDate = useCallback(() => {
    if (!isAdmin) return;
    const today = toDateString(getTodayDate());
    setSimulatedDateState(today);
    localStorage.setItem(SIMULATED_DATE_KEY, today);
  }, [isAdmin]);

  const hidePast = preferences.hidePastDays ?? DEFAULT_USER_PREFERENCES.hidePastDays;
  const hideFreeDays = preferences.hideFreeDays ?? DEFAULT_USER_PREFERENCES.hideFreeDays;
  const hideUntouchedDays =
    preferences.hideUntouchedDays ?? DEFAULT_USER_PREFERENCES.hideUntouchedDays;
  const hiddenDayIds = useMemo(
    () => new Set(preferences.hiddenDayIds ?? []),
    [preferences.hiddenDayIds],
  );
  const forceVisibleDayIds = useMemo(
    () => new Set(preferences.forceVisibleDayIds ?? []),
    [preferences.forceVisibleDayIds],
  );

  const updatePreferences = useCallback(
    async (patch: Partial<UserPreferences>) => {
      if (!user) return false;
      const next = { ...preferences, ...patch };
      setOptimisticPreferences(next);
      const ok = await persistPreferences(next);
      if (ok) {
        await refreshUser();
      } else {
        setOptimisticPreferences(null);
      }
      return ok;
    },
    [user, preferences, refreshUser],
  );

  const setHidePast = useCallback(
    async (hide: boolean) => {
      await updatePreferences({ hidePastDays: hide });
    },
    [updatePreferences],
  );

  const setHideFreeDays = useCallback(
    async (hide: boolean) => {
      await updatePreferences({ hideFreeDays: hide });
    },
    [updatePreferences],
  );

  const setHideUntouchedDays = useCallback(
    async (hide: boolean) => {
      await updatePreferences({ hideUntouchedDays: hide });
    },
    [updatePreferences],
  );

  const setDayVisible = useCallback(
    async (dayId: number, visible: boolean, withoutItems: boolean) => {
      const nextHidden = new Set(preferences.hiddenDayIds ?? []);
      const nextForce = new Set(preferences.forceVisibleDayIds ?? []);
      if (visible) {
        nextHidden.delete(dayId);
        if (withoutItems) nextForce.add(dayId);
      } else {
        nextHidden.add(dayId);
        nextForce.delete(dayId);
      }
      await updatePreferences({
        hiddenDayIds: [...nextHidden],
        forceVisibleDayIds: [...nextForce],
      });
    },
    [preferences.hiddenDayIds, preferences.forceVisibleDayIds, updatePreferences],
  );

  const effectiveDate = useMemo(
    () =>
      hydrated
        ? getEffectiveDate(activeDevMode, simulatedDate)
        : getTodayDate(),
    [activeDevMode, simulatedDate, hydrated],
  );

  const itineraryStartDate = resolveItineraryStartDate(itineraryStartDateProp);

  const value = useMemo<TripTimeContextValue>(
    () => ({
      devMode: activeDevMode,
      setDevMode,
      simulatedDate,
      setSimulatedDate,
      resetSimulatedDate,
      hidePast,
      setHidePast,
      hideFreeDays,
      setHideFreeDays,
      hideUntouchedDays,
      setHideUntouchedDays,
      hiddenDayIds,
      forceVisibleDayIds,
      setDayVisible,
      effectiveDate,
      effectiveDateString: toDateString(effectiveDate),
      itineraryStartDate,
    }),
    [
      activeDevMode,
      simulatedDate,
      hidePast,
      hideFreeDays,
      hideUntouchedDays,
      hiddenDayIds,
      forceVisibleDayIds,
      hydrated,
      setDevMode,
      setSimulatedDate,
      resetSimulatedDate,
      setHidePast,
      setHideFreeDays,
      setHideUntouchedDays,
      setDayVisible,
      effectiveDate,
      itineraryStartDate,
    ],
  );

  return (
    <TripTimeContext.Provider value={value}>{children}</TripTimeContext.Provider>
  );
}

export function useTripTime() {
  const context = useContext(TripTimeContext);
  if (!context) {
    throw new Error("useTripTime must be used within TripTimeProvider");
  }
  return context;
}
