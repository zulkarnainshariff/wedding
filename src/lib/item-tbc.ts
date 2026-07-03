import type { ItineraryItem } from "@/lib/schema";
import {
  getAccommodationDetails,
  getCarRentalDetails,
  getFlightDetails,
  getPetRelocationDetails,
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
      const details = getCarRentalDetails(item.details);
      return details?.bookingStatus === "suggested" ? "Not booked yet" : null;
    }
    default:
      return null;
  }
}

export function isItemTbc(item: ItineraryItem): boolean {
  return getItemTbcReason(item) !== null;
}
