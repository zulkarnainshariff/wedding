import { resolveAirportCitySync } from "@/lib/airport-cities";
import { airlineInfoFromAirlabsLeg } from "@/lib/airlines";
import { formatFlightNumberDisplay } from "@/lib/flight-numbers";
import { getAirportTimezone } from "@/lib/airport-timezones";
import { utcToDatetimeLocalInTimezone } from "@/lib/flight-datetime";
import type { FlightSegment } from "@/lib/types";

export type AirlabsLeg = {
  dep_iata?: string;
  arr_iata?: string;
  dep_city?: string;
  arr_city?: string;
  dep_terminal?: string;
  dep_gate?: string;
  arr_terminal?: string;
  arr_gate?: string;
  aircraft_icao?: string;
  aircraft_iata?: string;
  duration?: number;
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
  flight_iata?: string;
  airline_iata?: string;
  cs_airline_iata?: string | null;
  cs_flight_iata?: string | null;
};

export type RouteLookupFields = {
  segments: FlightSegment[];
  from?: string | null;
  to?: string | null;
  fromIata?: string | null;
  toIata?: string | null;
  fromCity?: string | null;
  toCity?: string | null;
  departureTime?: string | null;
  arrivalTime?: string | null;
  departureDatetimeLocal?: string;
  arrivalDatetimeLocal?: string;
  eventDate?: string | null;
  arrivalDate?: string | null;
  aircraft?: string | null;
  totalFlightTime?: string | null;
  departureTerminal?: string | null;
  departureGate?: string | null;
  arrivalTerminal?: string | null;
  arrivalGate?: string | null;
  airlineIata?: string | null;
  airlineName?: string | null;
  operatingAirlineIata?: string | null;
  operatingAirlineName?: string | null;
  marketingFlightNumber?: string | null;
  operatingFlightNumber?: string | null;
};

function normalizeIata(value?: string | null): string | null {
  const code = value?.trim().toUpperCase();
  return code && code.length === 3 ? code : null;
}

function bestUtc(leg: AirlabsLeg, endpoint: "dep" | "arr"): string | null {
  const candidates =
    endpoint === "dep"
      ? [
          leg.dep_actual_utc,
          leg.dep_estimated_utc,
          leg.dep_time_utc,
          leg.dep_actual,
          leg.dep_estimated,
          leg.dep_time,
        ]
      : [
          leg.arr_actual_utc,
          leg.arr_estimated_utc,
          leg.arr_time_utc,
          leg.arr_actual,
          leg.arr_estimated,
          leg.arr_time,
        ];

  for (const value of candidates) {
    if (!value?.trim()) continue;
    const trimmed = value.trim();
    if (trimmed.includes("T")) return trimmed;
    return `${trimmed.replace(" ", "T")}:00Z`;
  }
  return null;
}

function localFromUtc(
  iso: string | null,
  iata: string | null,
): { datetimeLocal: string; clock: string; date: string } | null {
  if (!iso || !iata) return null;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;
  const timeZone = getAirportTimezone(iata);
  if (!timeZone) return null;
  const datetimeLocal = utcToDatetimeLocalInTimezone(parsed, timeZone);
  const [date, time] = datetimeLocal.split("T");
  if (!date || !time) return null;
  return { datetimeLocal, clock: time.slice(0, 5), date };
}

function formatDurationMinutes(minutes?: number | null): string | null {
  if (minutes == null || minutes <= 0) return null;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours <= 0) return `${mins}m`;
  if (mins <= 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

export function airlabsLegToSegment(
  leg: AirlabsLeg,
  flightNumber?: string | null,
): FlightSegment {
  const fromIata = normalizeIata(leg.dep_iata);
  const toIata = normalizeIata(leg.arr_iata);
  const dep = localFromUtc(bestUtc(leg, "dep"), fromIata);
  const arr = localFromUtc(bestUtc(leg, "arr"), toIata);
  const airline = airlineInfoFromAirlabsLeg(leg);
  const marketingFlightNumber =
    airline.marketingFlightNumber ?? flightNumber?.trim().toUpperCase() ?? undefined;
  const operatingFlightNumber =
    airline.operatingFlightNumber ??
    marketingFlightNumber ??
    flightNumber?.trim().toUpperCase() ??
    undefined;

  return {
    marketingFlightNumber,
    operatingFlightNumber,
    flightNumber:
      formatFlightNumberDisplay(marketingFlightNumber, operatingFlightNumber) ??
      flightNumber ??
      leg.flight_iata ??
      undefined,
    from:
      leg.dep_city?.trim() ||
      resolveAirportCitySync(fromIata) ||
      fromIata ||
      undefined,
    to:
      leg.arr_city?.trim() ||
      resolveAirportCitySync(toIata) ||
      toIata ||
      undefined,
    fromIata: fromIata ?? undefined,
    toIata: toIata ?? undefined,
    departureTime: dep?.clock ?? undefined,
    arrivalTime: arr?.clock ?? undefined,
    departureTerminal: leg.dep_terminal?.trim() || undefined,
    departureGate: leg.dep_gate?.trim() || undefined,
    arrivalTerminal: leg.arr_terminal?.trim() || undefined,
    arrivalGate: leg.arr_gate?.trim() || undefined,
    aircraft: leg.aircraft_iata?.trim() || leg.aircraft_icao?.trim() || undefined,
    flightTime: formatDurationMinutes(leg.duration) ?? undefined,
  };
}

function legDepartureMs(leg: AirlabsLeg): number {
  const iso = bestUtc(leg, "dep");
  if (!iso) return Number.POSITIVE_INFINITY;
  const ms = new Date(iso).getTime();
  return Number.isNaN(ms) ? Number.POSITIVE_INFINITY : ms;
}

export function orderAirlabsLegs(legs: AirlabsLeg[]): AirlabsLeg[] {
  if (legs.length <= 1) return legs;

  const pool = [...legs];
  const used = new Set<number>();
  const ordered: AirlabsLeg[] = [];

  let current = pool.reduce((best, _leg, index) => {
    const ms = legDepartureMs(pool[index]);
    return ms < legDepartureMs(pool[best]) ? index : best;
  }, 0);

  ordered.push(pool[current]);
  used.add(current);

  while (used.size < pool.length) {
    const tailIata = normalizeIata(ordered[ordered.length - 1]?.arr_iata);
    const nextIndex = pool.findIndex(
      (leg, index) =>
        !used.has(index) && normalizeIata(leg.dep_iata) === tailIata,
    );
    if (nextIndex === -1) break;
    ordered.push(pool[nextIndex]);
    used.add(nextIndex);
  }

  if (ordered.length < pool.length) {
    return [...pool].sort((a, b) => legDepartureMs(a) - legDepartureMs(b));
  }

  return ordered;
}

export function sliceLegsFromDeparture(
  legs: AirlabsLeg[],
  departureIata: string,
): AirlabsLeg[] {
  const dep = departureIata.trim().toUpperCase();
  if (!dep) return legs;

  const ordered = orderAirlabsLegs(legs);
  const startIndex = ordered.findIndex(
    (leg) => normalizeIata(leg.dep_iata) === dep,
  );
  if (startIndex === -1) return ordered;
  return ordered.slice(startIndex);
}

export function routeFieldsFromLegChain(
  legs: AirlabsLeg[],
  flightNumber?: string | null,
): RouteLookupFields | null {
  if (legs.length === 0) return null;

  const ordered = orderAirlabsLegs(legs);
  const first = ordered[0];
  const last = ordered[ordered.length - 1];
  const fromIata = normalizeIata(first.dep_iata);
  const toIata = normalizeIata(last.arr_iata);
  const departure = localFromUtc(bestUtc(first, "dep"), fromIata);
  const arrival = localFromUtc(bestUtc(last, "arr"), toIata);

  const segments = ordered.map((leg) => airlabsLegToSegment(leg));
  const totalMinutes = ordered.reduce((sum, leg) => sum + (leg.duration ?? 0), 0);
  const firstAirline = airlineInfoFromAirlabsLeg(first);
  const allSameMarketing = segments.every(
    (segment) =>
      segment.marketingFlightNumber?.toUpperCase() ===
      segments[0].marketingFlightNumber?.toUpperCase(),
  );

  return {
    segments: segments.length === 1 ? [] : segments,
    from:
      first.dep_city?.trim() ||
      resolveAirportCitySync(fromIata) ||
      fromIata,
    to:
      last.arr_city?.trim() ||
      resolveAirportCitySync(toIata) ||
      toIata,
    fromIata,
    toIata,
    fromCity:
      first.dep_city?.trim() ||
      resolveAirportCitySync(fromIata) ||
      fromIata,
    toCity:
      last.arr_city?.trim() ||
      resolveAirportCitySync(toIata) ||
      toIata,
    departureTime: departure?.clock ?? null,
    arrivalTime: arrival?.clock ?? null,
    departureDatetimeLocal: departure?.datetimeLocal,
    arrivalDatetimeLocal: arrival?.datetimeLocal,
    eventDate: departure?.date ?? null,
    arrivalDate: arrival?.date ?? departure?.date ?? null,
    aircraft:
      first.aircraft_iata?.trim() ||
      first.aircraft_icao?.trim() ||
      last.aircraft_iata?.trim() ||
      last.aircraft_icao?.trim() ||
      null,
    totalFlightTime: formatDurationMinutes(totalMinutes),
    departureTerminal: first.dep_terminal?.trim() || null,
    departureGate: first.dep_gate?.trim() || null,
    arrivalTerminal: last.arr_terminal?.trim() || null,
    arrivalGate: last.arr_gate?.trim() || null,
    airlineIata: firstAirline.airlineIata,
    airlineName: firstAirline.airlineName,
    operatingAirlineIata: firstAirline.operatingAirlineIata,
    operatingAirlineName: firstAirline.operatingAirlineName,
    marketingFlightNumber: allSameMarketing
      ? segments[0].marketingFlightNumber ?? flightNumber ?? null
      : formatJourneyNumbersFromSegments(segments) ?? flightNumber ?? null,
    operatingFlightNumber: allSameMarketing
      ? segments[0].operatingFlightNumber ?? flightNumber ?? null
      : null,
  };
}

function formatJourneyNumbersFromSegments(segments: FlightSegment[]): string | null {
  const labels = segments
    .map(
      (segment) =>
        formatFlightNumberDisplay(
          segment.marketingFlightNumber,
          segment.operatingFlightNumber,
        ) || segment.flightNumber?.trim(),
    )
    .filter(Boolean);
  return labels.length ? labels.join(" · ") : null;
}

export function sliceSegmentsFromDeparture(
  segments: FlightSegment[],
  departureIata: string,
): FlightSegment[] {
  const dep = departureIata.trim().toUpperCase();
  if (!dep) return segments;
  const startIndex = segments.findIndex(
    (segment) => segment.fromIata?.trim().toUpperCase() === dep,
  );
  if (startIndex === -1) return segments;
  return segments.slice(startIndex);
}

export function routeFieldsFromSegments(
  segments: FlightSegment[],
): RouteLookupFields | null {
  if (segments.length === 0) return null;

  const first = segments[0];
  const last = segments[segments.length - 1];

  const totalMinutes = segments.reduce((sum, segment) => {
    const match = /^(\d+)h(?:\s*(\d+)m)?$/.exec(segment.flightTime ?? "");
    if (!match) return sum;
    return sum + Number(match[1]) * 60 + Number(match[2] ?? 0);
  }, 0);

  return {
    segments: segments.length === 1 ? [] : segments,
    from: first.from ?? first.fromIata,
    to: last.to ?? last.toIata,
    fromIata: first.fromIata ?? null,
    toIata: last.toIata ?? null,
    fromCity: first.from ?? first.fromIata,
    toCity: last.to ?? last.toIata,
    departureTime: first.departureTime ?? null,
    arrivalTime: last.arrivalTime ?? null,
    aircraft: first.aircraft ?? last.aircraft ?? null,
    totalFlightTime:
      totalMinutes > 0
        ? formatDurationMinutes(totalMinutes)
        : first.flightTime ?? null,
    departureTerminal: first.departureTerminal ?? null,
    departureGate: first.departureGate ?? null,
    arrivalTerminal: last.arrivalTerminal ?? null,
    arrivalGate: last.arrivalGate ?? null,
  };
}
