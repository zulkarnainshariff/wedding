import { flightSegmentsFromDetails } from "@/lib/flight-segment-timing";
import { formatTravellerLabel, type FlightDetails, type FlightSegment } from "@/lib/types";
import { formatSeatsSummary, hasAssignedSeats } from "@/lib/seats";

export function normalizeAircraftKey(aircraft?: string): string {
  return aircraft?.trim().toLowerCase() ?? "";
}

export function segmentsShareAircraft(
  a: FlightSegment,
  b: FlightSegment,
): boolean {
  const keyA = normalizeAircraftKey(a.aircraft);
  const keyB = normalizeAircraftKey(b.aircraft);
  if (!keyA || !keyB) return false;
  return keyA === keyB;
}

export function usesPerSegmentSeats(details: FlightDetails | null | undefined): boolean {
  if (!details) return false;
  return flightSegmentsFromDetails(details).length >= 2;
}

export function segmentRouteLabel(segment: FlightSegment): string {
  const from =
    segment.fromIata?.trim().toUpperCase() ||
    segment.from?.trim().slice(0, 3).toUpperCase() ||
    "?";
  const to =
    segment.toIata?.trim().toUpperCase() ||
    segment.to?.trim().slice(0, 3).toUpperCase() ||
    "?";
  return `${from}→${to}`;
}

export function applySegmentSeatWithPropagation(
  segments: FlightSegment[],
  segmentIndex: number,
  traveller: string,
  seat: string,
): FlightSegment[] {
  const next = segments.map((segment) => ({
    ...segment,
    seats: { ...(segment.seats ?? {}) },
  }));
  const seatValue = seat.trim() || null;
  const ref = next[segmentIndex];
  if (!ref) return next;

  ref.seats![traveller] = seatValue;

  const refKey = normalizeAircraftKey(ref.aircraft);
  if (!refKey || !seatValue) return next;

  for (let index = segmentIndex - 1; index >= 0; index -= 1) {
    if (!segmentsShareAircraft(next[index], ref)) break;
    next[index].seats![traveller] = seatValue;
  }
  for (let index = segmentIndex + 1; index < next.length; index += 1) {
    if (!segmentsShareAircraft(next[index], ref)) break;
    next[index].seats![traveller] = seatValue;
  }

  return next;
}

export function migrateTopLevelSeatsToSegments(
  details: FlightDetails,
): FlightDetails {
  const segments = flightSegmentsFromDetails(details);
  if (segments.length < 2 || !details.seats) return details;

  const hasSegmentSeats = segments.some((segment) =>
    hasAssignedSeats(segment.seats),
  );
  if (hasSegmentSeats) return details;

  const nextSegments = (details.segments ?? []).map((segment) => {
    if (segment.transit) return segment;
    return {
      ...segment,
      seats: { ...details.seats },
    };
  });

  return { ...details, segments: nextSegments };
}

export function primarySeatsMap(
  details: FlightDetails | null | undefined,
): Record<string, string | null> | undefined {
  if (!details) return undefined;
  if (usesPerSegmentSeats(details)) {
    const segments = flightSegmentsFromDetails(details);
    return segments[0]?.seats ?? details.seats;
  }
  return details.seats;
}

export function hasFlightAssignedSeats(
  details: FlightDetails | null | undefined,
): boolean {
  if (!details) return false;
  if (usesPerSegmentSeats(details)) {
    return flightSegmentsFromDetails(details).some((segment) =>
      hasAssignedSeats(segment.seats),
    );
  }
  return hasAssignedSeats(details.seats);
}

export function formatFlightSeatsSummary(
  details: FlightDetails | null | undefined,
  passengers?: string[],
): string {
  if (!details) return "Not assigned yet";

  if (usesPerSegmentSeats(details)) {
    const segments = flightSegmentsFromDetails(details);
    const parts = segments
      .map((segment) => {
        const summary = formatSeatsSummary(segment.seats, passengers);
        if (!summary || summary === "Not assigned yet") return null;
        return `${segmentRouteLabel(segment)}: ${summary}`;
      })
      .filter(Boolean);

    if (parts.length > 0) return parts.join(" · ");
    return formatSeatsSummary(undefined, passengers);
  }

  return formatSeatsSummary(details.seats, passengers);
}

export type SegmentSeatDraft = Record<number, Record<string, string>>;

export function initialSegmentSeatDraft(
  details: FlightDetails | null | undefined,
  passengers: string[],
): SegmentSeatDraft {
  const draft: SegmentSeatDraft = {};
  if (!details || !usesPerSegmentSeats(details)) return draft;

  flightSegmentsFromDetails(details).forEach((segment, index) => {
    draft[index] = Object.fromEntries(
      passengers.map((name) => [name, segment.seats?.[name]?.trim() ?? ""]),
    );
  });
  return draft;
}

export function applySegmentSeatDraftToDetails(
  details: FlightDetails,
  passengers: string[],
  segmentSeatDraft: SegmentSeatDraft,
): FlightDetails {
  if (!usesPerSegmentSeats(details)) return details;

  let legIndex = 0;
  const nextSegments = (details.segments ?? []).map((segment) => {
    if (segment.transit || !(segment.fromIata || segment.from)) {
      return segment;
    }

    const draft = segmentSeatDraft[legIndex] ?? {};
    legIndex += 1;
    const seats: Record<string, string | null> = { ...(segment.seats ?? {}) };
    for (const name of passengers) {
      seats[name] = draft[name]?.trim() || null;
    }
    return { ...segment, seats };
  });

  return { ...details, segments: nextSegments, seats: undefined };
}
