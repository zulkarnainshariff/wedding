import type { ItineraryItem } from "@/lib/schema";
import { resolveFlightScheduleForItem } from "@/lib/flight-segment-timing";
import {
  applySegmentSeatDraftToDetails,
  usesPerSegmentSeats,
  type SegmentSeatDraft,
} from "@/lib/flight-seats";
import type { FlightDetails } from "@/lib/types";
import { getFlightDetails } from "@/lib/types";

export const FLIGHT_CHECK_IN_REMINDER_WINDOW_MS = 3 * 60 * 60_000;

export function getFlightPassengers(
  details: FlightDetails | null | undefined,
): string[] {
  if (!details) return [];
  const names = details.passengers ?? details.travellers ?? [];
  return names.filter(
    (name) => name.trim() && name !== "Everyone" && name.toLowerCase() !== "all",
  );
}

export function isFlightFullyCheckedIn(
  details: FlightDetails | null | undefined,
): boolean {
  const passengers = getFlightPassengers(details);
  if (passengers.length === 0) return false;
  return passengers.every((name) => Boolean(details?.checkInStatus?.[name]));
}

export function isFlightPartiallyCheckedIn(
  details: FlightDetails | null | undefined,
): boolean {
  const passengers = getFlightPassengers(details);
  if (passengers.length === 0) return false;
  const checked = passengers.filter((name) =>
    Boolean(details?.checkInStatus?.[name]),
  );
  return checked.length > 0 && checked.length < passengers.length;
}

export function buildSeatMapFromPassengers(
  details: FlightDetails | null | undefined,
  seatDraft: Record<string, string>,
): Record<string, string | null> {
  const passengers = getFlightPassengers(details);
  const next: Record<string, string | null> = { ...(details?.seats ?? {}) };

  for (const name of passengers) {
    const seat = seatDraft[name]?.trim();
    next[name] = seat || null;
  }

  return next;
}

export function applyCheckInSeatUpdates(
  details: FlightDetails,
  passengers: string[],
  options: {
    shouldCheckIn: boolean;
    seatDraft?: Record<string, string>;
    segmentSeatDraft?: SegmentSeatDraft;
  },
): FlightDetails {
  const { shouldCheckIn, seatDraft = {}, segmentSeatDraft = {} } = options;

  if (!shouldCheckIn) {
    return {
      ...details,
      checkInStatus: buildCheckInStatusFromPassengers(passengers, false),
    };
  }

  const checkInStatus = buildCheckInStatusFromPassengers(passengers, true);

  if (usesPerSegmentSeats(details)) {
    return {
      ...applySegmentSeatDraftToDetails(details, passengers, segmentSeatDraft),
      checkInStatus,
    };
  }

  return {
    ...details,
    seats: buildSeatMapFromPassengers(details, seatDraft),
    checkInStatus,
  };
}

export function buildCheckInStatusFromPassengers(
  passengers: string[],
  checkedIn: boolean,
): Record<string, boolean> {
  return Object.fromEntries(passengers.map((name) => [name, checkedIn]));
}

export function isFlightCheckInReminderDue(
  item: Pick<
    ItineraryItem,
    "category" | "details" | "eventDate" | "startDatetime" | "endDatetime"
  >,
  now = new Date(),
): boolean {
  if (item.category !== "flight") return false;

  const flightDetails = getFlightDetails(item.details);
  if (!flightDetails) return false;

  const passengers = getFlightPassengers(flightDetails);
  if (passengers.length === 0) return false;
  if (isFlightFullyCheckedIn(flightDetails)) return false;

  const schedule = resolveFlightScheduleForItem(item);
  if (!schedule.startDatetime) return false;

  const msUntilDeparture = schedule.startDatetime.getTime() - now.getTime();
  return (
    msUntilDeparture > 0 &&
    msUntilDeparture <= FLIGHT_CHECK_IN_REMINDER_WINDOW_MS
  );
}
