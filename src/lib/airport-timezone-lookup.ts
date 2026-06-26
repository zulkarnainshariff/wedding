import { KNOWN_AIRPORT_TIMEZONES } from "@/lib/airport-timezones-data";

type AirportCache = Record<string, string>;

let memoryCache: AirportCache | null = null;

export function mergeAirportTimezoneCache(cache: AirportCache): void {
  memoryCache = { ...memoryCache, ...cache };
}

function normalizeIata(iata?: string | null): string | null {
  const code = iata?.trim().toUpperCase();
  return code && code.length === 3 ? code : null;
}

/** Synchronous lookup: stored value → static list → warmed file cache (if loaded). */
export function getAirportTimezone(
  iata?: string | null,
  storedTimezone?: string | null,
): string | null {
  const stored = storedTimezone?.trim();
  if (stored) return stored;

  const code = normalizeIata(iata);
  if (!code) return null;

  if (KNOWN_AIRPORT_TIMEZONES[code]) {
    return KNOWN_AIRPORT_TIMEZONES[code];
  }

  return memoryCache?.[code] ?? null;
}
