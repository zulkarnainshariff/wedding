export const CATEGORIES = [
  "flight",
  "accommodation",
  "car_rental",
  "travel_insurance",
] as const;

export type Category = (typeof CATEGORIES)[number];

export type FlightDetails = {
  airline: string;
  flightNumber: string;
  departureAirport: string;
  arrivalAirport: string;
  departureTime?: string;
  arrivalTime?: string;
  confirmationCode?: string;
  terminal?: string;
  seat?: string;
  notes?: string;
};

export type AccommodationDetails = {
  platform: string;
  listingUrl?: string;
  address: string;
  lat?: number;
  lng?: number;
  checkInTime?: string;
  checkOutTime?: string;
  hostName?: string;
  confirmationCode?: string;
  notes?: string;
};

export type CarRentalDetails = {
  company: string;
  vehicleModel: string;
  pickupLocation: string;
  pickupLat?: number;
  pickupLng?: number;
  pickupTime?: string;
  returnLocation: string;
  returnLat?: number;
  returnLng?: number;
  returnTime?: string;
  confirmationCode?: string;
  notes?: string;
};

export type TravelInsuranceDetails = {
  provider: string;
  policyNumber?: string;
  coverage?: string;
  emergencyPhone?: string;
  documentUrl?: string;
  notes?: string;
};

export type ItemDetails =
  | FlightDetails
  | AccommodationDetails
  | CarRentalDetails
  | TravelInsuranceDetails;

export const CATEGORY_META: Record<
  Category,
  { label: string; plural: string; icon: string; color: string }
> = {
  flight: {
    label: "Flights",
    plural: "Flights",
    icon: "plane",
    color: "sky",
  },
  accommodation: {
    label: "Accommodation",
    plural: "Accommodation",
    icon: "home",
    color: "emerald",
  },
  car_rental: {
    label: "Car Rental",
    plural: "Car Rentals",
    icon: "car",
    color: "amber",
  },
  travel_insurance: {
    label: "Travel Insurance",
    plural: "Travel Insurance",
    icon: "shield",
    color: "violet",
  },
};

export function isCategory(value: string): value is Category {
  return CATEGORIES.includes(value as Category);
}

export function mapsUrl(address: string, lat?: number, lng?: number): string {
  if (lat != null && lng != null) {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

export function formatDate(dateStr: string): string {
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatDateTime(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatTime(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
