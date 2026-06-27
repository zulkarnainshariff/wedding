import { resolveFlightSchedule } from "@/lib/flight-datetime";
import { pickArrivalInstant, pickDepartureInstant } from "@/lib/flight-instant-picker";
import type { ItineraryItem } from "@/lib/schema";
import { getFlightDetails } from "@/lib/types";

type TrackingSnapshot = {
  departure?: { actual?: string | null };
  arrival?: { actual?: string | null; estimated?: string | null };
  flightStatus?: string;
};

export type FlightProgress = {
  phase: "upcoming" | "active" | "landed";
  percent: number;
  elapsedMinutes: number;
  remainingMinutes: number;
  totalMinutes: number;
  fromLabel: string;
  toLabel: string;
};

function readTrackingSnapshot(details: unknown): TrackingSnapshot | undefined {
  if (!details || typeof details !== "object") return undefined;
  const raw = (details as Record<string, unknown>)._flightTracking;
  if (!raw || typeof raw !== "object") return undefined;
  const snapshot = (raw as { snapshot?: TrackingSnapshot }).snapshot;
  return snapshot;
}

export function computeFlightProgress(
  item: ItineraryItem,
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
  const startMs = departureInstant.getTime();
  const endMs = arrivalInstant.getTime();
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
  if (nowMs < scheduledStart.getTime()) {
    phase = "upcoming";
  } else if (
    snapshot?.arrival?.actual ||
    nowMs > scheduledEnd.getTime() + 15 * 60_000
  ) {
    phase = "landed";
  } else {
    phase = "active";
  }

  const elapsedMinutes = Math.max(0, Math.round((nowMs - startMs) / 60_000));
  let remainingMinutes: number;
  if (phase === "upcoming") {
    remainingMinutes = Math.max(0, Math.round((startMs - nowMs) / 60_000));
  } else if (phase === "active") {
    remainingMinutes = Math.max(0, Math.round((endMs - nowMs) / 60_000));
  } else {
    remainingMinutes = 0;
  }

  let percent: number;

  if (phase === "upcoming") {
    percent = 0;
  } else if (phase === "landed") {
    percent = 100;
  } else {
    percent = Math.min(
      100,
      Math.max(0, ((nowMs - startMs) / (endMs - startMs)) * 100),
    );
  }

  return {
    phase,
    percent,
    elapsedMinutes: phase === "landed" ? totalMinutes : elapsedMinutes,
    remainingMinutes,
    totalMinutes,
    fromLabel,
    toLabel,
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
  if (progress.phase === "landed") return "Landed";

  if (progress.phase === "active" && progress.remainingMinutes === 0) {
    return "Arriving soon";
  }

  const duration = formatFlightProgressDuration(progress.remainingMinutes);
  if (!duration) return "—";

  if (progress.phase === "upcoming") return `Departs in ${duration}`;
  return `${duration} remaining`;
}
