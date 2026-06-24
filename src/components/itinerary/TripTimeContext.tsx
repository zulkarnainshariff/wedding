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
import { DEFAULT_USER_PREFERENCES } from "@/lib/user-preferences";
import {
  getEffectiveDate,
  getTodayDate,
  toDateString,
} from "@/lib/trip-time";

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
  effectiveDate: Date;
  effectiveDateString: string;
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

export function TripTimeProvider({ children }: { children: React.ReactNode }) {
  const { user, refreshUser } = useAuth();
  const [devMode, setDevModeState] = useState(false);
  const [simulatedDate, setSimulatedDateState] = useState(() =>
    toDateString(getTodayDate()),
  );
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setDevModeState(readStoredDevMode());
    setSimulatedDateState(readStoredSimulatedDate());
    setHydrated(true);
  }, []);

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

  const hidePast =
    user?.preferences.hidePastDays ?? DEFAULT_USER_PREFERENCES.hidePastDays;

  const setHidePast = useCallback(
    async (hide: boolean) => {
      if (!user) return;

      const preferences = {
        ...user.preferences,
        hidePastDays: hide,
      };

      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences }),
      });

      if (response.ok) {
        await refreshUser();
      }
    },
    [user, refreshUser],
  );

  const effectiveDate = useMemo(
    () =>
      hydrated
        ? getEffectiveDate(activeDevMode, simulatedDate)
        : getTodayDate(),
    [activeDevMode, simulatedDate, hydrated],
  );

  const value = useMemo<TripTimeContextValue>(
    () => ({
      devMode: activeDevMode,
      setDevMode,
      simulatedDate,
      setSimulatedDate,
      resetSimulatedDate,
      hidePast,
      setHidePast,
      effectiveDate,
      effectiveDateString: toDateString(effectiveDate),
    }),
    [
      activeDevMode,
      simulatedDate,
      hidePast,
      hydrated,
      setDevMode,
      setSimulatedDate,
      resetSimulatedDate,
      setHidePast,
      effectiveDate,
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
