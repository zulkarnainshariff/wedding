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
  const planePercent =
    progress.phase === "landed"
      ? 100
      : clampPlanePercent(progress.percent);
  const planeActive = progress.phase === "active";
  const parts = defaultParts(progress);

  return (
    <div className="mt-3 border-t border-stone-100 pt-3">
      {/* Airport codes */}
      <div className="flex gap-0.5">
        {parts.map((part, index) => {
          const isFirst = index === 0;
          const isLast = index === parts.length - 1;

          return (
            <div
              key={`code-${part.kind}-${index}`}
              className="min-w-0"
              style={{ flex: part.minutes }}
            >
              {isFirst && isLast ? (
                <div className="flex justify-between">
                  <span className="text-[10px] font-semibold tracking-wide text-stone-500 uppercase">
                    {progress.fromLabel}
                  </span>
                  <span className="text-[10px] font-semibold tracking-wide text-stone-500 uppercase">
                    {progress.toLabel}
                  </span>
                </div>
              ) : null}
              {isFirst && !isLast ? (
                <span className="text-[10px] font-semibold tracking-wide text-stone-500 uppercase">
                  {progress.fromLabel}
                </span>
              ) : null}
              {part.kind === "transit" ? (
                <span className="block text-center text-[10px] font-semibold tracking-wide text-stone-500 uppercase">
                  {part.fromLabel}
                </span>
              ) : null}
              {isLast && !isFirst ? (
                <span className="block text-right text-[10px] font-semibold tracking-wide text-stone-500 uppercase">
                  {progress.toLabel}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Transit duration + total remaining — above the bar, same row */}
      <div className="mt-1 mb-3 flex gap-0.5">
        {parts.map((part, index) => {
          const isLast = index === parts.length - 1;

          return (
            <div
              key={`meta-${part.kind}-${index}`}
              className={part.kind === "transit" ? "relative min-w-0 overflow-visible" : "min-w-0"}
              style={{ flex: part.minutes }}
            >
              {part.kind === "transit" && part.layoverMinutes ? (
                <p className="mx-auto w-max text-center text-[9px] leading-none font-medium whitespace-nowrap text-stone-500">
                  {formatFlightProgressDuration(part.layoverMinutes)} transit
                </p>
              ) : null}
              {isLast && destinationLabel ? (
                <p className="text-right text-[9px] leading-none font-medium whitespace-nowrap text-stone-600">
                  {destinationLabel}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Track, transit dots, plane, leg time below plane */}
      <div className="relative pb-4">
        <div className="flex gap-0.5 pt-1">
          {parts.map((part, index) => (
            <div
              key={`track-${part.kind}-${index}`}
              className="relative min-w-0"
              style={{ flex: part.minutes }}
            >
              <div
                className={[
                  "h-2 w-full rounded-full",
                  part.kind === "flight" ? "bg-sky-200/90" : "bg-stone-200/90",
                ].join(" ")}
                aria-hidden
              />
              {part.kind === "transit" ? (
                <span
                  className="absolute top-1/2 left-1/2 z-10 block h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white ring-2 ring-stone-300"
                  aria-hidden
                />
              ) : null}
            </div>
          ))}
        </div>

        <div
          className="pointer-events-none absolute top-1 left-0 h-2 rounded-full bg-gradient-to-r from-sky-400 to-sky-600 transition-[width] duration-500"
          style={{ width: `${planePercent}%` }}
          aria-hidden
        />

        <div
          className="pointer-events-none absolute z-20 transition-[left,right] duration-500"
          style={{
            ...planeHorizontalStyle(planePercent),
            top: "13px",
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
              progress.phase === "landed"
                ? "ring-emerald-500"
                : planeActive
                  ? "ring-amber-500"
                  : "ring-sky-500",
            ].join(" ")}
          >
            <Plane
              className={[
                "h-3.5 w-3.5 rotate-45",
                progress.phase === "landed"
                  ? "text-emerald-700"
                  : planeActive
                    ? "text-amber-700"
                    : "text-sky-700",
              ].join(" ")}
            />
          </span>
        </div>

        {belowPlaneLabel ? (
          <div
            className="pointer-events-none absolute z-20 transition-[left,right] duration-500"
            style={{
              ...planeHorizontalStyle(planePercent),
              top: "30px",
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
  );
}
