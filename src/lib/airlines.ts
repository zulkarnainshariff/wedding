/** Common IATA airline designators → display names. */
export const KNOWN_AIRLINES: Record<string, string> = {
  SQ: "Singapore Airlines",
  TR: "Scoot",
  QF: "Qantas",
  VA: "Virgin Australia",
  NZ: "Air New Zealand",
  JQ: "Jetstar Airways",
  "3K": "Jetstar Asia",
  BA: "British Airways",
  AA: "American Airlines",
  UA: "United Airlines",
  DL: "Delta Air Lines",
  AS: "Alaska Airlines",
  B6: "JetBlue Airways",
  WN: "Southwest Airlines",
  AC: "Air Canada",
  WS: "WestJet",
  LH: "Lufthansa",
  LX: "Swiss International Air Lines",
  OS: "Austrian Airlines",
  SN: "Brussels Airlines",
  AF: "Air France",
  KL: "KLM",
  EK: "Emirates",
  QR: "Qatar Airways",
  EY: "Etihad Airways",
  TK: "Turkish Airlines",
  CX: "Cathay Pacific",
  HX: "Hong Kong Airlines",
  JL: "Japan Airlines",
  NH: "All Nippon Airways",
  KE: "Korean Air",
  OZ: "Asiana Airlines",
  TG: "Thai Airways",
  MH: "Malaysia Airlines",
  AK: "AirAsia",
  D7: "AirAsia X",
  CI: "China Airlines",
  BR: "EVA Air",
  CA: "Air China",
  MU: "China Eastern",
  CZ: "China Southern",
  HU: "Hainan Airlines",
  MF: "XiamenAir",
  FM: "Shanghai Airlines",
  ZH: "Shenzhen Airlines",
  AI: "Air India",
  "6E": "IndiGo",
  SG: "SpiceJet",
  LA: "LATAM Airlines",
  AR: "Aerolineas Argentinas",
  FJ: "Fiji Airways",
  PX: "Air Niugini",
  GA: "Garuda Indonesia",
  ID: "Batik Air",
  VN: "Vietnam Airlines",
  VJ: "VietJet Air",
  PR: "Philippine Airlines",
  ZL: "Rex Airlines",
  EI: "Aer Lingus",
  IB: "Iberia",
  AY: "Finnair",
  SK: "SAS",
  DY: "Norwegian",
  WY: "Oman Air",
  GF: "Gulf Air",
  SV: "Saudia",
  MS: "EgyptAir",
  ET: "Ethiopian Airlines",
  SA: "South African Airways",
  HA: "Hawaiian Airlines",
  VS: "Virgin Atlantic",
  U2: "easyJet",
  FR: "Ryanair",
};

export function normalizeAirlineIata(value?: string | null): string | null {
  const code = value?.trim().toUpperCase();
  if (!code || !/^[A-Z0-9]{2}$/.test(code)) return null;
  return code;
}

/** Extract the 2-character airline designator from a flight number (e.g. SQ833 → SQ). */
export function extractAirlineIataFromFlightNumber(
  flightNumber?: string | null,
): string | null {
  const trimmed = flightNumber?.trim().toUpperCase();
  if (!trimmed) return null;
  const match = /^([A-Z0-9]{2})\s*\d/.exec(trimmed);
  return match ? match[1] : null;
}

export function resolveAirlineNameSync(iata?: string | null): string | null {
  const code = normalizeAirlineIata(iata);
  if (!code) return null;
  return KNOWN_AIRLINES[code] ?? null;
}

export function resolveAirlineLabel(iata?: string | null, name?: string | null): string | null {
  const code = normalizeAirlineIata(iata);
  const resolvedName = name?.trim() || resolveAirlineNameSync(code);
  if (code && resolvedName) return `${resolvedName} (${code})`;
  return resolvedName ?? code;
}

export type AirlineInfo = {
  airlineIata: string | null;
  airlineName: string | null;
  operatingAirlineIata: string | null;
  operatingAirlineName: string | null;
  marketingFlightNumber: string | null;
  operatingFlightNumber: string | null;
  isCodeshare: boolean;
};

export function airlineInfoFromFlightNumbers(input: {
  marketingFlightNumber?: string | null;
  operatingFlightNumber?: string | null;
}): AirlineInfo {
  const marketing = input.marketingFlightNumber?.trim().toUpperCase() || null;
  const operating = input.operatingFlightNumber?.trim().toUpperCase() || marketing;
  const airlineIata = extractAirlineIataFromFlightNumber(marketing);
  const operatingAirlineIata =
    operating && operating !== marketing
      ? extractAirlineIataFromFlightNumber(operating)
      : null;

  const isCodeshare = Boolean(
    marketing && operating && marketing !== operating,
  );

  return {
    airlineIata,
    airlineName: resolveAirlineNameSync(airlineIata),
    operatingAirlineIata: isCodeshare ? operatingAirlineIata : null,
    operatingAirlineName: isCodeshare
      ? resolveAirlineNameSync(operatingAirlineIata)
      : null,
    marketingFlightNumber: marketing,
    operatingFlightNumber: isCodeshare ? operating : marketing,
    isCodeshare,
  };
}

export function airlineInfoFromAirlabsLeg(leg: {
  airline_iata?: string;
  flight_iata?: string;
  cs_airline_iata?: string | null;
  cs_flight_iata?: string | null;
}): AirlineInfo {
  const marketingFlight =
    leg.flight_iata?.trim().toUpperCase() || null;
  const operatingFlight =
    leg.cs_flight_iata?.trim().toUpperCase() || marketingFlight;
  const airlineIata =
    normalizeAirlineIata(leg.airline_iata) ||
    extractAirlineIataFromFlightNumber(marketingFlight);
  const operatingAirlineIata =
    normalizeAirlineIata(leg.cs_airline_iata) ||
    (operatingFlight && operatingFlight !== marketingFlight
      ? extractAirlineIataFromFlightNumber(operatingFlight)
      : null);

  const isCodeshare = Boolean(
    marketingFlight &&
      operatingFlight &&
      operatingFlight !== marketingFlight,
  );

  return {
    airlineIata,
    airlineName: resolveAirlineNameSync(airlineIata),
    operatingAirlineIata: isCodeshare ? operatingAirlineIata : null,
    operatingAirlineName: isCodeshare
      ? resolveAirlineNameSync(operatingAirlineIata)
      : null,
    marketingFlightNumber: marketingFlight,
    operatingFlightNumber: isCodeshare ? operatingFlight : marketingFlight,
    isCodeshare,
  };
}
