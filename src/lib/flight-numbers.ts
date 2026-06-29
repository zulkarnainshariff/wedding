import type { FlightDetails, FlightSegment } from "./types";
import { flightSegmentsFromDetails } from "./flight-segment-timing";

/** Parse legacy strings like "QF1234 (AA456)" or "QF4716 (AA3164)". */
export function parseLegacyFlightNumber(value: string | null | undefined): {
  marketing: string | null;
  operating: string | null;
} {
  const trimmed = value?.trim();
  if (!trimmed) return { marketing: null, operating: null };

  const codeshareMatch = trimmed.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  if (codeshareMatch) {
    return {
      marketing: codeshareMatch[1].trim(),
      operating: codeshareMatch[2].trim(),
    };
  }

  return { marketing: trimmed, operating: trimmed };
}

export function normalizeFlightSegment(segment: FlightSegment): FlightSegment {
  const marketing =
    segment.marketingFlightNumber?.trim() ||
    parseLegacyFlightNumber(segment.flightNumber).marketing;
  const operating =
    segment.operatingFlightNumber?.trim() ||
    parseLegacyFlightNumber(segment.flightNumber).operating ||
    marketing;

  return {
    ...segment,
    marketingFlightNumber: marketing ?? undefined,
    operatingFlightNumber: operating ?? undefined,
    flightNumber: formatFlightNumberDisplay(marketing, operating) || segment.flightNumber,
  };
}

export function normalizeFlightDetails(details: FlightDetails): FlightDetails {
  const legacy = parseLegacyFlightNumber(details.flightNumber);
  const marketing =
    details.marketingFlightNumber?.trim() || legacy.marketing || undefined;
  const operating =
    details.operatingFlightNumber?.trim() ||
    legacy.operating ||
    marketing;

  return {
    ...details,
    marketingFlightNumber: marketing,
    operatingFlightNumber: operating,
    flightNumber: formatFlightNumberDisplay(marketing, operating) || details.flightNumber,
    segments: details.segments?.map((segment) => normalizeFlightSegment(segment)),
  };
}

/** Display booked/codeshare number first, operating flight in parentheses. */
export function formatFlightNumberDisplay(
  marketing?: string | null,
  operating?: string | null,
): string | null {
  const booked = marketing?.trim();
  const actual = operating?.trim();

  if (booked && actual && booked.toUpperCase() !== actual.toUpperCase()) {
    return `${booked} (${actual})`;
  }
  return booked || actual || null;
}

function segmentFlightLabel(segment: FlightSegment): string | null {
  return (
    formatFlightNumberDisplay(
      segment.marketingFlightNumber,
      segment.operatingFlightNumber,
    ) ||
    segment.flightNumber?.trim() ||
    null
  );
}

/** Item-level flight label: one number, repeated number, or each leg listed. */
export function formatJourneyFlightLabel(
  details: FlightDetails | null | undefined,
): string | null {
  if (!details) return null;

  const segments = flightSegmentsFromDetails(details);

  if (segments.length >= 2) {
    const labels = segments
      .map((segment) => segmentFlightLabel(segment))
      .filter((label): label is string => Boolean(label));

    if (labels.length === 0) {
      return (
        formatFlightNumberDisplay(
          details.marketingFlightNumber,
          details.operatingFlightNumber,
        ) || details.flightNumber?.trim() || null
      );
    }

    const normalized = labels.map((label) => label.toUpperCase());
    if (new Set(normalized).size === 1) {
      return labels[0];
    }

    return labels.join(" · ");
  }

  if (segments.length === 1) {
    return segmentFlightLabel(segments[0]);
  }

  return (
    formatFlightNumberDisplay(
      details.marketingFlightNumber,
      details.operatingFlightNumber,
    ) ||
    details.flightNumber?.trim() ||
    null
  );
}

export function resolveSegmentOperatingFlightNumber(
  segment: FlightSegment,
): string | null {
  return resolveOperatingFlightNumber(segment);
}

export function resolveSegmentMarketingFlightNumber(
  segment: FlightSegment,
): string | null {
  return resolveMarketingFlightNumber(segment);
}

/** True when every leg uses the same marketed flight number (e.g. SQ12 via NRT). */
export function isSingleFlightNumberJourney(
  details: FlightDetails | null | undefined,
): boolean {
  if (!details) return false;
  const segments = flightSegmentsFromDetails(details);
  if (segments.length < 2) return true;

  const numbers = segments
    .map(
      (segment) =>
        segment.marketingFlightNumber?.trim().toUpperCase() ||
        segment.operatingFlightNumber?.trim().toUpperCase() ||
        segment.flightNumber?.trim().toUpperCase(),
    )
    .filter(Boolean);

  return numbers.length > 0 && new Set(numbers).size === 1;
}

export function resolveMarketingFlightNumber(
  source: Pick<
    FlightDetails,
    "marketingFlightNumber" | "operatingFlightNumber" | "flightNumber"
  >,
): string | null {
  const normalized = normalizeFlightDetails(source as FlightDetails);
  return normalized.marketingFlightNumber ?? null;
}

export function resolveOperatingFlightNumber(
  source: Pick<
    FlightDetails,
    "marketingFlightNumber" | "operatingFlightNumber" | "flightNumber"
  >,
): string | null {
  const normalized = normalizeFlightDetails(source as FlightDetails);
  return normalized.operatingFlightNumber ?? null;
}

export function normalizeFlightIata(code?: string | null): string | null {
  const trimmed = code?.trim().toUpperCase();
  if (!trimmed || !/^[A-Z]{3}$/.test(trimmed)) return null;
  return trimmed;
}
