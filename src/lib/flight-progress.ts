import {
  parseStoredClockTime,
  resolveFlightSchedule,
  zonedLocalToUtc,
} from "@/lib/flight-datetime";
import { getAirportTimezone } from "@/lib/airport-timezones";
import { pickArrivalInstant, pickDepartureInstant } from "@/lib/flight-instant-picker";
import type { ItineraryItem } from "@/lib/schema";
import { getFlightDetails, type FlightSegment } from "@/lib/types";

export type FlightScheduleItem = Pick<
  ItineraryItem,
  "category" | "eventDate" | "startDatetime" | "endDatetime" | "details"
>;

type TrackingSnapshot = {
  departure?: { actual?: string | null };
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

function addDaysToDateString(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days, 12, 0, 0));
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`;
}

function parseFlightDurationMinutes(value?: string | null): number | null {
  if (!value?.trim()) return null;
  const trimmed = value.trim();
  const hoursMins = /^(\d+)\s*h(?:\s*(\d+)\s*m)?$/i.exec(trimmed);
  if (hoursMins) {
    return Number(hoursMins[1]) * 60 + Number(hoursMins[2] ?? 0);
  }
  const minsOnly = /^(\d+)\s*m$/i.exec(trimmed);
  if (minsOnly) return Number(minsOnly[1]);
  return null;
}

function segmentLabel(segment: FlightSegment, endpoint: "from" | "to"): string {
  if (endpoint === "from") {
    return (
      segment.fromIata?.trim().toUpperCase() ||
      segment.from?.trim().slice(0, 3).toUpperCase() ||
      "DEP"
    );
  }
  return (
    segment.toIata?.trim().toUpperCase() ||
    segment.to?.trim().slice(0, 3).toUpperCase() ||
    "ARR"
  );
}

function calendarDateForInstant(instant: Date, timeZone: string | null): string {
  if (!timeZone) {
    const pad = (value: number) => String(value).padStart(2, "0");
    return `${instant.getFullYear()}-${pad(instant.getMonth() + 1)}-${pad(instant.getDate())}`;
  }
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(instant);
}

function resolveClockInstant(
  clockValue: string | null | undefined,
  timeZone: string | null,
  afterInstant: Date,
  fallbackDate: string | null,
): Date | null {
  const parsed = parseStoredClockTime(clockValue);
  if (!parsed?.clock) return null;

  let date =
    parsed.embeddedDate ??
    (timeZone
      ? calendarDateForInstant(afterInstant, timeZone)
      : fallbackDate) ??
    calendarDateForInstant(afterInstant, null);

  for (let guard = 0; guard < 6; guard += 1) {
    const instant = timeZone
      ? zonedLocalToUtc(date, parsed.clock, timeZone)
      : (() => {
          const [year, month, day] = date.split("-").map(Number);
          const [hour, minute] = parsed.clock.split(":").map(Number);
          return new Date(year, month - 1, day, hour, minute, 0);
        })();

    if (!instant) return null;
    if (instant.getTime() > afterInstant.getTime()) return instant;
    date = addDaysToDateString(date, 1);
  }

  return null;
}

type ResolvedSegmentWindow = {
  segment: FlightSegment;
  dep: Date;
  arr: Date;
  fromLabel: string;
  toLabel: string;
};

function resolveSegmentWindows(
  segments: FlightSegment[],
  journeyStart: Date,
  journeyEnd: Date,
  eventDate: string | null,
): ResolvedSegmentWindow[] {
  const windows: ResolvedSegmentWindow[] = [];

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const fromLabel = segmentLabel(segment, "from");
    const toLabel = segmentLabel(segment, "to");
    const depTz = getAirportTimezone(segment.fromIata);
    const arrTz = getAirportTimezone(segment.toIata);

    let dep: Date;
    if (index === 0) {
      dep = journeyStart;
    } else {
      const previous = windows[index - 1];
      const depFromClock = resolveClockInstant(
        segment.departureTime,
        depTz,
        previous.arr,
        eventDate,
      );
      dep =
        depFromClock && depFromClock.getTime() > previous.arr.getTime()
          ? depFromClock
          : previous.arr;
    }

    let arr: Date | null = null;
    if (index === segments.length - 1) {
      arr = journeyEnd;
    } else {
      arr = resolveClockInstant(segment.arrivalTime, arrTz, dep, eventDate);
    }

    if (!arr) {
      const durationMinutes = parseFlightDurationMinutes(segment.flightTime);
      if (durationMinutes != null) {
        arr = new Date(dep.getTime() + durationMinutes * 60_000);
      }
    }

    if (!arr) {
      arr = resolveClockInstant(segment.arrivalTime, arrTz, dep, eventDate);
    }

    if (!arr || arr.getTime() <= dep.getTime()) {
      const durationMinutes = parseFlightDurationMinutes(segment.flightTime) ?? 60;
      arr = new Date(dep.getTime() + durationMinutes * 60_000);
    }

    if (index === segments.length - 1 && journeyEnd.getTime() > dep.getTime()) {
      arr = journeyEnd;
    }

    windows.push({ segment, dep, arr, fromLabel, toLabel });
  }

  return windows;
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

function resolveActiveSegmentAndTransit(
  legs: FlightProgressLeg[],
  windows: ResolvedSegmentWindow[],
  nowMs: number,
  phase: FlightProgress["phase"],
): {
  segment: FlightSegmentProgress | null;
  transit: FlightProgress["transit"];
} {
  if (phase === "upcoming" || phase === "landed") {
    return { segment: null, transit: null };
  }

  for (const leg of legs) {
    if (leg.kind === "transit") {
      if (nowMs >= leg.startMs && nowMs < leg.endMs) {
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
      continue;
    }

    if (leg.segmentIndex == null) continue;
    const window = windows[leg.segmentIndex];
    const startMs = leg.startMs;
    const endMs = leg.endMs;
    const legMs = endMs - startMs;
    if (legMs <= 0) continue;

    let segmentPhase: FlightSegmentProgress["phase"] = "upcoming";
    if (nowMs >= endMs) {
      segmentPhase = "complete";
    } else if (nowMs >= startMs) {
      segmentPhase = "active";
    }

    if (segmentPhase !== "active") continue;

    const percent = Math.min(
      100,
      Math.max(0, ((nowMs - startMs) / legMs) * 100),
    );

    return {
      segment: {
        index: leg.segmentIndex,
        fromLabel: window.fromLabel,
        toLabel: window.toLabel,
        percent,
        phase: segmentPhase,
        remainingMinutes: Math.max(0, Math.round((endMs - nowMs) / 60_000)),
        totalMinutes: Math.max(1, Math.round(legMs / 60_000)),
      },
      transit: null,
    };
  }

  return { segment: null, transit: null };
}

function flightSegmentsFromDetails(
  details: ReturnType<typeof getFlightDetails>,
): FlightSegment[] {
  if (!details?.segments?.length) return [];
  return details.segments.filter(
    (segment) => !segment.transit && (segment.fromIata || segment.from),
  );
}

export function computeFlightProgress(
  item: FlightScheduleItem,
  now = new Date(),
): FlightProgress | null {
  if (item.category !== "flight") {
    return null;
  }

  const schedule = resolveFlightSchedule({
    eventDate: item.eventDate,
    startDatetime: item.startDatetime,
    endDatetime: item.endDatetime,
    details: item.details,
  });

  if (!schedule.startDatetime || !schedule.endDatetime) {
    return null;
  }

  const scheduledStart = schedule.startDatetime;
  const scheduledEnd = schedule.endDatetime;
  const totalMs = scheduledEnd.getTime() - scheduledStart.getTime();
  if (totalMs <= 0) return null;

  const snapshot = readTrackingSnapshot(item.details);
  const departureInstant =
    pickDepartureInstant(item, snapshot) ?? scheduledStart;
  const arrivalInstant = pickArrivalInstant(item, snapshot) ?? scheduledEnd;

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
  if (nowMs < showFrom || nowMs > showUntil) return null;

  const flightDetails = getFlightDetails(item.details);
  const fromLabel =
    flightDetails?.fromIata?.trim() ||
    flightDetails?.from?.trim().slice(0, 3).toUpperCase() ||
    "DEP";
  const toLabel =
    flightDetails?.toIata?.trim() ||
    flightDetails?.to?.trim().slice(0, 3).toUpperCase() ||
    "ARR";

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

  const segments = flightSegmentsFromDetails(flightDetails);
  const isMultiSegment = segments.length >= 2;

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

  if (isMultiSegment) {
    const windows = resolveSegmentWindows(
      segments,
      scheduledStart,
      scheduledEnd,
      schedule.eventDate,
    );
    const meta = buildMultiSegmentMeta(
      windows,
      scheduledStartMs,
      scheduledEndMs,
    );
    stops = meta.stops;
    legs = meta.legs;
    const active = resolveActiveSegmentAndTransit(
      legs,
      windows,
      nowMs,
      phase,
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

  const percent = scheduledBarPercent(
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

  const schedule = resolveFlightSchedule({
    eventDate: item.eventDate,
    startDatetime: item.startDatetime,
    endDatetime: item.endDatetime,
    details: item.details,
  });

  if (!schedule.endDatetime) return false;

  const snapshot = readTrackingSnapshot(item.details);
  const nowMs = now.getTime();
  const status = snapshot?.flightStatus?.toLowerCase();
  if (status === "landed") return true;
  return nowMs > schedule.endDatetime.getTime() + 15 * 60_000;
}

/** True while the flight is between scheduled departure and arrival (airborne or en-route). */
export function isFlightInProgress(
  item: FlightScheduleItem,
  now = new Date(),
): boolean {
  if (item.category !== "flight") return false;

  const schedule = resolveFlightSchedule({
    eventDate: item.eventDate,
    startDatetime: item.startDatetime,
    endDatetime: item.endDatetime,
    details: item.details,
  });

  if (!schedule.startDatetime || !schedule.endDatetime) return false;

  const nowMs = now.getTime();
  if (nowMs < schedule.startDatetime.getTime()) return false;
  if (isFlightLanded(item, now)) return false;
  return true;
}

export function getFlightTimelineDisplay(
  item: FlightScheduleItem,
): FlightTimelineDisplay | null {
  if (item.category !== "flight") return null;

  const flightDetails = getFlightDetails(item.details);
  if (!flightDetails) return null;

  const segments = flightSegmentsFromDetails(flightDetails);
  const schedule = resolveFlightSchedule({
    eventDate: item.eventDate,
    startDatetime: item.startDatetime,
    endDatetime: item.endDatetime,
    details: item.details,
  });

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
    const windows = resolveSegmentWindows(
      segments,
      schedule.startDatetime,
      schedule.endDatetime,
      schedule.eventDate,
    );
    const meta = buildMultiSegmentMeta(
      windows,
      schedule.startDatetime.getTime(),
      schedule.endDatetime.getTime(),
    );
    transitStops = meta.stops
      .filter((stop) => stop.kind === "transit")
      .map((stop) => ({
        airport: stop.label,
        layoverMinutes: stop.layoverMinutes ?? 0,
      }))
      .filter((stop) => stop.layoverMinutes > 0);
  }

  return { routeCodes, transitStops };
}

export function formatFlightRouteChain(codes: string[]): string {
  return codes.join(" → ");
}
