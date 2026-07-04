import { resolveAirportCity } from "@/lib/airport-cities";
import {
  airlineInfoFromAirlabsLeg,
  airlineInfoFromFlightNumbers,
} from "@/lib/airlines";
import { getAirportTimezone } from "@/lib/airport-timezones";
import {
  utcToDatetimeLocalInTimezone,
  type ResolvedFlightSchedule,
  resolveFlightSchedule,
} from "@/lib/flight-datetime";
import {
  airportCityLabel,
  type AirlabsLeg,
  routeFieldsFromLegChain,
  sliceLegsFromDeparture,
} from "@/lib/flight-segment-route";
import { normalizeFlightIata } from "@/lib/flight-numbers";
import {
  flightSegmentsFromDetails,
  resolveMultiSegmentJourneyBounds,
  segmentLabel,
} from "@/lib/flight-segment-timing";
import type { ItineraryItem } from "@/lib/schema";
import type { FlightDetails, FlightSegment } from "@/lib/types";
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
  fromCity?: string | null;
  toCity?: string | null;
  departureDatetimeLocal?: string;
  arrivalDatetimeLocal?: string;
  eventDate?: string | null;
  arrivalDate?: string | null;
  departureTime?: string | null;
  arrivalTime?: string | null;
  aircraft?: string | null;
  totalFlightTime?: string | null;
  departureTerminal?: string | null;
  departureGate?: string | null;
  arrivalTerminal?: string | null;
  arrivalGate?: string | null;
  segments?: FlightSegment[];
  airlineIata?: string | null;
  airlineName?: string | null;
  operatingAirlineIata?: string | null;
  operatingAirlineName?: string | null;
  marketingFlightNumber?: string | null;
  operatingFlightNumber?: string | null;
  fieldErrors?: {
    from?: string;
    to?: string;
    fromIata?: string;
    toIata?: string;
  };
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

type AirlabsFlight = AirlabsLeg;

type AirlabsLookupMatch = {
  flight: AviationStackFlight;
  raw: AirlabsFlight;
  legs: AirlabsFlight[];
};

function formatDurationMinutes(minutes?: number | null): string | null {
  if (minutes == null || minutes <= 0) return null;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours <= 0) return `${mins}m`;
  if (mins <= 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

function enrichLookupFromRaw(
  mapped: Omit<
    FlightScheduleLookupResult,
    "available" | "reason" | "message" | "fieldErrors"
  >,
  raw?: AirlabsFlight,
  operatingFlightNumber?: string | null,
): Omit<
  FlightScheduleLookupResult,
  "available" | "reason" | "message" | "fieldErrors"
> {
  const fromIata = mapped.fromIata ?? raw?.dep_iata?.trim().toUpperCase() ?? null;
  const toIata = mapped.toIata ?? raw?.arr_iata?.trim().toUpperCase() ?? null;
  const airline = raw
    ? airlineInfoFromAirlabsLeg(raw)
    : airlineInfoFromFlightNumbers({
        marketingFlightNumber: operatingFlightNumber,
        operatingFlightNumber,
      });

  return {
    ...mapped,
    fromIata,
    toIata,
    fromCity:
      airportCityLabel(raw?.dep_city, fromIata) ||
      mapped.fromCity ||
      null,
    toCity:
      airportCityLabel(raw?.arr_city, toIata) ||
      mapped.toCity ||
      null,
    aircraft: raw?.aircraft_iata?.trim() || raw?.aircraft_icao?.trim() || mapped.aircraft || null,
    totalFlightTime:
      formatDurationMinutes(raw?.duration) || mapped.totalFlightTime || null,
    departureTerminal: raw?.dep_terminal?.trim() || mapped.departureTerminal || null,
    departureGate: raw?.dep_gate?.trim() || mapped.departureGate || null,
    arrivalTerminal: raw?.arr_terminal?.trim() || mapped.arrivalTerminal || null,
    arrivalGate: raw?.arr_gate?.trim() || mapped.arrivalGate || null,
    airlineIata: airline.airlineIata,
    airlineName: airline.airlineName,
    operatingAirlineIata: airline.operatingAirlineIata,
    operatingAirlineName: airline.operatingAirlineName,
    marketingFlightNumber: airline.marketingFlightNumber,
    operatingFlightNumber: airline.operatingFlightNumber,
  };
}

async function enrichLookupCities<
  T extends {
    fromIata?: string | null;
    toIata?: string | null;
    fromCity?: string | null;
    toCity?: string | null;
    segments?: FlightSegment[];
  },
>(mapped: T): Promise<T> {
  let fromCity = mapped.fromCity;
  let toCity = mapped.toCity;

  if (!fromCity && mapped.fromIata) {
    fromCity = await resolveAirportCity(mapped.fromIata);
  }
  if (!toCity && mapped.toIata) {
    toCity = await resolveAirportCity(mapped.toIata);
  }

  let segments = mapped.segments;
  if (segments?.length) {
    segments = await Promise.all(
      segments.map(async (segment) => {
        let from = segment.from;
        let to = segment.to;
        if (!from && segment.fromIata) {
          from = (await resolveAirportCity(segment.fromIata)) ?? undefined;
        }
        if (!to && segment.toIata) {
          to = (await resolveAirportCity(segment.toIata)) ?? undefined;
        }
        if (from === segment.from && to === segment.to) return segment;
        return { ...segment, from, to };
      }),
    );
  }

  if (
    fromCity === mapped.fromCity &&
    toCity === mapped.toCity &&
    segments === mapped.segments
  ) {
    return mapped;
  }

  return {
    ...mapped,
    fromCity,
    toCity,
    segments,
  };
}

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
): Omit<
  FlightScheduleLookupResult,
  "available" | "reason" | "message" | "fieldErrors"
> {
  const fromIata = flight.departure?.iata?.trim().toUpperCase() ?? null;
  const toIata = flight.arrival?.iata?.trim().toUpperCase() ?? null;
  const departure = localDatetimeFromEndpoint(flight.departure, fromIata);
  const arrival = localDatetimeFromEndpoint(flight.arrival, toIata);

  return {
    fromIata,
    toIata,
    fromCity: airportCityLabel(null, fromIata),
    toCity: airportCityLabel(null, toIata),
    departureDatetimeLocal: departure?.datetimeLocal,
    arrivalDatetimeLocal: arrival?.datetimeLocal,
    eventDate: departure?.date ?? flight.flight_date ?? null,
    arrivalDate: arrival?.date ?? departure?.date ?? flight.flight_date ?? null,
    departureTime: departure?.clock ?? null,
    arrivalTime: arrival?.clock ?? null,
  };
}

function buildManualFieldErrors(
  input: {
    depIata?: string | null;
    arrIata?: string | null;
  },
  mapped?: Pick<
    FlightScheduleLookupResult,
    "fromIata" | "toIata" | "fromCity" | "toCity"
  >,
): FlightScheduleLookupResult["fieldErrors"] {
  const errors: NonNullable<FlightScheduleLookupResult["fieldErrors"]> = {};
  const fromIata = mapped?.fromIata ?? input.depIata?.trim().toUpperCase();
  const toIata = mapped?.toIata ?? input.arrIata?.trim().toUpperCase();

  if (!mapped?.fromCity && !fromIata) {
    errors.from = "Enter departure city or a valid 3-letter airport code.";
    errors.fromIata = "Enter a valid 3-letter IATA code or use flight lookup.";
  }
  if (!mapped?.toCity && !toIata) {
    errors.to = "Enter arrival city or a valid 3-letter airport code.";
    errors.toIata = "Enter a valid 3-letter IATA code or use flight lookup.";
  }
  return Object.keys(errors).length ? errors : undefined;
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

async function fetchAllAirlabsLegs(input: {
  operatingFlightNumber: string;
  flightDate: string;
}): Promise<AirlabsFlight[]> {
  const flightIata = normalizeOperatingFlightIata(input.operatingFlightNumber);
  const airlineIata = extractAirlineIata(flightIata);

  const byFlight = await fetchAirlabsSchedules({ flight_iata: flightIata });
  let matches = byFlight.filter((flight) =>
    flightMatchesDate(flight, input.flightDate),
  );

  if (matches.length === 0 && airlineIata) {
    const byAirline = await fetchAirlabsSchedules({
      airline_iata: airlineIata,
      flight_iata: flightIata,
    });
    matches = byAirline.filter((flight) =>
      flightMatchesDate(flight, input.flightDate),
    );
  }

  if (matches.length === 0) {
    const liveFlight = await fetchAirlabsFlightEndpoint(flightIata);
    if (liveFlight && flightMatchesDate(liveFlight, input.flightDate)) {
      matches = [liveFlight];
    }
  }

  return matches;
}

function buildAirlabsLookupMatch(
  legs: AirlabsFlight[],
  flightDate: string,
  depIata?: string | null,
  arrIata?: string | null,
): AirlabsLookupMatch | null {
  if (legs.length === 0) return null;

  const sliced = depIata
    ? sliceLegsFromDeparture(legs, depIata)
    : legs;

  const arr = arrIata?.trim().toUpperCase();
  const filtered =
    arr && sliced.length > 0
      ? (() => {
          const last = sliced[sliced.length - 1];
          if (
            last.arr_iata?.trim().toUpperCase() === arr ||
            sliced.length === 1
          ) {
            return sliced;
          }
          const endIndex = sliced.findIndex(
            (leg) => leg.arr_iata?.trim().toUpperCase() === arr,
          );
          return endIndex === -1 ? sliced : sliced.slice(0, endIndex + 1);
        })()
      : sliced;

  const raw = filtered[0];
  if (!raw) return null;

  return {
    flight: mapAirlabsFlight(raw, flightDate),
    raw,
    legs: filtered,
  };
}

async function fetchFromAirlabs(input: {
  operatingFlightNumber: string;
  flightDate: string;
  depIata?: string | null;
  arrIata?: string | null;
}): Promise<AirlabsLookupMatch | null> {
  const allLegs = await fetchAllAirlabsLegs({
    operatingFlightNumber: input.operatingFlightNumber,
    flightDate: input.flightDate,
  });

  return buildAirlabsLookupMatch(
    allLegs,
    input.flightDate,
    input.depIata,
    input.arrIata,
  );
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
    let rawAirlabs: AirlabsFlight | undefined;

    let airlabsLegs: AirlabsFlight[] | undefined;

    if (process.env.AIRLABS_API_KEY?.trim()) {
      const airlabsMatch = await fetchFromAirlabs({
        operatingFlightNumber,
        flightDate,
        depIata: input.depIata,
        arrIata: input.arrIata,
      });
      if (airlabsMatch) {
        flight = airlabsMatch.flight;
        rawAirlabs = airlabsMatch.raw;
        airlabsLegs = airlabsMatch.legs;
      }
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
          "Could not find this flight on that date. Enter route and times manually.",
        fieldErrors: buildManualFieldErrors(input),
      };
    }

    const routeFromLegs =
      airlabsLegs && airlabsLegs.length > 0
        ? routeFieldsFromLegChain(airlabsLegs, operatingFlightNumber)
        : null;

    const mapped = routeFromLegs
      ? {
          fromIata: routeFromLegs.fromIata,
          toIata: routeFromLegs.toIata,
          fromCity: routeFromLegs.fromCity,
          toCity: routeFromLegs.toCity,
          departureDatetimeLocal: routeFromLegs.departureDatetimeLocal,
          arrivalDatetimeLocal: routeFromLegs.arrivalDatetimeLocal,
          eventDate: routeFromLegs.eventDate,
          arrivalDate: routeFromLegs.arrivalDate,
          departureTime: routeFromLegs.departureTime,
          arrivalTime: routeFromLegs.arrivalTime,
          aircraft: routeFromLegs.aircraft,
          totalFlightTime: routeFromLegs.totalFlightTime,
          departureTerminal: routeFromLegs.departureTerminal,
          departureGate: routeFromLegs.departureGate,
          arrivalTerminal: routeFromLegs.arrivalTerminal,
          arrivalGate: routeFromLegs.arrivalGate,
          segments: routeFromLegs.segments,
          airlineIata: routeFromLegs.airlineIata,
          airlineName: routeFromLegs.airlineName,
          operatingAirlineIata: routeFromLegs.operatingAirlineIata,
          operatingAirlineName: routeFromLegs.operatingAirlineName,
          marketingFlightNumber: routeFromLegs.marketingFlightNumber,
          operatingFlightNumber: routeFromLegs.operatingFlightNumber,
        }
      : enrichLookupFromRaw(
          aviationFlightToLookupResult(flight),
          rawAirlabs,
          operatingFlightNumber,
        );

    const airlineFallback = airlineInfoFromFlightNumbers({
      marketingFlightNumber:
        mapped.marketingFlightNumber ?? operatingFlightNumber,
      operatingFlightNumber:
        mapped.operatingFlightNumber ?? operatingFlightNumber,
    });
    const withAirline = {
      ...mapped,
      airlineIata: mapped.airlineIata ?? airlineFallback.airlineIata,
      airlineName: mapped.airlineName ?? airlineFallback.airlineName,
      operatingAirlineIata:
        mapped.operatingAirlineIata ?? airlineFallback.operatingAirlineIata,
      operatingAirlineName:
        mapped.operatingAirlineName ?? airlineFallback.operatingAirlineName,
      marketingFlightNumber:
        mapped.marketingFlightNumber ?? airlineFallback.marketingFlightNumber,
      operatingFlightNumber:
        mapped.operatingFlightNumber ?? airlineFallback.operatingFlightNumber,
    };

    if (!withAirline.departureDatetimeLocal || !withAirline.arrivalDatetimeLocal) {
      return {
        available: false,
        reason: "not_found",
        message:
          "Flight found but times are unavailable. Enter departure and arrival times manually.",
        ...withAirline,
        fieldErrors: buildManualFieldErrors(input, withAirline),
      };
    }

    const withCities = await enrichLookupCities(withAirline);

    return {
      available: true,
      message:
        withCities.segments && withCities.segments.length > 0
          ? `Flight details loaded (${withCities.segments.length} segments).`
          : withCities.operatingFlightNumber &&
              withCities.marketingFlightNumber &&
              withCities.operatingFlightNumber !== withCities.marketingFlightNumber
            ? `Flight details loaded (codeshare operated as ${withCities.operatingFlightNumber}).`
            : "Flight details loaded from schedule API.",
      ...withCities,
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
  const existingSegments = flightSegmentsFromDetails(details);
  const lookupSegments = lookup.segments ?? existingSegments;
  const flightSegments = lookupSegments.filter(
    (segment) => !segment.transit && (segment.fromIata || segment.from),
  );
  const firstSegment = flightSegments[0];
  const lastSegment = flightSegments[flightSegments.length - 1];
  const preserveMultiLegRoute = existingSegments.length >= 2;

  return {
    ...details,
    from: lookup.fromCity ?? details.from,
    to: lookup.toCity ?? details.to,
    fromIata:
      (preserveMultiLegRoute
        ? firstSegment?.fromIata ?? existingSegments[0]?.fromIata
        : lookup.fromIata) ?? details.fromIata,
    toIata:
      (preserveMultiLegRoute
        ? lastSegment?.toIata ?? existingSegments.at(-1)?.toIata
        : lookup.toIata) ?? details.toIata,
    departureTime: lookup.departureTime ?? details.departureTime,
    arrivalTime: lookup.arrivalTime ?? details.arrivalTime,
    aircraft: lookup.aircraft ?? details.aircraft,
    totalFlightTime: lookup.totalFlightTime ?? details.totalFlightTime,
    departureTerminal: lookup.departureTerminal ?? details.departureTerminal,
    departureGate: lookup.departureGate ?? details.departureGate,
    arrivalTerminal: lookup.arrivalTerminal ?? details.arrivalTerminal,
    arrivalGate: lookup.arrivalGate ?? details.arrivalGate,
    segments:
      preserveMultiLegRoute && existingSegments.length >= 2
        ? existingSegments
        : (lookup.segments ?? details.segments),
    airlineIata: lookup.airlineIata ?? details.airlineIata,
    airlineName: lookup.airlineName ?? details.airlineName,
    operatingAirlineIata:
      lookup.operatingAirlineIata ?? details.operatingAirlineIata,
    operatingAirlineName:
      lookup.operatingAirlineName ?? details.operatingAirlineName,
    marketingFlightNumber:
      lookup.marketingFlightNumber ?? details.marketingFlightNumber,
    operatingFlightNumber:
      lookup.operatingFlightNumber ?? details.operatingFlightNumber,
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
  const existingSegments = flightSegmentsFromDetails(current);
  const finalDestination =
    existingSegments.length >= 2
      ? segmentLabel(existingSegments[existingSegments.length - 1], "to")
      : null;
  const lookupDestination = lookup.toIata?.trim().toUpperCase() ?? null;

  if (
    finalDestination &&
    lookupDestination &&
    lookupDestination !== finalDestination
  ) {
    return null;
  }

  const nextDetails = applyLookupToFlightDetails(current, lookup);

  if (existingSegments.length >= 2) {
    const bounds = resolveMultiSegmentJourneyBounds(
      { category: "flight", ...item, details: nextDetails },
      existingSegments,
    );
    return {
      eventDate: bounds.eventDate ?? item.eventDate ?? null,
      startDatetime: bounds.scheduledStart.toISOString(),
      endDatetime: bounds.scheduledEnd.toISOString(),
      details: nextDetails,
    };
  }

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
