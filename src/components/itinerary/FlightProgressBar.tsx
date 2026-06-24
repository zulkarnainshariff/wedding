"use client";

import { useEffect, useState } from "react";
import { Plane } from "lucide-react";
import {
  computeFlightProgress,
  formatFlightProgressLabel,
  type FlightProgress,
} from "@/lib/flight-progress";
import type { ItineraryItem } from "@/lib/schema";

export function FlightProgressBar({ item }: { item: ItineraryItem }) {
  const [progress, setProgress] = useState<FlightProgress | null>(() =>
    computeFlightProgress(item),
  );

  useEffect(() => {
    setProgress(computeFlightProgress(item));
    const interval = window.setInterval(() => {
      setProgress(computeFlightProgress(item));
    }, 30_000);
    return () => window.clearInterval(interval);
  }, [item]);

  if (!progress) return null;

  return (
    <div className="mt-3 border-t border-stone-100 pt-3">
      <div className="mb-2 flex items-center justify-between text-[10px] font-semibold tracking-wide text-stone-500 uppercase">
        <span>{progress.fromLabel}</span>
        <span className="normal-case text-sky-700">
          {formatFlightProgressLabel(progress)}
        </span>
        <span>{progress.toLabel}</span>
      </div>
      <div className="relative mx-1 h-2 rounded-full bg-sky-100">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-sky-400 to-sky-600 transition-[width] duration-500"
          style={{ width: `${progress.percent}%` }}
        />
        <div
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 transition-[left] duration-500"
          style={{ left: `${progress.percent}%` }}
          aria-hidden
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-sm ring-2 ring-sky-500">
            <Plane className="h-3.5 w-3.5 rotate-45 text-sky-700" />
          </span>
        </div>
      </div>
    </div>
  );
}
