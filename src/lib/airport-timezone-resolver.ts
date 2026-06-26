import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import tzlookup from "tz-lookup";
import {
  getAirportTimezone,
  mergeAirportTimezoneCache,
} from "@/lib/airport-timezone-lookup";

const CACHE_PATH = path.join(process.cwd(), "data", "airport-timezone-cache.json");

type AirportCache = Record<string, string>;

let cacheLoadPromise: Promise<AirportCache> | null = null;

async function loadCache(): Promise<AirportCache> {
  if (cacheLoadPromise) return cacheLoadPromise;

  cacheLoadPromise = (async () => {
    let cache: AirportCache = {};
    try {
      const raw = await readFile(CACHE_PATH, "utf8");
      cache = JSON.parse(raw) as AirportCache;
    } catch {
      cache = {};
    }
    mergeAirportTimezoneCache(cache);
    return cache;
  })();

  return cacheLoadPromise;
}

async function persistCache(cache: AirportCache): Promise<void> {
  mergeAirportTimezoneCache(cache);
  await mkdir(path.dirname(CACHE_PATH), { recursive: true });
  await writeFile(CACHE_PATH, `${JSON.stringify(cache, null, 2)}\n`, "utf8");
}

function normalizeIata(iata?: string | null): string | null {
  const code = iata?.trim().toUpperCase();
  return code && code.length === 3 ? code : null;
}

type AirlabsAirport = {
  iata_code?: string;
  country_code?: string;
  lat?: number;
  lng?: number;
  timezone?: string;
};

async function fetchTimezoneFromAirlabs(iata: string): Promise<string | null> {
  const apiKey = process.env.AIRLABS_API_KEY?.trim();
  if (!apiKey) return null;

  const params = new URLSearchParams({
    api_key: apiKey,
    iata_code: iata,
  });
  const response = await fetch(
    `https://airlabs.co/api/v9/airports?${params.toString()}`,
    { cache: "no-store" },
  );
  if (!response.ok) return null;

  const payload = (await response.json()) as {
    response?: AirlabsAirport[] | AirlabsAirport;
  };
  const airport = Array.isArray(payload.response)
    ? payload.response[0]
    : payload.response;
  if (!airport) return null;

  if (airport.timezone?.trim()) {
    return airport.timezone.trim();
  }

  if (
    typeof airport.lat === "number" &&
    typeof airport.lng === "number" &&
    !Number.isNaN(airport.lat) &&
    !Number.isNaN(airport.lng)
  ) {
    try {
      return tzlookup(airport.lat, airport.lng);
    } catch {
      return null;
    }
  }

  return countryFallbackTimezone(airport.country_code);
}

function countryFallbackTimezone(countryCode?: string): string | null {
  switch (countryCode?.trim().toUpperCase()) {
    case "SG":
      return "Asia/Singapore";
    case "MY":
      return "Asia/Kuala_Lumpur";
    case "TH":
      return "Asia/Bangkok";
    case "HK":
      return "Asia/Hong_Kong";
    case "JP":
      return "Asia/Tokyo";
    case "KR":
      return "Asia/Seoul";
    case "CN":
      return "Asia/Shanghai";
    case "TW":
      return "Asia/Taipei";
    case "PH":
      return "Asia/Manila";
    case "ID":
      return "Asia/Jakarta";
    case "AU":
      return "Australia/Sydney";
    case "NZ":
      return "Pacific/Auckland";
    case "GB":
      return "Europe/London";
    case "FR":
      return "Europe/Paris";
    case "DE":
      return "Europe/Berlin";
    case "NL":
      return "Europe/Amsterdam";
    case "AE":
      return "Asia/Dubai";
    case "QA":
      return "Asia/Qatar";
  }
  return null;
}

/** Resolve and cache timezone for an IATA code (server-side). */
export async function resolveAirportTimezone(
  iata?: string | null,
): Promise<string | null> {
  const code = normalizeIata(iata);
  if (!code) return null;

  const known = getAirportTimezone(code);
  if (known) return known;

  const cache = await loadCache();
  if (cache[code]) return cache[code];

  const resolved = await fetchTimezoneFromAirlabs(code);
  if (!resolved) return null;

  cache[code] = resolved;
  await persistCache(cache);
  return resolved;
}

type FlightTimezoneDetails = {
  fromIata?: string;
  toIata?: string;
  fromTimezone?: string;
  toTimezone?: string;
};

/** Attach resolved timezones to flight details when saving (server-side). */
export async function enrichFlightTimezoneDetails<T extends FlightTimezoneDetails>(
  details: T,
): Promise<T> {
  const [fromTimezone, toTimezone] = await Promise.all([
    details.fromTimezone
      ? Promise.resolve(details.fromTimezone)
      : resolveAirportTimezone(details.fromIata),
    details.toTimezone
      ? Promise.resolve(details.toTimezone)
      : resolveAirportTimezone(details.toIata),
  ]);

  return {
    ...details,
    ...(fromTimezone ? { fromTimezone } : {}),
    ...(toTimezone ? { toTimezone } : {}),
  };
}

/** Warm cache at server startup (optional; safe to skip if no API key). */
export async function preloadAirportTimezoneCache(): Promise<void> {
  await loadCache();
}
