import type { FlightDetails } from "@/lib/types";
import {
  normalizeFlightIata,
  resolveOperatingFlightNumber,
} from "@/lib/flight-numbers";
import { resolveFlightSchedule } from "@/lib/flight-datetime";
import { getItemCalendarDate } from "@/lib/item-scheduling";
import { getTodayDate, toDateString } from "@/lib/trip-time";
import type { ItineraryItem } from "@/lib/schema";

export type FlightLiveEndpoint = {
  terminal?: string | null;
  gate?: string | null;
  baggageCarousel?: string | null;
  scheduled?: string | null;
  estimated?: string | null;
  actual?: string | null;
  delayMinutes?: number | null;
};

export type FlightLiveStatus = {
  available: boolean;
  reason?:
    | "no_api_key"
    | "outside_window"
    | "missing_flight_number"
    | "missing_airport_code"
    | "not_found"
    | "provider_error";
  message?: string;
  flightStatus?: string;
  marketingFlightNumber?: string | null;
  operatingFlightNumber?: string | null;
  departure?: FlightLiveEndpoint;
  arrival?: FlightLiveEndpoint;
  elapsedMinutes?: number | null;
  remainingMinutes?: number | null;
  lastUpdated?: string;
  cached?: boolean;
  computedOnly?: boolean;
  detailsUpdated?: boolean;
};

type FetchTrigger =
  | "after_std_5"
  | "after_delay_30"
  | "midflight"
  | "before_eta_5"
  | "after_landing";

type FlightTrackingSnapshot = {
  flightStatus?: string;
  departure?: FlightLiveEndpoint;
  arrival?: FlightLiveEndpoint;
  fetchedAt: string;
};

type FlightTrackingState = {
  completedTriggers: FetchTrigger[];
  delayRetryAt?: string | null;
  snapshot?: FlightTrackingSnapshot;
};

type AviationStackFlight = {
  flight_date?: string;
  flight_status?: string;
  departure?: {
    iata?: string | null;
    terminal?: string | null;
    gate?: string | null;
    scheduled?: string | null;
    estimated?: string | null;
    actual?: string | null;
    delay?: number | null;
  };
  arrival?: {
    iata?: string | null;
    terminal?: string | null;
    gate?: string | null;
    baggage?: string | null;
    scheduled?: string | null;
    estimated?: string | null;
    actual?: string | null;
    delay?: number | null;
  };
};

const TRACKING_KEY = "_flightTracking";

function readTrackingState(details: FlightDetails): FlightTrackingState {
  const raw = (details as Record<string, unknown>)[TRACKING_KEY];
  if (!raw || typeof raw !== "object") {
    return { completedTriggers: [] };
  }
  const value = raw as Partial<FlightTrackingState>;
  return {
    completedTriggers: Array.isArray(value.completedTriggers)
      ? value.completedTriggers.filter((entry): entry is FetchTrigger =>
          [
            "after_std_5",
            "after_delay_30",
            "midflight",
            "before_eta_5",
            "after_landing",
          ].includes(entry as FetchTrigger),
        )
      : [],
    delayRetryAt: value.delayRetryAt ?? null,
    snapshot: value.snapshot,
  };
}

export function getStoredTrackingState(
  details: FlightDetails,
): FlightTrackingState {
  return readTrackingState(details);
}

export function withTrackingState(
  details: FlightDetails,
  state: FlightTrackingState,
): FlightDetails {
  return {
    ...details,
    [TRACKING_KEY]: state,
  } as FlightDetails;
}

export function isFlightTrackingDay(
  item: ItineraryItem,
  effectiveDate = getTodayDate(),
): boolean {
  const flightDate = getItemCalendarDate(item);
  const today = toDateString(effectiveDate);
  if (flightDate === today) return true;

  if (item.startDatetime && item.endDatetime) {
    const schedule = resolveFlightSchedule({
      eventDate: item.eventDate,
      startDatetime: item.startDatetime,
      endDatetime: item.endDatetime,
      details: item.details,
    });
    const startAt = schedule.startDatetime ?? new Date(item.startDatetime);
    const endAt = schedule.endDatetime ?? new Date(item.endDatetime);
    const now = effectiveDate.getTime();
    const start = startAt.getTime();
    const end = endAt.getTime() + 2 * 60 * 60 * 1000;
    return now >= start && now <= end;
  }

  return false;
}

function minutesBetween(start: Date, end: Date): number {
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60_000));
}

function mapDepartureEndpoint(
  endpoint?: AviationStackFlight["departure"],
): FlightLiveEndpoint | undefined {
  if (!endpoint) return undefined;
  return {
    terminal: endpoint.terminal ?? null,
    gate: endpoint.gate ?? null,
    scheduled: endpoint.scheduled ?? null,
    estimated: endpoint.estimated ?? null,
    actual: endpoint.actual ?? null,
    delayMinutes: typeof endpoint.delay === "number" ? endpoint.delay : null,
  };
}

function mapArrivalEndpoint(
  endpoint?: AviationStackFlight["arrival"],
): FlightLiveEndpoint | undefined {
  if (!endpoint) return undefined;
  return {
    terminal: endpoint.terminal ?? null,
    gate: endpoint.gate ?? null,
    baggageCarousel: endpoint.baggage ?? null,
    scheduled: endpoint.scheduled ?? null,
    estimated: endpoint.estimated ?? null,
    actual: endpoint.actual ?? null,
    delayMinutes: typeof endpoint.delay === "number" ? endpoint.delay : null,
  };
}

function getFlightSchedule(item: ItineraryItem) {
  return resolveFlightSchedule({
    eventDate: item.eventDate,
    startDatetime: item.startDatetime,
    endDatetime: item.endDatetime,
    details: item.details,
  });
}

function getScheduledDeparture(item: ItineraryItem): Date | null {
  return getFlightSchedule(item).startDatetime;
}

function getScheduledArrival(item: ItineraryItem): Date | null {
  return getFlightSchedule(item).endDatetime;
}

function normalizeOperatingFlightIata(value: string): string {
  return value.replace(/\s+/g, "").toUpperCase();
}

async function fetchFromAviationStack(input: {
  operatingFlightNumber: string;
  depIata: string;
  flightDate: string;
  arrIata?: string | null;
}): Promise<AviationStackFlight | null> {
  const accessKey = process.env.AVIATIONSTACK_ACCESS_KEY?.trim();
  if (!accessKey) return null;

  const params = new URLSearchParams({
    access_key: accessKey,
    flight_iata: normalizeOperatingFlightIata(input.operatingFlightNumber),
    dep_iata: input.depIata,
    limit: "10",
  });

  const response = await fetch(
    `http://api.aviationstack.com/v1/flights?${params.toString()}`,
    { cache: "no-store" },
  );

  const payload = (await response.json()) as {
    error?: { code?: string; message?: string };
    data?: AviationStackFlight[];
  };

  if (!response.ok) {
    const detail = payload.error?.message ?? `HTTP ${response.status}`;
    throw new Error(`AviationStack: ${detail}`);
  }

  if (payload.error?.message) {
    throw new Error(payload.error.message);
  }

  const flights = payload.data ?? [];
  if (flights.length === 0) return null;

  const arrIata = input.arrIata?.trim().toUpperCase();
  const sameDate = flights.filter(
    (flight) => flight.flight_date === input.flightDate,
  );
  const pool = sameDate.length > 0 ? sameDate : flights;

  if (arrIata) {
    const withArrival = pool.find(
      (flight) => flight.arrival?.iata?.toUpperCase() === arrIata,
    );
    if (withArrival) return withArrival;
  }

  return pool[0] ?? null;
}

function buildSnapshot(flight: AviationStackFlight): FlightTrackingSnapshot {
  return {
    flightStatus: flight.flight_status,
    departure: mapDepartureEndpoint(flight.departure),
    arrival: mapArrivalEndpoint(flight.arrival),
    fetchedAt: new Date().toISOString(),
  };
}

function parseInstant(value?: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** AviationStack free tier often returns local airport times mis-tagged as UTC. */
function pickApiScheduleInstant(
  api: Date | null,
  itemAnchor: Date | null,
): Date | null {
  if (!api) return null;
  if (!itemAnchor) return api;
  if (Math.abs(api.getTime() - itemAnchor.getTime()) > 3 * 60 * 60 * 1000) {
    return itemAnchor;
  }
  return api;
}

function pickDepartureInstant(
  item: ItineraryItem,
  snapshot?: FlightTrackingSnapshot,
): Date | null {
  const itemStd = getScheduledDeparture(item);
  const actual = parseInstant(snapshot?.departure?.actual);
  if (actual) return actual;
  if (itemStd) return itemStd;
  return pickApiScheduleInstant(
    parseInstant(snapshot?.departure?.estimated) ??
      parseInstant(snapshot?.departure?.scheduled),
    itemStd,
  );
}

function pickArrivalInstant(
  item: ItineraryItem,
  snapshot?: FlightTrackingSnapshot,
): Date | null {
  const itemSta = getScheduledArrival(item);
  const actual = parseInstant(snapshot?.arrival?.actual);
  if (actual) return actual;
  if (itemSta) return itemSta;
  return pickApiScheduleInstant(
    parseInstant(snapshot?.arrival?.estimated) ??
      parseInstant(snapshot?.arrival?.scheduled),
    itemSta,
  );
}

function inferStatus(
  now: Date,
  item: ItineraryItem,
  snapshot?: FlightTrackingSnapshot,
): string | undefined {
  const std = getScheduledDeparture(item);
  const sta = getScheduledArrival(item);
  const nowMs = now.getTime();
  const landedBufferMs = 10 * 60 * 1000;

  if (snapshot?.flightStatus === "landed") return "landed";
  if (snapshot?.arrival?.actual) return "landed";

  if (sta && nowMs > sta.getTime() + landedBufferMs) {
    return "landed";
  }

  if (snapshot?.flightStatus === "cancelled") return "cancelled";
  if (snapshot?.flightStatus === "diverted") return "diverted";

  if (std && nowMs < std.getTime()) return "scheduled";

  if (
    snapshot?.flightStatus === "active" &&
    sta &&
    nowMs <= sta.getTime() + landedBufferMs
  ) {
    return "active";
  }

  if (sta && nowMs > sta.getTime()) return "landed";
  if (std && nowMs >= std.getTime()) return "active";

  return snapshot?.flightStatus ?? "scheduled";
}

function computeDisplayTiming(
  now: Date,
  item: ItineraryItem,
  snapshot?: FlightTrackingSnapshot,
): Pick<FlightLiveStatus, "elapsedMinutes" | "remainingMinutes" | "flightStatus"> {
  const status = inferStatus(now, item, snapshot);
  const std = getScheduledDeparture(item);
  const sta = getScheduledArrival(item);
  const departureInstant = pickDepartureInstant(item, snapshot);
  const arrivalInstant = pickArrivalInstant(item, snapshot);

  if (status === "landed") {
    const elapsed =
      departureInstant && arrivalInstant
        ? minutesBetween(departureInstant, arrivalInstant)
        : std && sta
          ? minutesBetween(std, sta)
          : null;
    return {
      flightStatus: status,
      elapsedMinutes: elapsed,
      remainingMinutes: 0,
    };
  }

  if (
    status === "active" &&
    departureInstant &&
    !Number.isNaN(departureInstant.getTime())
  ) {
    return {
      flightStatus: status,
      elapsedMinutes: minutesBetween(departureInstant, now),
      remainingMinutes:
        arrivalInstant && !Number.isNaN(arrivalInstant.getTime())
          ? minutesBetween(now, arrivalInstant)
          : null,
    };
  }

  if (status === "scheduled" && departureInstant) {
    const untilDeparture = minutesBetween(now, departureInstant);
    return {
      flightStatus: status,
      elapsedMinutes: null,
      remainingMinutes: untilDeparture > 0 ? untilDeparture : null,
    };
  }

  return { flightStatus: status, elapsedMinutes: null, remainingMinutes: null };
}

function dueTriggers(
  now: Date,
  item: ItineraryItem,
  state: FlightTrackingState,
): FetchTrigger[] {
  const std = getScheduledDeparture(item);
  const sta = getScheduledArrival(item);
  if (!std || !sta) return [];

  const completed = new Set(state.completedTriggers);
  const due: FetchTrigger[] = [];
  const nowMs = now.getTime();

  const schedule: { trigger: FetchTrigger; at: number }[] = [
    { trigger: "after_std_5", at: std.getTime() + 5 * 60 * 1000 },
    {
      trigger: "midflight",
      at: std.getTime() + (sta.getTime() - std.getTime()) / 2,
    },
    { trigger: "before_eta_5", at: sta.getTime() - 5 * 60 * 1000 },
    { trigger: "after_landing", at: sta.getTime() + 15 * 60 * 1000 },
  ];

  for (const entry of schedule) {
    if (nowMs >= entry.at && !completed.has(entry.trigger)) {
      due.push(entry.trigger);
    }
  }

  if (
    state.delayRetryAt &&
    nowMs >= new Date(state.delayRetryAt).getTime() &&
    !completed.has("after_delay_30")
  ) {
    due.push("after_delay_30");
  }

  return due;
}

function enrichEndpoint(
  live: FlightLiveEndpoint | undefined,
  saved: { gate?: string | null; terminal?: string | null },
): FlightLiveEndpoint | undefined {
  const gate = live?.gate?.trim() || saved.gate?.trim() || null;
  const terminal = live?.terminal?.trim() || saved.terminal?.trim() || null;
  const baggageCarousel = live?.baggageCarousel?.trim() || null;
  const hasTiming =
    Boolean(live?.scheduled) ||
    Boolean(live?.estimated) ||
    Boolean(live?.actual) ||
    live?.delayMinutes != null;

  if (!gate && !terminal && !baggageCarousel && !hasTiming) return undefined;

  return {
    terminal,
    gate,
    baggageCarousel,
    scheduled: live?.scheduled ?? null,
    estimated: live?.estimated ?? null,
    actual: live?.actual ?? null,
    delayMinutes: live?.delayMinutes ?? null,
  };
}

function endpointsFromDetails(details: FlightDetails): {
  departure?: FlightLiveEndpoint;
  arrival?: FlightLiveEndpoint;
} {
  return {
    departure: enrichEndpoint(undefined, {
      gate: details.departureGate,
      terminal: details.departureTerminal,
    }),
    arrival: enrichEndpoint(undefined, {
      gate: details.arrivalGate,
      terminal: details.arrivalTerminal,
    }),
  };
}

function mergeEndpointsFromDetails(
  details: FlightDetails,
  snapshot?: FlightTrackingSnapshot,
): { departure?: FlightLiveEndpoint; arrival?: FlightLiveEndpoint } {
  return {
    departure: enrichEndpoint(snapshot?.departure, {
      gate: details.departureGate,
      terminal: details.departureTerminal,
    }),
    arrival: enrichEndpoint(snapshot?.arrival, {
      gate: details.arrivalGate,
      terminal: details.arrivalTerminal,
    }),
  };
}

function buildStatusFromSnapshot(
  item: ItineraryItem,
  details: FlightDetails,
  state: FlightTrackingState,
  options?: { computedOnly?: boolean },
): FlightLiveStatus {
  const now = new Date();
  const timing = computeDisplayTiming(now, item, state.snapshot);
  const operatingFlightNumber = resolveOperatingFlightNumber(details);
  const endpoints = mergeEndpointsFromDetails(details, state.snapshot);

  return {
    available: true,
    marketingFlightNumber: details.marketingFlightNumber ?? null,
    operatingFlightNumber,
    departure: endpoints.departure,
    arrival: endpoints.arrival,
    ...timing,
    lastUpdated: state.snapshot?.fetchedAt ?? now.toISOString(),
    cached: true,
    computedOnly: options?.computedOnly ?? true,
  };
}

export function mergeLiveGateUpdates(
  details: FlightDetails,
  live: FlightLiveStatus,
): { details: FlightDetails; changed: boolean } {
  if (!live.departure && !live.arrival) {
    return { details, changed: false };
  }

  const next: FlightDetails = { ...details };
  let changed = false;

  const assign = (
    key: "departureTerminal" | "departureGate",
    value?: string | null,
  ) => {
    const trimmed = value?.trim();
    if (!trimmed || next[key] === trimmed) return;
    next[key] = trimmed;
    changed = true;
  };

  assign("departureTerminal", live.departure?.terminal);
  assign("departureGate", live.departure?.gate);

  return { details: next, changed };
}

export async function getFlightLiveStatus(
  item: ItineraryItem,
  details: FlightDetails,
  options?: { effectiveDate?: Date },
): Promise<{
  status: FlightLiveStatus;
  trackingState: FlightTrackingState;
  details: FlightDetails;
}> {
  const effectiveDate = options?.effectiveDate ?? getTodayDate();
  let trackingState = readTrackingState(details);
  let workingDetails = details;

  if (!isFlightTrackingDay(item, effectiveDate)) {
    return {
      status: {
        available: false,
        reason: "outside_window",
        message: "Live tracking is available on the day of travel.",
      },
      trackingState,
      details: workingDetails,
    };
  }

  const operatingFlightNumber = resolveOperatingFlightNumber(details);
  if (!operatingFlightNumber) {
    return {
      status: {
        available: false,
        reason: "missing_flight_number",
        message: "Add an operating flight number to enable tracking.",
      },
      trackingState,
      details: workingDetails,
    };
  }

  const depIata = normalizeFlightIata(details.fromIata);
  if (!depIata) {
    return {
      status: {
        available: false,
        reason: "missing_airport_code",
        message: "Add the departure airport IATA code (e.g. MEL).",
      },
      trackingState,
      details: workingDetails,
    };
  }

  const flightDate = getItemCalendarDate(item);
  if (!flightDate) {
    return {
      status: {
        available: false,
        reason: "outside_window",
        message: "This flight has no travel date.",
      },
      trackingState,
      details: workingDetails,
    };
  }

  if (!process.env.AVIATIONSTACK_ACCESS_KEY?.trim()) {
    return {
      status: {
        available: false,
        reason: "no_api_key",
        message:
          "Live tracking needs a free API key. Add AVIATIONSTACK_ACCESS_KEY to .env.local, then restart the dev server.",
      },
      trackingState,
      details: workingDetails,
    };
  }

  const now = new Date();
  const triggers = dueTriggers(now, item, trackingState);

  if (triggers.length > 0) {
    try {
      const flight = await fetchFromAviationStack({
        operatingFlightNumber,
        depIata,
        flightDate,
        arrIata: normalizeFlightIata(details.toIata),
      });

      if (flight) {
        const snapshot = buildSnapshot(flight);
        trackingState = {
          ...trackingState,
          snapshot,
          completedTriggers: [
            ...new Set([...trackingState.completedTriggers, ...triggers]),
          ],
        };

        if (
          triggers.includes("after_std_5") &&
          (snapshot.departure?.delayMinutes ?? 0) > 0 &&
          !trackingState.delayRetryAt
        ) {
          trackingState.delayRetryAt = new Date(
            now.getTime() + 30 * 60 * 1000,
          ).toISOString();
        }

        if (triggers.includes("after_delay_30")) {
          trackingState.delayRetryAt = null;
        }
      } else if (!trackingState.snapshot) {
        return {
          status: {
            available: false,
            reason: "not_found",
            message: "No live data found for this flight yet.",
            operatingFlightNumber,
            marketingFlightNumber: details.marketingFlightNumber ?? null,
            lastUpdated: now.toISOString(),
          },
          trackingState,
          details: workingDetails,
        };
      }
    } catch (error) {
      if (!trackingState.snapshot) {
        return {
          status: {
            available: false,
            reason: "provider_error",
            message:
              error instanceof Error
                ? error.message
                : "Flight provider unavailable.",
            operatingFlightNumber,
            marketingFlightNumber: details.marketingFlightNumber ?? null,
            lastUpdated: now.toISOString(),
          },
          trackingState,
          details: workingDetails,
        };
      }
    }
  }

  if (!trackingState.snapshot) {
    const timing = computeDisplayTiming(now, item);
    const endpoints = endpointsFromDetails(details);
    return {
      status: {
        available: true,
        computedOnly: true,
        marketingFlightNumber: details.marketingFlightNumber ?? null,
        operatingFlightNumber,
        departure: endpoints.departure,
        arrival: endpoints.arrival,
        ...timing,
        lastUpdated: now.toISOString(),
        message:
          "Using scheduled times until the first live update (5 minutes after departure).",
      },
      trackingState,
      details: workingDetails,
    };
  }

  workingDetails = withTrackingState(workingDetails, trackingState);

  return {
    status: buildStatusFromSnapshot(item, details, trackingState, {
      computedOnly: triggers.length === 0,
    }),
    trackingState,
    details: workingDetails,
  };
}

export function formatFlightDuration(totalMinutes: number | null | undefined) {
  if (totalMinutes == null) return null;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

export function formatFlightStatusLabel(status?: string) {
  switch (status) {
    case "scheduled":
      return "Scheduled";
    case "active":
      return "In the air";
    case "landed":
      return "Landed";
    case "cancelled":
      return "Cancelled";
    case "diverted":
      return "Diverted";
    case "incident":
      return "Incident";
    default:
      return status ? status.replace(/_/g, " ") : "Unknown";
  }
}
