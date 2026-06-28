/** Common airport IATA → city names for display and form resolution. */
export const KNOWN_AIRPORT_CITIES: Record<string, string> = {
  PVG: "Shanghai",
  SHA: "Shanghai",
  SIN: "Singapore",
  KUL: "Kuala Lumpur",
  MEL: "Melbourne",
  SYD: "Sydney",
  BNE: "Brisbane",
  PER: "Perth",
  ADL: "Adelaide",
  LST: "Launceston",
  HBA: "Hobart",
  JFK: "New York",
  EWR: "New York",
  LGA: "New York",
  PHL: "Philadelphia",
  LHR: "London",
  LGW: "London",
  CDG: "Paris",
  FRA: "Frankfurt",
  DXB: "Dubai",
  DOH: "Doha",
  HKG: "Hong Kong",
  NRT: "Tokyo",
  HND: "Tokyo",
  ICN: "Seoul",
  BOM: "Mumbai",
  DEL: "Delhi",
  AKL: "Auckland",
  CHC: "Christchurch",
  DPS: "Denpasar",
  CGK: "Jakarta",
  BKK: "Bangkok",
  SFO: "San Francisco",
  LAX: "Los Angeles",
  ORD: "Chicago",
  DFW: "Dallas",
  IAD: "Washington",
  DCA: "Washington",
  BOS: "Boston",
  ATL: "Atlanta",
  MIA: "Miami",
  SEA: "Seattle",
  YVR: "Vancouver",
  YYZ: "Toronto",
};

export function normalizeIataCode(value?: string | null): string | null {
  const code = value?.trim().toUpperCase();
  if (!code || !/^[A-Z]{3}$/.test(code)) return null;
  return code;
}

export function resolveAirportCitySync(iata?: string | null): string | null {
  const code = normalizeIataCode(iata);
  if (!code) return null;
  return KNOWN_AIRPORT_CITIES[code] ?? null;
}

export async function resolveAirportCity(iata?: string | null): Promise<string | null> {
  const code = normalizeIataCode(iata);
  if (!code) return null;

  const known = KNOWN_AIRPORT_CITIES[code];
  if (known) return known;

  const apiKey = process.env.AIRLABS_API_KEY?.trim();
  if (!apiKey) return null;

  try {
    const params = new URLSearchParams({ api_key: apiKey, iata_code: code });
    const response = await fetch(
      `https://airlabs.co/api/v9/airports?${params.toString()}`,
      { cache: "no-store" },
    );
    if (!response.ok) return null;

    const payload = (await response.json()) as {
      response?: { city?: string; name?: string }[] | { city?: string; name?: string };
    };
    const airport = Array.isArray(payload.response)
      ? payload.response[0]
      : payload.response;
    const city = airport?.city?.trim() || airport?.name?.trim();
    if (city) {
      KNOWN_AIRPORT_CITIES[code] = city;
      return city;
    }
  } catch {
    return null;
  }

  return null;
}
