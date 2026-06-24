"use client";

import { MapPin } from "lucide-react";
import { useTripTime } from "@/components/itinerary/TripTimeContext";
import { computeTripProgress } from "@/lib/trip-time";
import { formatDate } from "@/lib/types";
import type { ItineraryDay } from "@/lib/schema";

export function TripProgressIndicator({
  days,
}: {
  days: Pick<ItineraryDay, "date" | "dayNumber" | "title">[];
}) {
  const { effectiveDate, devMode } = useTripTime();
  const progress = computeTripProgress(days, effectiveDate);

  if (!progress) return null;

  const statusLabel =
    progress.status === "upcoming"
      ? "Trip hasn't started yet"
      : progress.status === "complete"
        ? "Trip complete"
        : progress.currentDayTitle || `Day ${progress.currentDayNumber}`;

  return (
    <section className="mb-8 overflow-hidden rounded-2xl border border-[#1e3a5f]/15 bg-white shadow-sm">
      <div className="border-b border-stone-100 bg-gradient-to-r from-[#faf8f5] to-white px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-[#d4a853] uppercase">
              Trip progress
            </p>
            <h2 className="mt-1 font-serif text-xl text-[#1e3a5f]">
              {statusLabel}
            </h2>
            <p className="mt-1 text-sm text-stone-500">
              {progress.status === "in-progress" && (
                <>
                  Day {progress.currentDayNumber} of {progress.totalDays} ·{" "}
                  {formatDate(progress.currentDate)}
                </>
              )}
              {progress.status === "upcoming" && (
                <>
                  Starts {formatDate(progress.startDate)} · {progress.totalDays}{" "}
                  days total
                </>
              )}
              {progress.status === "complete" && (
                <>
                  Finished {formatDate(progress.endDate)} · {progress.totalDays}{" "}
                  days completed
                </>
              )}
            </p>
          </div>
          {devMode && (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
              Simulated date
            </span>
          )}
        </div>
      </div>

      <div className="px-5 py-5 sm:px-6">
        <div className="relative">
          <div className="h-2 overflow-hidden rounded-full bg-stone-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#1e3a5f] to-[#d4a853] transition-all duration-500"
              style={{ width: `${progress.progressPercent}%` }}
            />
          </div>

          <div
            className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${progress.progressPercent}%` }}
          >
            <div className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-[#d4a853] shadow-md">
              <MapPin className="h-2.5 w-2.5 text-white" />
            </div>
          </div>
        </div>

        <div className="mt-3 flex justify-between text-xs text-stone-500">
          <span>{formatDate(progress.startDate)}</span>
          <span className="font-medium text-[#1e3a5f]">
            {progress.status === "in-progress"
              ? "You are here"
              : progress.status === "upcoming"
                ? "Starts soon"
                : "Journey complete"}
          </span>
          <span>{formatDate(progress.endDate)}</span>
        </div>
      </div>
    </section>
  );
}
