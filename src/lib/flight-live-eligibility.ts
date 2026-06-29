import { resolveFlightSchedule } from "@/lib/flight-datetime";
import { getItemCalendarDate } from "@/lib/item-scheduling";
import type { ItineraryItem } from "@/lib/schema";
import { getFlightDetails, type FlightDetails } from "@/lib/types";
import { toDateString } from "@/lib/trip-time";

function addCalendarDays(dateString: string, days: number): string {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(year, month - 1, day + days, 12, 0, 0);
  return toDateString(date);
}

export function isFlightCalendarDay(
  item: ItineraryItem,
  effectiveDate: Date,
): boolean {
  const flightDate = getItemCalendarDate(item);
  return flightDate === toDateString(effectiveDate);
}

export function isEarlyMorningDeparture(details: FlightDetails): boolean {
  const time = details.departureTime?.trim();
  if (time) {
    const [hours] = time.split(":").map(Number);
    if (!Number.isNaN(hours) && hours >= 0 && hours < 6) return true;
  }

  const schedule = resolveFlightSchedule({
    eventDate: null,
    startDatetime: null,
    endDatetime: null,
    details,
  });
  if (schedule.startDatetime) {
    const hours = schedule.startDatetime.getHours();
    return hours >= 0 && hours < 6;
  }

  return false;
}

export function hasSavedFlightGateInfo(details: FlightDetails): boolean {
  return Boolean(
    details.departureGate?.trim() ||
      details.departureTerminal?.trim() ||
      details.arrivalGate?.trim() ||
      details.arrivalTerminal?.trim(),
  );
}

/** Call live status API only on the flight's calendar day. */
export function shouldFetchFlightLiveStatus(
  item: ItineraryItem,
  effectiveDate: Date,
): boolean {
  if (item.category !== "flight") return false;
  if (!getFlightDetails(item.details)) return false;
  return isFlightCalendarDay(item, effectiveDate);
}

/**
 * For early-morning flights, show saved gate/terminal info the day before
 * without calling the live API.
 */
export function shouldShowSavedFlightGateInfo(
  item: ItineraryItem,
  effectiveDate: Date,
): boolean {
  if (item.category !== "flight") return false;
  const details = getFlightDetails(item.details);
  if (!details || !hasSavedFlightGateInfo(details)) return false;
  if (isFlightCalendarDay(item, effectiveDate)) return false;
  if (!isEarlyMorningDeparture(details)) return false;

  const flightDate = getItemCalendarDate(item);
  if (!flightDate) return false;

  const today = toDateString(effectiveDate);
  return flightDate === addCalendarDays(today, 1);
}

export function parseEffectiveDate(value: string | null | undefined): Date | null {
  if (!value?.trim()) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day), 12, 0, 0);
}
