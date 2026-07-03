import type { ItineraryItem } from "@/lib/schema";
import type { CarRentalDetails } from "@/lib/types";
import { getCarRentalDetails } from "@/lib/types";

/** Booking items appear on /itinerary/car_rental; schedule slots are day-only links. */
export function isCarRentalBookingItem(item: ItineraryItem): boolean {
  if (item.category !== "car_rental") return false;

  const details = (item.details ?? {}) as CarRentalDetails;
  return details.isCarRentalBooking !== false;
}

export function isCarRentalScheduleItem(item: ItineraryItem): boolean {
  if (item.category !== "car_rental") return false;

  const details = (item.details ?? {}) as CarRentalDetails;
  return details.isCarRentalBooking === false;
}

export function getLinkedCarRentalBookingIds(items: ItineraryItem[]): Set<number> {
  const ids = new Set<number>();
  for (const item of items) {
    if (!isCarRentalScheduleItem(item)) continue;
    const linked = (item.details as CarRentalDetails | null)?.linkedItemId;
    if (typeof linked === "number") ids.add(linked);
  }
  return ids;
}

export function listUnlinkedSuggestedCarRentalBookings(
  items: ItineraryItem[],
  excludeScheduleItemId?: number,
): ItineraryItem[] {
  const linkedIds = getLinkedCarRentalBookingIds(items);

  if (excludeScheduleItemId != null) {
    const editing = items.find((item) => item.id === excludeScheduleItemId);
    const currentLinked = (editing?.details as CarRentalDetails | null)
      ?.linkedItemId;
    if (typeof currentLinked === "number") {
      linkedIds.delete(currentLinked);
    }
  }

  return items.filter((item) => {
    if (!isCarRentalBookingItem(item)) return false;
    const details = getCarRentalDetails(item.details);
    if (details?.bookingStatus !== "suggested") return false;
    return !linkedIds.has(item.id);
  });
}
