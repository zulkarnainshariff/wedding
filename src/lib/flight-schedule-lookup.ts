import { getAirportTimezone } from "@/lib/airport-timezones";
import {
  utcToDatetimeLocalInTimezone,
  type ResolvedFlightSchedule,
  resolveFlightSchedule,
} from "@/lib/flight-datetime";
import { normalizeFlightIata } from "@/lib/flight-numbers";
import type { ItineraryItem } from "@/lib/schema";
import type { FlightDetails } from "@/lib/types";
import { getFlightDetails } from "@/lib/types";

export type FlightScheduleLookupResult = {
  available: boolean;
  reason?:
    | "no_api_key"
    | "missing_flight_number"
    | "missing_date"
    | "not_found"
    | "provider_error";
  message?: string;
  fromIata?: string | null;
  toIata?: string | null;
  departureDatetimeLocal?: string;
  arrivalDatetimeLocal?: string;
  eventDate?: string | null;
  arrivalDate?: string | null;
  departureTime?: string | null;
  arrivalTime?: string | null;
};

type AviationEndpoint = {
  iata?: string | null;
  scheduled?: string | null;
  estimated?: string | null;
  actual?: string | null;
};

type AviationStackFlight = {
  flight_date?: string;
  departure?: AviationEndpoint;
  arrival?: AviationEndpoint;
};

type AirlabsFlight = {
  dep_iata?: string;
  arr_iata?: string;
  dep_time?: string | null;
  dep_time_utc?: string | null;
  dep_estimated?: string | null;
  dep_estimated_utc?: string | null;
  dep_actual?: string | null;
  dep_actual_utc?: string | null;
  arr_time?: string | null;
  arr_time_utc?: string | null;
  arr_estimated?: string | null;
  arr_estimated_utc?: string | null;
  arr_actual?: string | null;
  arr_actual_utc?: string | null;
};

function hasFlightTrackingApiKey(): boolean {
  return Boolean(
    process.env.AIRLABS_API_KEY?.trim() ||
      process.env.AVIATIONSTACK_ACCESS_KEY?.trim(),
  );
}

function normalizeOperatingFlightIata(value: string): string {
  return value.replace(/\s+/g, "").toUpperCase();
}

function extractAirlineIata(flightIata: string): string | null {
  const match = /^([A-Z0-9]{2})/i.exec(flightIata);
  return match ? match[1].toUpperCase() : null;
}

function airlabsUtcToIso(value?: string | null): string | null {
  if (!value?.trim()) return null;
  const trimmed = value.trim();
  if (trimmed.includes("T")) return trimmed;
  return `${trimmed.replace(" ", "T")}:00Z`;
}

function parseAirlabsLocalDateTime(value?: string | null): {
  date: string;
  time: string;
} | null {
  if (!value?.trim()) return null;
  const trimmed = value.trim();
  const match = /^(\d{4}-\d{2}-\d{2})[ T](\d{1,2}):(\d{2})/.exec(trimmed);
  if (!match) return null;
  return {
    date: match[1],
    time: `${match[2].padStart(2, "0")}:${match[3]}`,
  };
}

function flightMatchesDate(flight: AirlabsFlight, flightDate: string): boolean {
  for (const candidate of [
    flight.dep_time_utc,
    flight.dep_estimated_utc,
    flight.dep_actual_utc,
    flight.dep_time,
    flight.dep_estimated,
    flight.dep_actual,
  ]) {
    if (!candidate?.trim()) continue;
    const utcDate = candidate.includes("T")
      ? candidate.split("T")[0]
      : candidate.slice(0, 10);
    if (utcDate === flightDate) return true;
    const local = parseAirlabsLocalDateTime(candidate);
    if (local?.date === flightDate) return true;
  }
  return false;
}

function mapAirlabsFlight(
  flight: AirlabsFlight,
  flightDate: string,
): AviationStackFlight {
  return {
    flight_date: flightDate,
    departure: {
      iata: flight.dep_iata ?? null,
      scheduled: airlabsUtcToIso(flight.dep_time_utc ?? flight.dep_time),
      estimated: airlabsUtcToIso(
        flight.dep_estimated_utc ?? flight.dep_estimated,
      ),
      actual: airlabsUtcToIso(flight.dep_actual_utc ?? flight.dep_actual),
    },
    arrival: {
      iata: flight.arr_iata ?? null,
      scheduled: airlabsUtcToIso(flight.arr_time_utc ?? flight.arr_time),
      estimated: airlabsUtcToIso(
        flight.arr_estimated_utc ?? flight.arr_estimated,
      ),
      actual: airlabsUtcToIso(flight.arr_actual_utc ?? flight.arr_actual),
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

function bestEndpointIso(endpoint?: AviationEndpoint): string | null {
  return (
    endpoint?.estimated?.trim() ||
    endpoint?.actual?.trim() ||
    endpoint?.scheduled?.trim() ||
    null
  );
}

function localDatetimeFromEndpoint(
  endpoint?: AviationEndpoint,
  iata?: string | null,
): { datetimeLocal: string; clock: string; date: string } | null {
  const iso = bestEndpointIso(endpoint);
  if (!iso) return null;

  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;

  const timeZone = getAirportTimezone(iata);
  if (!timeZone) return null;

  const datetimeLocal = utcToDatetimeLocalInTimezone(parsed, timeZone);
  const [date, time] = datetimeLocal.split("T");
  if (!date || !time) return null;

  return {
    datetimeLocal,
    clock: time.slice(0, 5),
    date,
  };
}

export function aviationFlightToLookupResult(
  flight: AviationStackFlight,
): Omit<FlightScheduleLookupResult, "available" | "reason" | "message"> {
  const fromIata = flight.departure?.iata?.trim().toUpperCase() ?? null;
  const toIata = flight.arrival?.iata?.trim().toUpperCase() ?? null;
  const departure = localDatetimeFromEndpoint(flight.departure, fromIata);
  const arrival = localDatetimeFromEndpoint(flight.arrival, toIata);

  return {
    fromIata,
    toIata,
    departureDatetimeLocal: departure?.datetimeLocal,
    arrivalDatetimeLocal: arrival?.datetimeLocal,
    eventDate: departure?.date ?? flight.flight_date ?? null,
    arrivalDate: arrival?.date ?? departure?.date ?? flight.flight_date ?? null,
    departureTime: departure?.clock ?? null,
    arrivalTime: arrival?.clock ?? null,
  };
}

async function fetchAirlabsSchedules(
  params: Record<string, string>,
): Promise<AirlabsFlight[]> {
  const apiKey = process.env.AIRLABS_API_KEY?.trim();
  if (!apiKey) return [];

  const search = new URLSearchParams({ api_key: apiKey, limit: "50", ...params });
  const response = await fetch(
    `https://airlabs.co/api/v9/schedules?${search.toString()}`,
    { cache: "no-store" },
  );
  const payload = (await response.json()) as {
    error?: { message?: string };
    response?: AirlabsFlight[];
  };

  if (!response.ok) {
    const detail = payload.error?.message ?? `HTTP ${response.status}`;
    throw new Error(`AirLabs: ${detail}`);
  }

  return payload.response ?? [];
}

async function fetchAirlabsFlightEndpoint(
  flightIata: string,
): Promise<AirlabsFlight | null> {
  const apiKey = process.env.AIRLABS_API_KEY?.trim();
  if (!apiKey) return null;

  const params = new URLSearchParams({ api_key: apiKey, flight_iata: flightIata });
  const response = await fetch(
    `https://airlabs.co/api/v9/flight?${params.toString()}`,
    { cache: "no-store" },
  );
  const payload = (await response.json()) as {
    error?: { message?: string };
  } & AirlabsFlight;

  if (!response.ok) {
    const detail = payload.error?.message ?? `HTTP ${response.status}`;
    throw new Error(`AirLabs: ${detail}`);
  }

  return parseAirlabsFlightPayload(payload);
}

async function fetchFromAirlabs(input: {
  operatingFlightNumber: string;
  flightDate: string;
  depIata?: string | null;
  arrIata?: string | null;
}): Promise<AviationStackFlight | null> {
  const flightIata = normalizeOperatingFlightIata(input.operatingFlightNumber);
  const depIata = input.depIata?.trim().toUpperCase();
  const arrIata = input.arrIata?.trim().toUpperCase();

  if (depIata) {
    const byDeparture = await fetchAirlabsSchedules({
      dep_iata: depIata,
      flight_iata: flightIata,
    });
    const matches = byDeparture.filter(
      (flight) =>
        flightMatchesDate(flight, input.flightDate) &&
        (!arrIata || !flight.arr_iata || flight.arr_iata.toUpperCase() === arrIata),
    );
    if (matches[0]) return mapAirlabsFlight(matches[0], input.flightDate);
  }

  const airlineIata = extractAirlineIata(flightIata);
  if (airlineIata) {
    const byAirline = await fetchAirlabsSchedules({
      airline_iata: airlineIata,
      flight_iata: flightIata,
    });
    const matches = byAirline.filter((flight) =>
      flightMatchesDate(flight, input.flightDate),
    );
    if (matches[0]) return mapAirlabsFlight(matches[0], input.flightDate);
  }

  const liveFlight = await fetchAirlabsFlightEndpoint(flightIata);
  if (liveFlight && flightMatchesDate(liveFlight, input.flightDate)) {
    return mapAirlabsFlight(liveFlight, input.flightDate);
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
    error?: { message?: string };
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
  const sameDate = flights.filter(
    (flight) => flight.flight_date === input.flightDate,
  );
  const pool = sameDate.length > 0 ? sameDate : flights;
  const arrIata = input.arrIata?.trim().toUpperCase();

  if (arrIata) {
    const withArrival = pool.find(
      (flight) => flight.arrival?.iata?.toUpperCase() === arrIata,
    );
    if (withArrival) return withArrival;
  }

  return pool[0] ?? null;
}

export async function lookupFlightSchedule(input: {
  operatingFlightNumber: string;
  flightDate: string;
  depIata?: string | null;
  arrIata?: string | null;
}): Promise<FlightScheduleLookupResult> {
  const operatingFlightNumber = input.operatingFlightNumber?.trim();
  const flightDate = input.flightDate?.trim();

  if (!operatingFlightNumber) {
    return {
      available: false,
      reason: "missing_flight_number",
      message: "Enter an operating flight number.",
    };
  }

  if (!flightDate) {
    return {
      available: false,
      reason: "missing_date",
      message: "Enter a travel date.",
    };
  }

  if (!hasFlightTrackingApiKey()) {
    return {
      available: false,
      reason: "no_api_key",
      message:
        "Flight schedule lookup needs AIRLABS_API_KEY or AVIATIONSTACK_ACCESS_KEY on the server.",
    };
  }

  try {
    let flight: AviationStackFlight | null = null;

    if (process.env.AIRLABS_API_KEY?.trim()) {
      flight = await fetchFromAirlabs({
        operatingFlightNumber,
        flightDate,
        depIata: input.depIata,
        arrIata: input.arrIata,
      });
    }

    const depIata = normalizeFlightIata(input.depIata);
    if (!flight && depIata && process.env.AVIATIONSTACK_ACCESS_KEY?.trim()) {
      flight = await fetchFromAviationStack({
        operatingFlightNumber,
        depIata,
        flightDate,
        arrIata: input.arrIata,
      });
    }

    if (!flight) {
      return {
        available: false,
        reason: "not_found",
        message:
          "Could not find this flight on that date. Enter departure and arrival times manually.",
      };
    }

    const mapped = aviationFlightToLookupResult(flight);
    if (!mapped.departureDatetimeLocal || !mapped.arrivalDatetimeLocal) {
      return {
        available: false,
        reason: "not_found",
        message:
          "Flight found but times are unavailable. Enter departure and arrival times manually.",
        ...mapped,
      };
    }

    return {
      available: true,
      message: "Times loaded from flight schedule API.",
      ...mapped,
    };
  } catch (error) {
    return {
      available: false,
      reason: "provider_error",
      message:
        error instanceof Error
          ? error.message
          : "Flight schedule provider unavailable.",
    };
  }
}

export function applyLookupToFlightDetails(
  details: FlightDetails,
  lookup: FlightScheduleLookupResult,
): FlightDetails {
  return {
    ...details,
    fromIata: lookup.fromIata ?? details.fromIata,
    toIata: lookup.toIata ?? details.toIata,
    departureTime: lookup.departureTime ?? details.departureTime,
    arrivalTime: lookup.arrivalTime ?? details.arrivalTime,
  };
}

export type FlightScheduleItemPatch = {
  eventDate: string | null;
  startDatetime: string | null;
  endDatetime: string | null;
  details: FlightDetails;
};

export function buildFlightScheduleItemPatch(
  item: Pick<ItineraryItem, "eventDate" | "startDatetime" | "endDatetime" | "details">,
  lookup: FlightScheduleLookupResult,
): FlightScheduleItemPatch | null {
  if (!lookup.available) return null;

  const current = getFlightDetails(item.details) ?? ({} as FlightDetails);
  const nextDetails = applyLookupToFlightDetails(current, lookup);
  const resolved: ResolvedFlightSchedule = resolveFlightSchedule({
    eventDate: lookup.eventDate ?? item.eventDate,
    startDatetime: item.startDatetime,
    endDatetime: item.endDatetime,
    details: nextDetails,
  });

  const startIso = resolved.startDatetime?.toISOString() ?? null;
  const endIso = resolved.endDatetime?.toISOString() ?? null;
  if (!startIso || !endIso) return null;

  return {
    eventDate: resolved.eventDate ?? lookup.eventDate ?? item.eventDate ?? null,
    startDatetime: startIso,
    endDatetime: endIso,
    details: nextDetails,
  };
}
