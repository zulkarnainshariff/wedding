"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plane } from "lucide-react";
import {
  computeFlightProgress,
  formatFlightProgressDuration,
  type FlightProgress,
  type FlightProgressPart,
} from "@/lib/flight-progress";
import { isItemCompleted } from "@/lib/item-completion";
import type { ItineraryItem } from "@/lib/schema";

function clampPlanePercent(value: number): number {
  if (value <= 0) return 0;
  if (value >= 100) return 100;
  return Math.min(97, Math.max(3, value));
}

function destinationRemainingLabel(progress: FlightProgress): string | null {
  if (progress.phase === "landed") return "Landed";

  const duration = formatFlightProgressDuration(progress.remainingMinutes);
  if (!duration) return null;

  if (progress.phase === "upcoming") return `Departs in ${duration}`;
  if (progress.remainingMinutes === 0) return "Arriving soon";
  return `${duration} remaining`;
}

/** Time label shown directly below the aircraft icon. */
function planeBelowLabel(progress: FlightProgress): string | null {
  if (progress.phase === "landed") return null;

  if (progress.phase === "upcoming") {
    const duration = formatFlightProgressDuration(progress.remainingMinutes);
    return duration ? `Departs in ${duration}` : null;
  }

  if (progress.transit) {
    const duration = formatFlightProgressDuration(progress.transit.remainingMinutes);
    if (!duration) return "Layover";
    return progress.transit.remainingMinutes === 0
      ? "Boarding soon"
      : `${duration} left`;
  }

  if (progress.segment) {
    const duration = formatFlightProgressDuration(progress.segment.remainingMinutes);
    if (!duration) return null;
    if (progress.segment.remainingMinutes === 0) return "Arriving soon";
    return `${duration} left`;
  }

  return null;
}

function defaultParts(progress: FlightProgress): FlightProgressPart[] {
  if (progress.parts.length > 0) return progress.parts;
  return [
    {
      kind: "flight",
      minutes: progress.totalMinutes,
      fromLabel: progress.fromLabel,
      toLabel: progress.toLabel,
    },
  ];
}

function planeHorizontalStyle(percent: number): React.CSSProperties {
  if (percent <= 0) {
    return { left: 0, transform: "translateX(0)" };
  }
  if (percent >= 100) {
    return { right: 0, left: "auto", transform: "translateX(0)" };
  }
  return { left: `${percent}%`, transform: "translateX(-50%)" };
}

/** Map full-journey progress onto the flight-only bar (layovers collapse to a dot). */
function visualBarPercent(
  journeyPercent: number,
  parts: FlightProgressPart[],
): number {
  const totalMinutes = parts.reduce((sum, part) => sum + part.minutes, 0);
  const flightMinutes = parts
    .filter((part) => part.kind === "flight")
    .reduce((sum, part) => sum + part.minutes, 0);

  if (totalMinutes <= 0 || flightMinutes <= 0) return journeyPercent;

  const journeyMinutes = (journeyPercent / 100) * totalMinutes;
  let timelineCursor = 0;
  let visualCursor = 0;

  for (const part of parts) {
    const partEnd = timelineCursor + part.minutes;

    if (journeyMinutes <= partEnd) {
      if (part.kind === "flight" && part.minutes > 0) {
        visualCursor +=
          ((journeyMinutes - timelineCursor) / part.minutes) * part.minutes;
      }
      return Math.min(100, Math.max(0, (visualCursor / flightMinutes) * 100));
    }

    if (part.kind === "flight") {
      visualCursor += part.minutes;
    }
    timelineCursor = partEnd;
  }

  return 100;
}

function TransitMarker({
  children,
  className = "",
  valign = "top",
}: {
  children: React.ReactNode;
  className?: string;
  valign?: "top" | "center";
}) {
  return (
    <div
      className={[
        "relative w-0 shrink-0",
        valign === "center" ? "self-center" : "",
      ].join(" ")}
    >
      <div
        className={[
          "absolute left-0 -translate-x-1/2 whitespace-nowrap",
          valign === "center" ? "top-1/2 -translate-y-1/2" : "top-0",
          className,
        ].join(" ")}
      >
        {children}
      </div>
    </div>
  );
}

function firstFlightIndex(parts: FlightProgressPart[]): number {
  return parts.findIndex((part) => part.kind === "flight");
}

function lastFlightIndex(parts: FlightProgressPart[]): number {
  return parts.findLastIndex((part) => part.kind === "flight");
}

export function FlightProgressBar({ item }: { item: ItineraryItem }) {
  const router = useRouter();
  const autoCompleteRequestedRef = useRef(false);
  const [progress, setProgress] = useState<FlightProgress | null>(() =>
    computeFlightProgress(item),
  );

  useEffect(() => {
    autoCompleteRequestedRef.current = false;
    setProgress(computeFlightProgress(item));
    const interval = window.setInterval(() => {
      setProgress(computeFlightProgress(item));
    }, 30_000);
    return () => window.clearInterval(interval);
  }, [item]);

  useEffect(() => {
    if (!progress || progress.phase !== "landed") return;
    if (isItemCompleted(item)) return;
    if (autoCompleteRequestedRef.current) return;

    autoCompleteRequestedRef.current = true;
    void fetch(`/api/items/${item.id}/complete-if-landed`, { method: "POST" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { autoCompleted?: boolean } | null) => {
        if (payload?.autoCompleted) {
          router.refresh();
        }
      })
      .catch(() => {
        autoCompleteRequestedRef.current = false;
      });
  }, [progress?.phase, item, router]);

  if (!progress) return null;

  const destinationLabel = destinationRemainingLabel(progress);
  const belowPlaneLabel = planeBelowLabel(progress);
  const parts = defaultParts(progress);
  const journeyPercent =
    progress.phase === "landed" ? 100 : progress.percent;
  const planePercent = clampPlanePercent(
    visualBarPercent(journeyPercent, parts),
  );
  const firstFlight = firstFlightIndex(parts);
  const lastFlight = lastFlightIndex(parts);
  const singleFlight = firstFlight === lastFlight && firstFlight >= 0;

  return (
    <div className="mt-3 border-t border-stone-100 pt-3">
      {/* Airport codes */}
      <div className="flex leading-none">
        {parts.map((part, index) => {
          if (part.kind === "transit") {
            return (
              <TransitMarker key={`code-${part.kind}-${index}`}>
                <span className="text-[10px] font-semibold tracking-wide text-stone-500 uppercase">
                  {part.fromLabel}
                </span>
              </TransitMarker>
            );
          }

          const isFirstFlight = index === firstFlight;
          const isLastFlight = index === lastFlight;

          return (
            <div
              key={`code-${part.kind}-${index}`}
              className={[
                "relative min-w-0",
                singleFlight && isFirstFlight ? "flex justify-between" : "",
              ].join(" ")}
              style={{ flex: part.minutes }}
            >
              {isFirstFlight ? (
                <span className="text-[10px] font-semibold tracking-wide text-stone-500 uppercase">
                  {progress.fromLabel}
                </span>
              ) : null}
              {isLastFlight && !singleFlight ? (
                <span className="absolute right-0 text-[10px] font-semibold tracking-wide text-stone-500 uppercase">
                  {progress.toLabel}
                </span>
              ) : null}
              {singleFlight && isLastFlight ? (
                <span className="text-[10px] font-semibold tracking-wide text-stone-500 uppercase">
                  {progress.toLabel}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Transit duration + total remaining — above the bar, same row */}
      <div className="mb-1.5 flex leading-none">
        {parts.map((part, index) => {
          if (part.kind === "transit") {
            return (
              <TransitMarker key={`meta-${part.kind}-${index}`}>
                {part.layoverMinutes ? (
                  <p className="text-center text-[9px] leading-none font-medium text-stone-500">
                    {formatFlightProgressDuration(part.layoverMinutes)} transit
                  </p>
                ) : null}
              </TransitMarker>
            );
          }

          const isLastFlight = index === lastFlight;

          return (
            <div
              key={`meta-${part.kind}-${index}`}
              className="relative min-w-0"
              style={{ flex: part.minutes }}
            >
              {isLastFlight && destinationLabel ? (
                <p className="text-right text-[9px] leading-none font-medium whitespace-nowrap text-stone-600">
                  {destinationLabel}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Track, transit dots, plane, leg time below plane */}
      <div className="relative py-3 pb-5">
        <div className="relative flex items-center">
          {parts.map((part, index) => {
            if (part.kind === "transit") {
              return (
                <TransitMarker key={`track-${part.kind}-${index}`} valign="center">
                  <span
                    className="block h-2.5 w-2.5 rounded-full bg-white ring-2 ring-stone-300"
                    aria-hidden
                  />
                </TransitMarker>
              );
            }

            const isFirstFlight = index === firstFlight;
            const isLastFlight = index === lastFlight;

            return (
            <div
              key={`track-${part.kind}-${index}`}
              className="relative min-w-0"
              style={{ flex: part.minutes }}
            >
              <div
                className={[
                  "h-2 w-full bg-sky-200/90",
                  isFirstFlight && isLastFlight
                    ? "rounded-full"
                    : [
                        isFirstFlight ? "rounded-l-full" : "rounded-l-none",
                        isLastFlight ? "rounded-r-full" : "rounded-r-none",
                      ].join(" "),
                ].join(" ")}
                aria-hidden
              />
            </div>
            );
          })}

          <div
            className="pointer-events-none absolute top-1/2 left-0 h-2 -translate-y-1/2 rounded-full bg-gradient-to-r from-sky-400 to-sky-600 transition-[width] duration-500"
            style={{ width: `${planePercent}%` }}
            aria-hidden
          />

          <div
            className="pointer-events-none absolute top-1/2 z-20 transition-[left,right] duration-500"
            style={{
              ...planeHorizontalStyle(planePercent),
              transform:
                planePercent <= 0
                  ? "translateY(-50%)"
                  : planePercent >= 100
                    ? "translate(-100%, -50%)"
                    : "translate(-50%, -50%)",
            }}
          >
            <span
              className={[
                "flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-sm ring-2",
                progress.phase === "landed" ? "ring-emerald-500" : "ring-sky-500",
              ].join(" ")}
            >
              <Plane
                className={[
                  "h-3.5 w-3.5 rotate-45",
                  progress.phase === "landed" ? "text-emerald-700" : "text-sky-700",
                ].join(" ")}
              />
            </span>
          </div>

          {belowPlaneLabel ? (
            <div
              className="pointer-events-none absolute z-20 transition-[left,right] duration-500"
              style={{
                ...planeHorizontalStyle(planePercent),
                top: "calc(50% + 18px)",
                transform:
                  planePercent <= 0
                    ? "translateX(0)"
                    : planePercent >= 100
                      ? "translateX(-100%)"
                      : "translateX(-50%)",
              }}
            >
              <span className="block max-w-[96px] truncate text-center text-[9px] font-medium whitespace-nowrap text-stone-600">
                {belowPlaneLabel}
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
