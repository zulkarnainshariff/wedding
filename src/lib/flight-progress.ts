import { pickArrivalInstant, pickDepartureInstant } from "@/lib/flight-instant-picker";
import {
  buildFlightLegDisplayList,
  flightSegmentsFromDetails,
  resolveActiveSegmentIndex,
  resolveFlightScheduleForItem,
  resolveSegmentWindows,
  segmentLabel,
  type ResolvedSegmentWindow,
} from "@/lib/flight-segment-timing";
import type { ItineraryItem } from "@/lib/schema";
import { getFlightDetails, type FlightSegment } from "@/lib/types";

export type FlightScheduleItem = Pick<
  ItineraryItem,
  "category" | "eventDate" | "startDatetime" | "endDatetime" | "details"
>;

type TrackingSnapshot = {
  departure?: {
    actual?: string | null;
    estimated?: string | null;
    scheduled?: string | null;
  };
  arrival?: { actual?: string | null; estimated?: string | null };
  flightStatus?: string;
};

export type FlightProgressStop = {
  label: string;
  percent: number;
  kind: "origin" | "transit" | "destination";
  /** Scheduled layover duration at this transit stop. */
  layoverMinutes?: number;
};

export type FlightProgressLeg = {
  kind: "flight" | "transit";
  fromLabel: string;
  toLabel: string;
  startPercent: number;
  endPercent: number;
  startMs: number;
  endMs: number;
  segmentIndex?: number;
};

export type FlightSegmentProgress = {
  index: number;
  fromLabel: string;
  toLabel: string;
  percent: number;
  phase: "upcoming" | "active" | "complete";
  remainingMinutes: number;
  totalMinutes: number;
};

export type FlightProgress = {
  phase: "upcoming" | "active" | "landed";
  percent: number;
  elapsedMinutes: number;
  remainingMinutes: number;
  totalMinutes: number;
  fromLabel: string;
  toLabel: string;
  isMultiSegment: boolean;
  stops: FlightProgressStop[];
  legs: FlightProgressLeg[];
  /** Flex-weighted bar segments — used for layout (no absolute positioning). */
  parts: FlightProgressPart[];
  segment: FlightSegmentProgress | null;
  transit: {
    airportLabel: string;
    remainingMinutes: number;
  } | null;
};

export type FlightProgressPart = {
  kind: "flight" | "transit";
  minutes: number;
  fromLabel: string;
  toLabel: string;
  layoverMinutes?: number;
};

function readTrackingSnapshot(details: unknown): TrackingSnapshot | undefined {
  if (!details || typeof details !== "object") return undefined;
  const raw = (details as Record<string, unknown>)._flightTracking;
  if (!raw || typeof raw !== "object") return undefined;
  const snapshot = (raw as { snapshot?: TrackingSnapshot }).snapshot;
  return snapshot;
}

function buildMultiSegmentMeta(
  windows: ResolvedSegmentWindow[],
  journeyStartMs: number,
  journeyEndMs: number,
): { stops: FlightProgressStop[]; legs: FlightProgressLeg[] } {
  const totalMs = journeyEndMs - journeyStartMs;
  if (totalMs <= 0) return { stops: [], legs: [] };

  const toPercent = (instantMs: number) =>
    Math.min(100, Math.max(0, ((instantMs - journeyStartMs) / totalMs) * 100));

  const stops: FlightProgressStop[] = [
    {
      label: windows[0].fromLabel,
      percent: 0,
      kind: "origin",
    },
  ];

  const legs: FlightProgressLeg[] = [];

  for (let index = 0; index < windows.length; index += 1) {
    const current = windows[index];
    const depPercent = toPercent(current.dep.getTime());
    const arrPercent = toPercent(current.arr.getTime());

    legs.push({
      kind: "flight",
      fromLabel: current.fromLabel,
      toLabel: current.toLabel,
      startPercent: depPercent,
      endPercent: arrPercent,
      startMs: current.dep.getTime(),
      endMs: current.arr.getTime(),
      segmentIndex: index,
    });

    if (index < windows.length - 1) {
      const next = windows[index + 1];
      const transitStartMs = current.arr.getTime();
      const transitEndMs = next.dep.getTime();
      const layoverMinutes =
        transitEndMs > transitStartMs
          ? Math.max(1, Math.round((transitEndMs - transitStartMs) / 60_000))
          : undefined;

      stops.push({
        label: current.toLabel,
        percent: arrPercent,
        kind: "transit",
        layoverMinutes,
      });

      if (transitEndMs > transitStartMs) {
        legs.push({
          kind: "transit",
          fromLabel: current.toLabel,
          toLabel: next.fromLabel,
          startPercent: toPercent(transitStartMs),
          endPercent: toPercent(transitEndMs),
          startMs: transitStartMs,
          endMs: transitEndMs,
        });
      }
    }
  }

  stops.push({
    label: windows[windows.length - 1].toLabel,
    percent: 100,
    kind: "destination",
  });

  return { stops, legs };
}

function legDurationMinutes(leg: FlightProgressLeg): number {
  return Math.max(1, Math.round((leg.endMs - leg.startMs) / 60_000));
}

function buildProgressParts(legs: FlightProgressLeg[]): FlightProgressPart[] {
  return legs.map((leg) => {
    const minutes = legDurationMinutes(leg);
    if (leg.kind === "transit") {
      return {
        kind: "transit" as const,
        minutes,
        fromLabel: leg.fromLabel,
        toLabel: leg.toLabel,
        layoverMinutes: minutes,
      };
    }
    return {
      kind: "flight" as const,
      minutes,
      fromLabel: leg.fromLabel,
      toLabel: leg.toLabel,
    };
  });
}

/** Bar position from scheduled departure → arrival only (never tracking). */
function scheduledBarPercent(
  phase: FlightProgress["phase"],
  nowMs: number,
  scheduledStartMs: number,
  scheduledEndMs: number,
): number {
  if (phase === "upcoming") return 0;
  if (phase === "landed") return 100;

  const duration = scheduledEndMs - scheduledStartMs;
  if (duration <= 0) return 0;

  return Math.min(
    100,
    Math.max(0, ((nowMs - scheduledStartMs) / duration) * 100),
  );
}

function buildSegmentProgress(
  leg: FlightProgressLeg,
  window: ResolvedSegmentWindow,
  nowMs: number,
  operativeEndMs: number,
  isLastSegment: boolean,
): FlightSegmentProgress {
  const startMs = leg.startMs;
  const scheduledEndMs = leg.endMs;
  const operativeLegEndMs = isLastSegment ? operativeEndMs : scheduledEndMs;
  const legMs = Math.max(1, scheduledEndMs - startMs);
  const percent = Math.min(
    100,
    Math.max(0, ((nowMs - startMs) / legMs) * 100),
  );

  return {
    index: leg.segmentIndex!,
    fromLabel: window.fromLabel,
    toLabel: window.toLabel,
    percent,
    phase: "active",
    remainingMinutes: Math.max(
      0,
      Math.round((operativeLegEndMs - nowMs) / 60_000),
    ),
    totalMinutes: Math.max(1, Math.round(legMs / 60_000)),
  };
}

function resolveActiveSegmentAndTransit(
  legs: FlightProgressLeg[],
  windows: ResolvedSegmentWindow[],
  nowMs: number,
  phase: FlightProgress["phase"],
  operativeEndMs: number,
): {
  segment: FlightSegmentProgress | null;
  transit: FlightProgress["transit"];
} {
  if (phase === "upcoming" || phase === "landed") {
    return { segment: null, transit: null };
  }

  for (const leg of legs) {
    if (leg.kind === "transit" && nowMs >= leg.startMs && nowMs < leg.endMs) {
      return {
        segment: null,
        transit: {
          airportLabel: leg.fromLabel,
          remainingMinutes: Math.max(
            0,
            Math.round((leg.endMs - nowMs) / 60_000),
          ),
        },
      };
    }
  }

  let activeSegment: FlightSegmentProgress | null = null;

  for (const leg of legs) {
    if (leg.kind !== "flight" || leg.segmentIndex == null) continue;

    const window = windows[leg.segmentIndex];
    const isLastSegment = leg.segmentIndex === windows.length - 1;
    const startMs = leg.startMs;
    const scheduledEndMs = leg.endMs;
    const operativeLegEndMs = isLastSegment ? operativeEndMs : scheduledEndMs;

    if (nowMs < startMs) continue;
    if (nowMs >= operativeLegEndMs) continue;

    const candidate = buildSegmentProgress(
      leg,
      window,
      nowMs,
      operativeEndMs,
      isLastSegment,
    );

    if (!activeSegment || leg.segmentIndex > activeSegment.index) {
      activeSegment = candidate;
    }
  }

  if (activeSegment) {
    return { segment: activeSegment, transit: null };
  }

  const fallbackIndex = resolveActiveSegmentIndex(windows, nowMs);
  const fallbackLeg = legs.find(
    (leg) => leg.kind === "flight" && leg.segmentIndex === fallbackIndex,
  );
  const fallbackWindow = windows[fallbackIndex];
  if (fallbackLeg && fallbackWindow && nowMs >= fallbackLeg.startMs) {
    return {
      segment: buildSegmentProgress(
        fallbackLeg,
        fallbackWindow,
        nowMs,
        operativeEndMs,
        fallbackIndex === windows.length - 1,
      ),
      transit: null,
    };
  }

  return { segment: null, transit: null };
}

function multiSegmentJourneyPercent(
  legs: FlightProgressLeg[],
  windows: ResolvedSegmentWindow[],
  segment: FlightSegmentProgress | null,
  nowMs: number,
  operativeEndMs: number,
  scheduledStartMs: number,
  scheduledEndMs: number,
): number {
  if (!segment) {
    return scheduledBarPercent("active", nowMs, scheduledStartMs, scheduledEndMs);
  }

  const leg = legs.find(
    (entry) =>
      entry.kind === "flight" && entry.segmentIndex === segment.index,
  );
  if (!leg) {
    return scheduledBarPercent("active", nowMs, scheduledStartMs, scheduledEndMs);
  }

  const isLastSegment = segment.index === windows.length - 1;
  const operativeLegEndMs = isLastSegment ? operativeEndMs : leg.endMs;
  const span = Math.max(1, operativeLegEndMs - leg.startMs);
  const t = Math.min(1, Math.max(0, (nowMs - leg.startMs) / span));

  return leg.startPercent + t * (leg.endPercent - leg.startPercent);
}

export function computeFlightProgress(
  item: FlightScheduleItem,
  now = new Date(),
): FlightProgress | null {
  if (item.category !== "flight") {
    return null;
  }

  const schedule = resolveFlightScheduleForItem(item);

  if (!schedule.startDatetime || !schedule.endDatetime) {
    return null;
  }

  const scheduledStart = schedule.startDatetime;
  const scheduledEnd = schedule.endDatetime;
  const totalMs = scheduledEnd.getTime() - scheduledStart.getTime();
  if (totalMs <= 0) return null;

  const snapshot = readTrackingSnapshot(item.details);
  const departureInstant =
    pickDepartureInstant(item, snapshot, now) ?? scheduledStart;
  const arrivalInstant =
    pickArrivalInstant(item, snapshot, now) ?? scheduledEnd;

  const nowMs = now.getTime();
  const operativeStart = departureInstant;
  const operativeEnd = arrivalInstant;
  const operativeStartMs = operativeStart.getTime();
  const operativeEndMs = operativeEnd.getTime();
  const scheduledStartMs = scheduledStart.getTime();
  const scheduledEndMs = scheduledEnd.getTime();
  const totalMinutes = Math.max(1, Math.round(totalMs / 60_000));

  const showFrom = scheduledStart.getTime() - 60 * 60_000;
  const showUntil = scheduledEnd.getTime() + 2 * 60 * 60_000;
  const trackingDeparture = [
    snapshot?.departure?.actual,
    snapshot?.departure?.estimated,
    snapshot?.departure?.scheduled,
  ]
    .map((value) => (value ? new Date(value) : null))
    .find((value) => value && !Number.isNaN(value.getTime()));
  const journeyStarted =
    nowMs >= operativeStartMs ||
    (trackingDeparture != null && trackingDeparture.getTime() <= nowMs);
  if ((nowMs < showFrom || nowMs > showUntil) && !journeyStarted) return null;

  const flightDetails = getFlightDetails(item.details);
  const segments = flightSegmentsFromDetails(flightDetails);
  const isMultiSegment = segments.length >= 2;
  const routeCodes =
    segments.length >= 2
      ? routeCodesFromSegments(segments)
      : [
          flightDetails?.fromIata?.trim().toUpperCase() ||
            flightDetails?.from?.trim().slice(0, 3).toUpperCase() ||
            "DEP",
          flightDetails?.toIata?.trim().toUpperCase() ||
            flightDetails?.to?.trim().slice(0, 3).toUpperCase() ||
            "ARR",
        ];
  const fromLabel = routeCodes[0] ?? "DEP";
  const toLabel = routeCodes[routeCodes.length - 1] ?? "ARR";

  let phase: FlightProgress["phase"];
  if (nowMs < scheduledStartMs && nowMs < operativeStartMs) {
    phase = "upcoming";
  } else if (isFlightLanded(item, now)) {
    phase = "landed";
  } else {
    phase = "active";
  }

  const elapsedMinutes = Math.max(
    0,
    Math.round((nowMs - operativeStartMs) / 60_000),
  );
  let remainingMinutes: number;
  if (phase === "upcoming") {
    remainingMinutes = Math.max(
      0,
      Math.round((Math.min(operativeStartMs, scheduledStartMs) - nowMs) / 60_000),
    );
  } else if (phase === "active") {
    remainingMinutes = Math.max(0, Math.round((operativeEndMs - nowMs) / 60_000));
  } else {
    remainingMinutes = 0;
  }

  let stops: FlightProgressStop[] = [
    { label: fromLabel, percent: 0, kind: "origin" },
    { label: toLabel, percent: 100, kind: "destination" },
  ];
  let legs: FlightProgressLeg[] = [
    {
      kind: "flight",
      fromLabel,
      toLabel,
      startPercent: 0,
      endPercent: 100,
      startMs: scheduledStartMs,
      endMs: scheduledEndMs,
      segmentIndex: 0,
    },
  ];
  let segment: FlightSegmentProgress | null = null;
  let transit: FlightProgress["transit"] = null;
  let parts: FlightProgressPart[] = [];

  let segmentWindows: ResolvedSegmentWindow[] = [];

  if (isMultiSegment) {
    segmentWindows = resolveSegmentWindows(
      segments,
      scheduledStart,
      scheduledEnd,
      schedule.eventDate,
    );
    const meta = buildMultiSegmentMeta(
      segmentWindows,
      scheduledStartMs,
      scheduledEndMs,
    );
    stops = meta.stops;
    legs = meta.legs;
    const active = resolveActiveSegmentAndTransit(
      legs,
      segmentWindows,
      nowMs,
      phase,
      operativeEndMs,
    );
    segment = active.segment;
    transit = active.transit;
    parts = buildProgressParts(legs);
  } else if (phase === "active") {
    const legMs = Math.max(1, scheduledEndMs - scheduledStartMs);
    const segmentPercent = Math.min(
      100,
      Math.max(0, ((nowMs - scheduledStartMs) / legMs) * 100),
    );
    segment = {
      index: 0,
      fromLabel,
      toLabel,
      percent: segmentPercent,
      phase: "active",
      remainingMinutes,
      totalMinutes: Math.max(1, Math.round(legMs / 60_000)),
    };
    parts = buildProgressParts(legs);
  } else {
    parts = buildProgressParts(legs);
  }

  const percent =
    isMultiSegment && phase === "active"
      ? multiSegmentJourneyPercent(
          legs,
          segmentWindows,
          segment,
          nowMs,
          operativeEndMs,
          scheduledStartMs,
          scheduledEndMs,
        )
      : scheduledBarPercent(
          phase,
          nowMs,
          scheduledStartMs,
          scheduledEndMs,
        );

  return {
    phase,
    percent,
    elapsedMinutes: phase === "landed" ? totalMinutes : elapsedMinutes,
    remainingMinutes,
    totalMinutes,
    fromLabel,
    toLabel,
    isMultiSegment,
    stops,
    legs,
    parts,
    segment,
    transit,
  };
}

export function formatFlightProgressDuration(
  totalMinutes: number | null | undefined,
): string | null {
  if (totalMinutes == null) return null;

  const minutes = Math.max(0, totalMinutes);
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  const hourLabel = hours === 1 ? "1 hr" : hours > 0 ? `${hours} hrs` : null;
  const minLabel = mins === 1 ? "1 min" : mins > 0 ? `${mins} mins` : null;

  if (hourLabel && minLabel) return `${hourLabel} ${minLabel}`;
  if (hourLabel) return hourLabel;
  if (minLabel) return minLabel;
  return "0 mins";
}

export function formatFlightProgressLabel(progress: FlightProgress): string {
  if (progress.transit) {
    const duration = formatFlightProgressDuration(progress.transit.remainingMinutes);
    return duration
      ? `Layover at ${progress.transit.airportLabel} · ${duration}`
      : `Layover at ${progress.transit.airportLabel}`;
  }

  if (progress.phase === "landed") return "Landed";

  if (progress.phase === "active" && progress.remainingMinutes === 0) {
    return "Arriving soon";
  }

  const duration = formatFlightProgressDuration(progress.remainingMinutes);
  if (!duration) return "—";

  if (progress.phase === "upcoming") return `Departs in ${duration}`;
  return `${duration} remaining`;
}

export function formatSegmentProgressLabel(
  segment: FlightSegmentProgress,
): string {
  if (segment.phase === "complete") return "Leg complete";
  if (segment.phase === "upcoming") return "Upcoming leg";

  const duration = formatFlightProgressDuration(segment.remainingMinutes);
  if (!duration) return `${segment.fromLabel} → ${segment.toLabel}`;
  if (segment.remainingMinutes === 0) return "Arriving soon";
  return `${duration} remaining`;
}

export type FlightTimelineDisplay = {
  routeCodes: string[];
  transitStops: Array<{ airport: string; layoverMinutes: number }>;
};

function routeCodesFromSegments(segments: FlightSegment[]): string[] {
  if (segments.length === 0) return [];

  const codes = [segmentLabel(segments[0], "from")];
  for (const segment of segments) {
    codes.push(segmentLabel(segment, "to"));
  }

  return codes.filter((code, index) => index === 0 || code !== codes[index - 1]);
}

/** True once the flight has arrived (actual arrival or past scheduled arrival grace). */
export function isFlightLanded(
  item: FlightScheduleItem,
  now = new Date(),
): boolean {
  if (item.category !== "flight") return false;

  const schedule = resolveFlightScheduleForItem(item);

  if (!schedule.endDatetime) return false;

  const snapshot = readTrackingSnapshot(item.details);
  const nowMs = now.getTime();
  const status = snapshot?.flightStatus?.toLowerCase();
  const flightDetails = getFlightDetails(item.details);
  const segments = flightSegmentsFromDetails(flightDetails);
  const isMultiSegment = segments.length >= 2;

  if (status === "landed") {
    if (isMultiSegment) {
      return nowMs >= schedule.endDatetime.getTime();
    }
    return true;
  }
  return nowMs > schedule.endDatetime.getTime() + 15 * 60_000;
}

/** True while the flight is between scheduled departure and arrival (airborne or en-route). */
export function isFlightInProgress(
  item: FlightScheduleItem,
  now = new Date(),
): boolean {
  if (item.category !== "flight") return false;

  const schedule = resolveFlightScheduleForItem(item);

  if (!schedule.startDatetime || !schedule.endDatetime) return false;

  const nowMs = now.getTime();
  if (nowMs < schedule.startDatetime.getTime()) return false;
  if (isFlightLanded(item, now)) return false;
  return true;
}

export function getFlightTimelineDisplay(
  item: FlightScheduleItem,
  now = new Date(),
): FlightTimelineDisplay | null {
  if (item.category !== "flight") return null;

  const flightDetails = getFlightDetails(item.details);
  if (!flightDetails) return null;

  const segments = flightSegmentsFromDetails(flightDetails);
  const schedule = resolveFlightScheduleForItem(item);

  if (!schedule.startDatetime || !schedule.endDatetime) return null;

  const routeCodes =
    segments.length >= 2
      ? routeCodesFromSegments(segments)
      : [
          flightDetails.fromIata?.trim().toUpperCase() ||
            flightDetails.from?.trim().slice(0, 3).toUpperCase(),
          flightDetails.toIata?.trim().toUpperCase() ||
            flightDetails.to?.trim().slice(0, 3).toUpperCase(),
        ].filter(Boolean);

  if (routeCodes.length < 2) return null;

  let transitStops: FlightTimelineDisplay["transitStops"] = [];
  if (segments.length >= 2) {
    const nowMs = now.getTime();
    transitStops = buildFlightLegDisplayList(item)
      .map((leg) => leg.layoverAfter)
      .filter(
        (
          layover,
        ): layover is NonNullable<typeof layover> =>
          layover != null && nowMs < layover.departureAtMs,
      )
      .map(({ airport, layoverMinutes }) => ({ airport, layoverMinutes }));
  }

  return { routeCodes, transitStops };
}

export function formatFlightRouteChain(codes: string[]): string {
  return codes.join(" → ");
}

const FLIGHT_ROUTE_PART = /^[A-Z]{3}(?:\s*→\s*[A-Z]{3})+$/;

export function flightRouteLine(
  flightTimeline: FlightTimelineDisplay | null,
  summary: string | null | undefined,
): string | null {
  if (flightTimeline?.routeCodes.length) {
    return formatFlightRouteChain(flightTimeline.routeCodes);
  }

  const firstSummaryPart = summary?.split(" · ").map((part) => part.trim())[0];
  if (firstSummaryPart && FLIGHT_ROUTE_PART.test(firstSummaryPart)) {
    return firstSummaryPart;
  }

  return null;
}

export function flightSummaryExtraParts(
  summary: string | null | undefined,
  routeLine: string | null,
): string[] {
  if (!summary) return [];

  return summary
    .split(" · ")
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => {
      if (!routeLine) return !FLIGHT_ROUTE_PART.test(part);
      if (part === routeLine) return false;
      return !FLIGHT_ROUTE_PART.test(part);
    });
}
