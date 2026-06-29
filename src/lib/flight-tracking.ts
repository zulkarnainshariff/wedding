import type { FlightDetails } from "@/lib/types";
import { getFlightDetails } from "@/lib/types";
import {
  normalizeFlightIata,
  resolveOperatingFlightNumber,
} from "@/lib/flight-numbers";
import { resolveFlightSchedule } from "@/lib/flight-datetime";
import {
  parseFlightInstant,
  pickApiScheduleInstant,
  pickArrivalInstant,
  pickDepartureInstant,
  type FlightTimingSnapshot,
} from "@/lib/flight-instant-picker";
import { resolveTrackingLegEndpoints, flightSegmentsFromDetails, resolveFlightScheduleForItem } from "@/lib/flight-segment-timing";
import { isFlightLanded as isJourneyLanded } from "@/lib/flight-progress";
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
  depIata?: string | null;
  arrIata?: string | null;
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
  /** ISO time when the current ETA is reached — re-fetch live status if not landed. */
  etaCheckAt?: string | null;
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

type AirlabsFlight = {
  flight_iata?: string;
  status?: string;
  dep_iata?: string;
  dep_terminal?: string | null;
  dep_gate?: string | null;
  dep_time?: string | null;
  dep_time_utc?: string | null;
  dep_estimated?: string | null;
  dep_estimated_utc?: string | null;
  dep_actual?: string | null;
  dep_actual_utc?: string | null;
  dep_delayed?: number | null;
  arr_iata?: string;
  arr_terminal?: string | null;
  arr_gate?: string | null;
  arr_baggage?: string | null;
  arr_time?: string | null;
  arr_time_utc?: string | null;
  arr_estimated?: string | null;
  arr_estimated_utc?: string | null;
  arr_actual?: string | null;
  arr_actual_utc?: string | null;
  arr_delayed?: number | null;
};

function hasFlightTrackingApiKey(): boolean {
  return Boolean(
    process.env.AIRLABS_API_KEY?.trim() ||
      process.env.AVIATIONSTACK_ACCESS_KEY?.trim(),
  );
}

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
    etaCheckAt: value.etaCheckAt ?? null,
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

  const schedule = resolveFlightSchedule({
    eventDate: item.eventDate,
    startDatetime: item.startDatetime,
    endDatetime: item.endDatetime,
    details: item.details,
  });

  if (schedule.startDatetime && schedule.endDatetime) {
    const now = effectiveDate.getTime();
    const start = schedule.startDatetime.getTime() - 60 * 60 * 1000;
    const end = schedule.endDatetime.getTime() + 6 * 60 * 60 * 1000;
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
  return resolveFlightScheduleForItem(item);
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

function airlabsUtcToIso(value?: string | null): string | null {
  if (!value?.trim()) return null;
  const trimmed = value.trim();
  if (trimmed.includes("T")) return trimmed;
  return `${trimmed.replace(" ", "T")}:00Z`;
}

function mapAirlabsStatus(status?: string): string {
  switch (status?.toLowerCase()) {
    case "en-route":
    case "active":
      return "active";
    case "landed":
      return "landed";
    case "scheduled":
      return "scheduled";
    case "cancelled":
      return "cancelled";
    case "diverted":
      return "diverted";
    default:
      return status ?? "scheduled";
  }
}

function mapAirlabsFlight(
  flight: AirlabsFlight,
  flightDate: string,
): AviationStackFlight {
  return {
    flight_date: flightDate,
    flight_status: mapAirlabsStatus(flight.status),
    departure: {
      iata: flight.dep_iata ?? null,
      terminal: flight.dep_terminal ?? null,
      gate: flight.dep_gate ?? null,
      scheduled: airlabsUtcToIso(flight.dep_time_utc ?? flight.dep_time),
      estimated: airlabsUtcToIso(
        flight.dep_estimated_utc ?? flight.dep_estimated,
      ),
      actual: airlabsUtcToIso(flight.dep_actual_utc ?? flight.dep_actual),
      delay: flight.dep_delayed ?? null,
    },
    arrival: {
      iata: flight.arr_iata ?? null,
      terminal: flight.arr_terminal ?? null,
      gate: flight.arr_gate ?? null,
      baggage: flight.arr_baggage ?? null,
      scheduled: airlabsUtcToIso(flight.arr_time_utc ?? flight.arr_time),
      estimated: airlabsUtcToIso(
        flight.arr_estimated_utc ?? flight.arr_estimated,
      ),
      actual: airlabsUtcToIso(flight.arr_actual_utc ?? flight.arr_actual),
      delay: flight.arr_delayed ?? null,
    },
  };
}

function parseAirlabsFlightPayload(payload: unknown): AirlabsFlight | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  if (record.response && typeof record.response === "object") {
    return record.response as AirlabsFlight;
  }
  if (typeof record.flight_iata === "string") {
    return record as AirlabsFlight;
  }
  if (Array.isArray(record.response) && record.response[0]) {
    return record.response[0] as AirlabsFlight;
  }
  return null;
}

function matchesFlightRoute(
  flight: AirlabsFlight,
  depIata: string,
  arrIata?: string | null,
): boolean {
  const depMatch =
    !flight.dep_iata ||
    flight.dep_iata.trim().toUpperCase() === depIata.trim().toUpperCase();
  const arrMatch =
    !arrIata?.trim() ||
    !flight.arr_iata ||
    flight.arr_iata.trim().toUpperCase() === arrIata.trim().toUpperCase();
  return depMatch && arrMatch;
}

async function fetchFromAirlabs(input: {
  operatingFlightNumber: string;
  depIata: string;
  flightDate: string;
  arrIata?: string | null;
}): Promise<AviationStackFlight | null> {
  const apiKey = process.env.AIRLABS_API_KEY?.trim();
  if (!apiKey) return null;

  const flightIata = normalizeOperatingFlightIata(input.operatingFlightNumber);

  const flightParams = new URLSearchParams({
    api_key: apiKey,
    flight_iata: flightIata,
  });
  const flightResponse = await fetch(
    `https://airlabs.co/api/v9/flight?${flightParams.toString()}`,
    { cache: "no-store" },
  );
  const flightPayload = (await flightResponse.json()) as {
    error?: { message?: string };
  } & AirlabsFlight;

  if (!flightResponse.ok) {
    const detail = flightPayload.error?.message ?? `HTTP ${flightResponse.status}`;
    throw new Error(`AirLabs: ${detail}`);
  }

  const liveFlight = parseAirlabsFlightPayload(flightPayload);
  if (
    liveFlight?.flight_iata &&
    matchesFlightRoute(liveFlight, input.depIata, input.arrIata)
  ) {
    return mapAirlabsFlight(liveFlight, input.flightDate);
  }

  const scheduleParams = new URLSearchParams({
    api_key: apiKey,
    dep_iata: input.depIata,
    flight_iata: flightIata,
    limit: "10",
  });

  const scheduleResponse = await fetch(
    `https://airlabs.co/api/v9/schedules?${scheduleParams.toString()}`,
    { cache: "no-store" },
  );
  const schedulePayload = (await scheduleResponse.json()) as {
    error?: { message?: string };
    response?: AirlabsFlight[];
  };

  if (!scheduleResponse.ok) {
    const detail = schedulePayload.error?.message ?? `HTTP ${scheduleResponse.status}`;
    throw new Error(`AirLabs: ${detail}`);
  }

  const scheduleMatches = (schedulePayload.response ?? []).filter((flight) =>
    matchesFlightRoute(flight, input.depIata, input.arrIata),
  );
  if (scheduleMatches.length > 0) {
    return mapAirlabsFlight(scheduleMatches[0], input.flightDate);
  }

  return null;
}

async function fetchLiveFlight(input: {
  operatingFlightNumber: string;
  depIata: string;
  flightDate: string;
  arrIata?: string | null;
}): Promise<AviationStackFlight | null> {
  if (process.env.AIRLABS_API_KEY?.trim()) {
    const airlabs = await fetchFromAirlabs(input);
    if (airlabs) return airlabs;
  }

  if (process.env.AVIATIONSTACK_ACCESS_KEY?.trim()) {
    return fetchFromAviationStack(input);
  }

  return null;
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

function resolveLiveFetchInput(
  item: ItineraryItem,
  details: FlightDetails,
  now: Date,
): {
  operatingFlightNumber: string;
  depIata: string;
  arrIata?: string | null;
  flightDate: string;
} | null {
  const activeLeg = resolveTrackingLegEndpoints(item, now);
  const segments = flightSegmentsFromDetails(details);
  const segmentOperating =
    activeLeg && segments[activeLeg.segmentIndex]
      ? resolveOperatingFlightNumber(segments[activeLeg.segmentIndex])
      : null;
  const operatingFlightNumber =
    segmentOperating ?? resolveOperatingFlightNumber(details);
  const flightDate = getItemCalendarDate(item);
  if (!operatingFlightNumber || !flightDate) return null;

  const depIata =
    activeLeg?.depIata ?? normalizeFlightIata(details.fromIata) ?? null;
  if (!depIata) return null;

  return {
    operatingFlightNumber,
    depIata,
    arrIata: activeLeg?.arrIata ?? normalizeFlightIata(details.toIata),
    flightDate,
  };
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
  return parseFlightInstant(value);
}

function isFlightActiveInAir(snapshot?: FlightTrackingSnapshot): boolean {
  if (!snapshot) return false;
  const status = snapshot.flightStatus?.toLowerCase();
  return status === "active" || status === "en-route";
}

function isSnapshotLanded(snapshot?: FlightTrackingSnapshot): boolean {
  if (!snapshot) return false;
  if (snapshot.flightStatus === "landed") return true;
  return Boolean(snapshot.arrival?.actual);
}

function syncEtaCheckAt(
  state: FlightTrackingState,
  item: ItineraryItem,
  now = new Date(),
): FlightTrackingState {
  if (isSnapshotLanded(state.snapshot)) {
    return { ...state, etaCheckAt: null };
  }

  const arrivalInstant = pickArrivalInstant(
    item,
    state.snapshot as FlightTimingSnapshot | undefined,
    now,
  );
  if (!arrivalInstant) {
    return { ...state, etaCheckAt: null };
  }

  return { ...state, etaCheckAt: arrivalInstant.toISOString() };
}

function isEtaRefreshDue(
  now: Date,
  item: ItineraryItem,
  state: FlightTrackingState,
): boolean {
  if (isSnapshotLanded(state.snapshot)) return false;

  const etaCheckAtMs = state.etaCheckAt
    ? new Date(state.etaCheckAt).getTime()
    : null;
  if (etaCheckAtMs != null && now.getTime() >= etaCheckAtMs) {
    return true;
  }

  const arrivalInstant = pickArrivalInstant(
    item,
    state.snapshot as FlightTimingSnapshot | undefined,
    now,
  );
  if (!arrivalInstant) return false;

  return now.getTime() >= arrivalInstant.getTime();
}

const LANDED_BUFFER_MS = 15 * 60 * 1000;

/** True when we're past scheduled/estimated arrival but snapshot still says airborne. */
function isPastArrivalWindow(
  now: Date,
  item: ItineraryItem,
  snapshot?: FlightTrackingSnapshot,
): boolean {
  if (isSnapshotLanded(snapshot)) return false;

  const arrivalInstant = pickArrivalInstant(
    item,
    snapshot as FlightTimingSnapshot | undefined,
    now,
  );
  const sta = getScheduledArrival(item);
  const endMs = Math.max(
    arrivalInstant?.getTime() ?? 0,
    sta?.getTime() ?? 0,
  );
  if (!endMs) return false;

  return now.getTime() > endMs + LANDED_BUFFER_MS;
}

function inferStatus(
  now: Date,
  item: ItineraryItem,
  snapshot?: FlightTrackingSnapshot,
): string | undefined {
  if (isJourneyLanded(item, now)) return "landed";

  if (snapshot?.flightStatus === "cancelled") return "cancelled";
  if (snapshot?.flightStatus === "diverted") return "diverted";

  const std = getScheduledDeparture(item);
  const sta = getScheduledArrival(item);
  const nowMs = now.getTime();

  if (std && nowMs < std.getTime()) return "scheduled";

  if (isPastArrivalWindow(now, item, snapshot)) return "landed";

  if (isFlightActiveInAir(snapshot)) return "active";

  if (std && nowMs >= std.getTime()) {
    if (snapshot && !isSnapshotLanded(snapshot)) {
      return "active";
    }
    if (sta && nowMs > sta.getTime() + LANDED_BUFFER_MS) {
      return "landed";
    }
    return "active";
  }

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
  const departureInstant = pickDepartureInstant(
    item,
    snapshot as FlightTimingSnapshot | undefined,
    now,
  );
  const arrivalInstant = pickArrivalInstant(
    item,
    snapshot as FlightTimingSnapshot | undefined,
    now,
  );

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

function endpointsFromDetails(
  details: FlightDetails,
  item: ItineraryItem,
): {
  departure?: FlightLiveEndpoint;
  arrival?: FlightLiveEndpoint;
} {
  const scheduledEndpoint = (when: Date | null): FlightLiveEndpoint | undefined => {
    if (!when) return undefined;
    const iso = when.toISOString();
    return {
      terminal: null,
      gate: null,
      baggageCarousel: null,
      scheduled: iso,
      estimated: iso,
      actual: null,
      delayMinutes: null,
    };
  };

  return {
    departure: enrichEndpoint(scheduledEndpoint(getScheduledDeparture(item)), {
      gate: details.departureGate,
      terminal: details.departureTerminal,
    }),
    arrival: enrichEndpoint(scheduledEndpoint(getScheduledArrival(item)), {
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
  const airports = airportCodesForStatus(item);

  return {
    available: true,
    marketingFlightNumber: details.marketingFlightNumber ?? null,
    operatingFlightNumber,
    departure: endpoints.departure,
    arrival: endpoints.arrival,
    depIata: airports.depIata,
    arrIata: airports.arrIata,
    ...timing,
    lastUpdated: state.snapshot?.fetchedAt ?? now.toISOString(),
    cached: true,
    computedOnly: options?.computedOnly ?? true,
  };
}

function airportCodesForStatus(item: ItineraryItem): {
  depIata: string | null;
  arrIata: string | null;
} {
  const leg = resolveTrackingLegEndpoints(item);
  if (leg) {
    return { depIata: leg.depIata, arrIata: leg.arrIata };
  }

  const details = getFlightDetails(item.details);
  return {
    depIata: normalizeFlightIata(details?.fromIata) ?? null,
    arrIata: normalizeFlightIata(details?.toIata) ?? null,
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
    key:
      | "departureTerminal"
      | "departureGate"
      | "arrivalTerminal"
      | "arrivalGate",
    value?: string | null,
  ) => {
    const trimmed = value?.trim();
    if (!trimmed || next[key] === trimmed) return;
    next[key] = trimmed;
    changed = true;
  };

  assign("departureTerminal", live.departure?.terminal);
  assign("departureGate", live.departure?.gate);
  assign("arrivalTerminal", live.arrival?.terminal);
  assign("arrivalGate", live.arrival?.gate);

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
    const now = effectiveDate;
    const schedule = resolveFlightSchedule({
      eventDate: item.eventDate,
      startDatetime: item.startDatetime,
      endDatetime: item.endDatetime,
      details: item.details,
    });
    const operatingFlightNumber = resolveOperatingFlightNumber(details);
    const fetchInput = resolveLiveFetchInput(item, details, now);
    const withinPostLandingWindow =
      schedule.endDatetime &&
      now.getTime() > schedule.endDatetime.getTime() &&
      now.getTime() - schedule.endDatetime.getTime() < 72 * 60 * 60 * 1000;
    const shouldRefreshPastFlight =
      withinPostLandingWindow &&
      hasFlightTrackingApiKey() &&
      fetchInput &&
      operatingFlightNumber &&
      (!trackingState.snapshot ||
        isPastArrivalWindow(now, item, trackingState.snapshot));

    if (shouldRefreshPastFlight) {
      try {
        const flight = await fetchLiveFlight(fetchInput);
        if (flight) {
          trackingState = syncEtaCheckAt(
            {
              ...trackingState,
              snapshot: buildSnapshot(flight),
            },
            item,
          );
        }
      } catch {
        // Fall back to schedule-only display below.
      }
    }

    if (trackingState.snapshot) {
      trackingState = syncEtaCheckAt(trackingState, item);
      return {
        status: {
          ...buildStatusFromSnapshot(item, details, trackingState, {
            computedOnly: true,
          }),
          message: "Last live update from travel day.",
        },
        trackingState,
        details: withTrackingState(workingDetails, trackingState),
      };
    }

    const timing = computeDisplayTiming(now, item);
    const endpoints = endpointsFromDetails(details, item);
    const airports = airportCodesForStatus(item);
    return {
      status: {
        available: true,
        computedOnly: true,
        marketingFlightNumber: details.marketingFlightNumber ?? null,
        operatingFlightNumber,
        departure: endpoints.departure,
        arrival: endpoints.arrival,
        depIata: airports.depIata,
        arrIata: airports.arrIata,
        ...timing,
        message: "Live gate and baggage updates appear on the day of travel.",
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

  const fetchInput = resolveLiveFetchInput(item, details, new Date());
  if (!fetchInput) {
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

  if (!hasFlightTrackingApiKey()) {
    return {
      status: {
        available: false,
        reason: "no_api_key",
        message:
          "Live tracking needs an API key. Add AIRLABS_API_KEY or AVIATIONSTACK_ACCESS_KEY to .env, then restart the server.",
      },
      trackingState,
      details: workingDetails,
    };
  }

  const now = new Date();
  const triggers = dueTriggers(now, item, trackingState);
  const timingPreview = computeDisplayTiming(now, item, trackingState.snapshot);
  const snapshotAgeMs = trackingState.snapshot?.fetchedAt
    ? now.getTime() - new Date(trackingState.snapshot.fetchedAt).getTime()
    : Number.POSITIVE_INFINITY;
  const shouldRefreshActive =
    timingPreview.flightStatus === "active" &&
    snapshotAgeMs > 10 * 60 * 1000;
  const etaRefreshDue = isEtaRefreshDue(now, item, trackingState);
  const shouldBootstrapLive =
    isFlightTrackingDay(item, now) && !trackingState.snapshot;

  if (
    triggers.length > 0 ||
    shouldRefreshActive ||
    etaRefreshDue ||
    shouldBootstrapLive
  ) {
    try {
      const flight = await fetchLiveFlight(fetchInput);

      if (flight) {
        const snapshot = buildSnapshot(flight);
        trackingState = syncEtaCheckAt(
          {
            ...trackingState,
            snapshot,
            completedTriggers: [
              ...new Set([
                ...trackingState.completedTriggers,
                ...triggers,
                ...(shouldRefreshActive ? (["midflight"] as FetchTrigger[]) : []),
              ]),
            ],
          },
          item,
        );

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
    const endpoints = endpointsFromDetails(details, item);
    const airports = airportCodesForStatus(item);
    return {
      status: {
        available: true,
        computedOnly: true,
        marketingFlightNumber: details.marketingFlightNumber ?? null,
        operatingFlightNumber,
        departure: endpoints.departure,
        arrival: endpoints.arrival,
        depIata: airports.depIata,
        arrIata: airports.arrIata,
        ...timing,
        lastUpdated: now.toISOString(),
        message:
          "Using scheduled times until the first live update (5 minutes after departure).",
      },
      trackingState,
      details: workingDetails,
    };
  }

  trackingState = syncEtaCheckAt(trackingState, item);
  workingDetails = withTrackingState(workingDetails, trackingState);

  return {
    status: buildStatusFromSnapshot(item, details, trackingState, {
      computedOnly:
        triggers.length === 0 &&
        !shouldRefreshActive &&
        !etaRefreshDue &&
        !shouldBootstrapLive,
    }),
    trackingState,
    details: workingDetails,
  };
}

export function formatFlightDuration(
  totalMinutes: number | null | undefined,
  options?: { zeroLabel?: string },
) {
  if (totalMinutes == null) return null;
  if (totalMinutes === 0 && options?.zeroLabel) return options.zeroLabel;
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
