"use client";

import { MapPin } from "lucide-react";
import { useTripTime } from "@/components/itinerary/TripTimeContext";
import { useDisplayFormat } from "@/hooks/useDisplayFormat";
import { itemSectionId, scrollToElementById } from "@/lib/day-jump";
import { findNextItineraryItem } from "@/lib/next-itinerary";
import { computeTripProgress, formatDaysUntilStart } from "@/lib/trip-time";
import type { ItineraryDay, ItineraryItem } from "@/lib/schema";
import type { ItineraryItemWithSubItems } from "@/lib/item-subitem-utils";

export function TripProgressIndicator({
  days,
  items,
}: {
  days: Pick<ItineraryDay, "date" | "dayNumber" | "title">[];
  items?: ItineraryItemWithSubItems[];
}) {
  const { effectiveDate, devMode } = useTripTime();
  const { formatDateOnly, formatWallClockDateTime, formatClockTime } = useDisplayFormat();
  const progress = computeTripProgress(days, effectiveDate);
  const nextItem = items ? findNextItineraryItem(items, effectiveDate) : null;

  if (!progress) return null;

  const statusLabel =
    progress.status === "upcoming"
      ? progress.daysUntilStart !== null
        ? formatDaysUntilStart(progress.daysUntilStart)
        : "Trip hasn't started yet"
      : progress.status === "complete"
        ? "Trip complete"
        : progress.currentDayTitle || `Day ${progress.currentDayNumber}`;

  const nextItemTime = (() => {
    if (!nextItem) return null;
    const details =
      nextItem.details && typeof nextItem.details === "object"
        ? (nextItem.details as Record<string, unknown>)
        : {};
    if (typeof details.time === "string" && /^\d{2}:\d{2}$/.test(details.time)) {
      return formatClockTime(details.time);
    }
    if (nextItem.startDatetime) {
      return formatWallClockDateTime(nextItem.startDatetime);
    }
    return null;
  })();

  return (
    <section className="theme-card mb-4 overflow-hidden rounded-2xl border bg-white">
      <div className="theme-gradient-header border-b border-border/60 px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-accent uppercase">
              Trip progress
            </p>
            <h2 className="mt-1 font-serif text-xl text-brand-deep">
              {statusLabel}
            </h2>
            <p className="mt-1 text-sm text-stone-500">
              {progress.status === "in-progress" && (
                <>
                  Day {progress.currentDayNumber} of {progress.totalDays} ·{" "}
                  {formatDateOnly(progress.currentDate)}
                </>
              )}
              {progress.status === "upcoming" && (
                <>
                  Starts {formatDateOnly(progress.startDate)} · {progress.totalDays}{" "}
                  days total
                </>
              )}
              {progress.status === "complete" && (
                <>
                  Finished {formatDateOnly(progress.endDate)} · {progress.totalDays}{" "}
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
          <div className="h-2 overflow-hidden rounded-full bg-brand/15">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-deep to-accent transition-all duration-500"
              style={{ width: `${progress.progressPercent}%` }}
            />
          </div>

          <div
            className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${progress.progressPercent}%` }}
          >
            <div className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-accent shadow-md">
              <MapPin className="h-2.5 w-2.5 text-white" />
            </div>
          </div>
        </div>

        <div className="mt-3 flex justify-between text-xs text-stone-500">
          <span>{formatDateOnly(progress.startDate)}</span>
          <span className="font-medium text-brand-deep">
            {progress.status === "in-progress"
              ? "You are here"
              : progress.status === "upcoming" && progress.daysUntilStart !== null
                ? formatDaysUntilStart(progress.daysUntilStart)
                : progress.status === "complete"
                  ? "Journey complete"
                  : null}
          </span>
          <span>{formatDateOnly(progress.endDate)}</span>
        </div>

        {nextItem ? (
          <button
            type="button"
            onClick={() => scrollToElementById(itemSectionId(nextItem.id))}
            className="mt-4 w-full rounded-xl border border-brand/20 bg-brand/5 px-4 py-3 text-left transition hover:border-brand/35 hover:bg-brand/10"
          >
            <p className="text-[11px] font-semibold tracking-wide text-brand-deep uppercase">
              My next itinerary
            </p>
            <p className="mt-1 text-sm font-medium text-stone-900">{nextItem.title}</p>
            {nextItemTime ? (
              <p className="mt-0.5 text-xs text-stone-500">{nextItemTime}</p>
            ) : null}
          </button>
        ) : null}
      </div>
    </section>
  );
}
