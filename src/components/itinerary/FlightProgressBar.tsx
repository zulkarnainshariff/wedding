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

type FlightBarAnchor = {
  key: string;
  percent: number;
  code: string;
  meta: string | null;
  isTransit: boolean;
};

function clampPlanePercent(value: number): number {
  if (value <= 0) return 0;
  if (value >= 100) return 100;
  return Math.min(97, Math.max(3, value));
}

function destinationRemainingLabel(progress: FlightProgress): string | null {
  if (progress.phase === "landed") return "Landed";
  if (progress.phase === "upcoming" || !progress.isMultiSegment) return null;

  const duration = formatFlightProgressDuration(progress.remainingMinutes);
  if (!duration) return null;
  if (progress.remainingMinutes === 0) return "Arriving soon";
  return `${duration} remaining`;
}

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

function totalFlightMinutes(parts: FlightProgressPart[]): number {
  return parts
    .filter((part) => part.kind === "flight")
    .reduce((sum, part) => sum + part.minutes, 0);
}

function isTransitStopPassed(
  progress: FlightProgress,
  transitIndex: number,
): boolean {
  if (progress.phase === "landed") return true;
  if (progress.transit) return false;
  return (
    progress.segment != null && progress.segment.index > transitIndex
  );
}

function buildFlightBarAnchors(
  parts: FlightProgressPart[],
  progress: FlightProgress,
  destinationLabel: string | null,
): FlightBarAnchor[] {
  const flightMinutes = totalFlightMinutes(parts);
  if (flightMinutes <= 0) return [];

  const originCode =
    progress.stops.find((stop) => stop.kind === "origin")?.label ??
    progress.fromLabel;
  const destinationCode =
    progress.stops.find((stop) => stop.kind === "destination")?.label ??
    progress.toLabel;
  const transitStops = progress.stops.filter((stop) => stop.kind === "transit");

  const anchors: FlightBarAnchor[] = [
    {
      key: "origin",
      percent: 0,
      code: originCode,
      meta: null,
      isTransit: false,
    },
  ];

  let flightCursor = 0;
  let transitIndex = 0;

  for (const part of parts) {
    if (part.kind === "flight") {
      flightCursor += part.minutes;
      continue;
    }

    const percent = (flightCursor / flightMinutes) * 100;
    const currentTransitIndex = transitIndex;
    const transitStop = transitStops[currentTransitIndex];
    transitIndex += 1;
    anchors.push({
      key: `transit-${transitStop?.label ?? part.fromLabel}-${transitIndex}`,
      percent,
      code: transitStop?.label ?? part.fromLabel,
      meta:
        part.layoverMinutes &&
        !isTransitStopPassed(progress, currentTransitIndex)
          ? `${formatFlightProgressDuration(part.layoverMinutes)} transit`
          : null,
      isTransit: true,
    });
  }

  anchors.push({
    key: "destination",
    percent: 100,
    code: destinationCode,
    meta: destinationLabel,
    isTransit: false,
  });

  return anchors;
}

function anchorStyle(percent: number): React.CSSProperties {
  if (percent <= 0) {
    return { left: 0 };
  }
  if (percent >= 100) {
    return { right: 0, left: "auto" };
  }
  return { left: `${percent}%`, transform: "translateX(-50%)" };
}

function anchorAlignClass(percent: number): string {
  if (percent <= 0) return "text-left";
  if (percent >= 100) return "text-right";
  return "text-center";
}

function planeHorizontalStyle(percent: number): React.CSSProperties {
  if (percent <= 0) {
    return { left: 0, transform: "translateY(-50%)" };
  }
  if (percent >= 100) {
    return { right: 0, left: "auto", transform: "translate(0, -50%)" };
  }
  return { left: `${percent}%`, transform: "translate(-50%, -50%)" };
}

function planeLabelStyle(percent: number): React.CSSProperties {
  const iconHalf = 12;
  if (percent <= 0) {
    return { left: `${iconHalf}px`, transform: "translateX(-50%)" };
  }
  if (percent >= 100) {
    return { right: `${iconHalf}px`, left: "auto", transform: "translateX(50%)" };
  }
  return { left: `${percent}%`, transform: "translateX(-50%)" };
}

function visualBarPercent(
  journeyPercent: number,
  parts: FlightProgressPart[],
): number {
  const totalMinutes = parts.reduce((sum, part) => sum + part.minutes, 0);
  const flightMinutes = totalFlightMinutes(parts);

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

const codeClass =
  "text-[11px] font-semibold leading-none tracking-wide text-stone-500 uppercase sm:text-[10px]";
const metaTextClass =
  "text-[10px] leading-none font-medium whitespace-nowrap text-stone-600 sm:text-[9px]";

function AnchorLabel({
  percent,
  children,
  className = "",
}: {
  percent: number;
  children: React.ReactNode;
  className?: string;
}) {
  const edge = percent <= 0 || percent >= 100;
  return (
    <div
      className={[
        "absolute top-0",
        anchorAlignClass(percent),
        edge
          ? percent >= 100
            ? "max-w-none whitespace-nowrap"
            : "max-w-[50%] whitespace-nowrap"
          : "whitespace-nowrap",
        className,
      ].join(" ")}
      style={anchorStyle(percent)}
    >
      {children}
    </div>
  );
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
  const singleFlight = !progress.isMultiSegment;
  const anchors = singleFlight
    ? []
    : buildFlightBarAnchors(parts, progress, destinationLabel);
  const showInlineStatus =
    singleFlight &&
    progress.phase === "upcoming" &&
    Boolean(belowPlaneLabel);
  const showMetaRow =
    !singleFlight && anchors.some((anchor) => Boolean(anchor.meta));
  const showFollowingPlaneLabel = Boolean(belowPlaneLabel) && !showInlineStatus;
  const transitAnchors = anchors.filter((anchor) => anchor.isTransit);

  return (
    <div className="mt-3 border-t border-stone-100 pt-3">
      {singleFlight ? (
        <div className="flex items-center justify-between leading-none">
          <span className={codeClass}>{progress.fromLabel}</span>
          <span className={codeClass}>{progress.toLabel}</span>
        </div>
      ) : (
        <div className="relative h-3.5">
          {anchors.map((anchor) => (
            <AnchorLabel key={`${anchor.key}-code`} percent={anchor.percent}>
              <span className={codeClass}>{anchor.code}</span>
            </AnchorLabel>
          ))}
        </div>
      )}

      {showInlineStatus ? (
        <p className="mt-1 text-[10px] leading-none font-medium text-stone-600 sm:text-[11px]">
          {belowPlaneLabel}
        </p>
      ) : null}

      {showMetaRow ? (
        <div className="relative mt-0.5 min-h-3.5">
          {anchors.map((anchor) =>
            anchor.meta ? (
              <AnchorLabel
                key={`${anchor.key}-meta`}
                percent={anchor.percent}
                className={anchor.isTransit ? "hidden sm:block" : undefined}
              >
                <span className={metaTextClass}>{anchor.meta}</span>
              </AnchorLabel>
            ) : null,
          )}
        </div>
      ) : null}

      <div className={showMetaRow ? "relative mt-2.5" : "relative mt-1"}>
        <div className="relative h-6">
          <div
            className="absolute top-1/2 right-0 left-0 h-2 -translate-y-1/2 rounded-full bg-sky-200/90"
            aria-hidden
          />

          {transitAnchors.map((anchor) => (
            <span
              key={`${anchor.key}-dot`}
              className="absolute top-1/2 z-10 block h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white ring-2 ring-stone-300"
              style={{ left: `${anchor.percent}%` }}
              aria-hidden
            />
          ))}

          <div
            className="pointer-events-none absolute top-1/2 left-0 z-[1] h-2 -translate-y-1/2 rounded-full bg-gradient-to-r from-sky-400 to-sky-600 transition-[width] duration-500"
            style={{ width: `${planePercent}%` }}
            aria-hidden
          />

          <div
            className="pointer-events-none absolute top-1/2 z-20 transition-[left,right] duration-500"
            style={planeHorizontalStyle(planePercent)}
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
        </div>

        {showFollowingPlaneLabel ? (
          <div className="relative mt-2 h-3.5">
            <div
              className="pointer-events-none absolute top-0 z-20 transition-[left,right] duration-500"
              style={planeLabelStyle(planePercent)}
            >
              <span className="block min-w-max text-center text-[10px] leading-none font-medium whitespace-nowrap text-stone-600 sm:text-[9px]">
                {belowPlaneLabel}
              </span>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
