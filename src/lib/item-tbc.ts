import type { ItineraryItem } from "@/lib/schema";
import {
  getAccommodationDetails,
  getFlightDetails,
  getPetRelocationDetails,
  type CarRentalDetails,
} from "@/lib/types";

export function getItemTbcReason(item: ItineraryItem): string | null {
  switch (item.category) {
    case "flight": {
      const details = getFlightDetails(item.details);
      return details?.status === "tbc" ? "To be confirmed" : null;
    }
    case "pet_relocation": {
      const details = getPetRelocationDetails(item.details);
      return details?.status === "tbc" ? "To be confirmed" : null;
    }
    case "accommodation": {
      const details = getAccommodationDetails(item.details);
      return details?.bookingStatus === "suggested" ? "Not booked yet" : null;
    }
    case "car_rental": {
      if (!item.details || typeof item.details !== "object") return null;
      const details = item.details as CarRentalDetails;
      return details.bookingStatus === "suggested" ? "Not booked yet" : null;
    }
    default:
      return null;
  }
}

export function isItemTbc(item: ItineraryItem): boolean {
  return getItemTbcReason(item) !== null;
}
