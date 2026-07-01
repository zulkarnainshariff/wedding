"use client";

import { useCallback, useEffect, useState } from "react";
import type { FlightDaySortMode } from "@/lib/day-item-sort";

const STORAGE_KEY = "wedding-flight-day-sort";

export function useFlightDaySortMode() {
  const [mode, setModeState] = useState<FlightDaySortMode>("arrival");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "arrival" || stored === "departure") {
      setModeState(stored);
    }
  }, []);

  const setMode = useCallback((next: FlightDaySortMode) => {
    setModeState(next);
    localStorage.setItem(STORAGE_KEY, next);
  }, []);

  return { mode, setMode };
}
