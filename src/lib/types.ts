export const CATEGORIES = [
  "activity",
  "flight",
  "pet_relocation",
  "accommodation",
  "car_rental",
  "travel_insurance",
] as const;

export type Category = (typeof CATEGORIES)[number];

export type FlightSegment = {
  /** Booked / airport display flight (e.g. QF1234). */
  marketingFlightNumber?: string;
  /** Operating flight used for live tracking (e.g. AA456). */
  operatingFlightNumber?: string;
  /** @deprecated Use marketingFlightNumber + operatingFlightNumber */
  flightNumber?: string;
  from?: string;
  to?: string;
  fromIata?: string;
  toIata?: string;
  departureTime?: string;
  arrivalTime?: string;
  flightTime?: string;
  departureTerminal?: string;
  arrivalTerminal?: string;
  departureGate?: string;
  arrivalGate?: string;
  aircraft?: string;
  transit?: string;
  airport?: string;
};

export type FlightDetails = {
  label: string;
  dayOfWeek?: string;
  travellers: string[];
  passengers?: string[];
  cargoParty?: string[];
  marketingFlightNumber?: string;
  operatingFlightNumber?: string;
  /** @deprecated Use marketingFlightNumber + operatingFlightNumber */
  flightNumber?: string | null;
  from: string;
  to: string;
  fromIata?: string;
  toIata?: string;
  departureTime?: string | null;
  arrivalTime?: string | null;
  totalFlightTime?: string;
  flightTime?: string;
  bookingReference?: string | null;
  bookingReferences?: Record<string, string>;
  baggage?: Record<string, number | null>;
  seats?: Record<string, string | null>;
  aircraft?: string;
  departureTerminal?: string;
  arrivalTerminal?: string;
  departureGate?: string;
  arrivalGate?: string;
  segments?: FlightSegment[];
  notes?: string[];
  status: "confirmed" | "tbc";
};

export type PetRelocationDetails = {
  petName: string;
  species: "cat";
  from: string;
  to: string;
  handler: string;
  transportMode: "cargo";
  dayOfWeek?: string;
  departureTime?: string | null;
  arrivalTime?: string | null;
  notes?: string[];
  status: "confirmed" | "tbc";
};

export type AccommodationSuggestion = {
  label: string;
  url: string;
  platform?: string;
};

export type AccommodationDetails = {
  platform: string;
  bookingStatus: "confirmed" | "suggested" | "private";
  location: string;
  guests: string | string[];
  address?: string | null;
  mapUrl?: string;
  listingUrl?: string;
  suggestions?: AccommodationSuggestion[];
  checkInDate?: string;
  checkOutDate?: string | null;
  checkInTime: string;
  checkOutTime: string;
  hostName?: string;
  confirmationCode?: string;
  notes?: string[];
};

export type CarRentalDetails = {
  company: string;
  vehicleModel?: string;
  bookingStatus: "confirmed" | "suggested";
  pickupLocation: string;
  pickupLat?: number;
  pickupLng?: number;
  pickupTime?: string;
  returnLocation: string;
  returnLat?: number;
  returnLng?: number;
  returnTime?: string;
  mapUrl?: string;
  returnMapUrl?: string;
  confirmationCode?: string;
  notes?: string | string[];
};

export type ActivityLocation = {
  name?: string;
  airportCode?: string;
  mapLink?: string;
  plusCode?: string;
};

export type ActivityDetails = {
  slug: string;
  activityType: string;
  time?: string | null;
  description?: string;
  notes?: string[];
  participants?: string[];
  location?: ActivityLocation;
  linkedItemId?: number;
};

export type TravelInsuranceDetails = {
  provider: string;
  policyNumber?: string;
  coverage?: string;
  emergencyPhone?: string;
  documentUrl?: string;
  notes?: string | string[];
  policyStartDate?: string;
  policyEndDate?: string;
  countries?: string[];
  autoInsuranceIncluded?: boolean;
  autoInsuranceDetails?: string;
  travellers?: string[];
};

export type ItemDetails =
  | ActivityDetails
  | FlightDetails
  | PetRelocationDetails
  | AccommodationDetails
  | CarRentalDetails
  | TravelInsuranceDetails;

export const CATEGORY_META: Record<
  Category,
  { label: string; plural: string; shortLabel: string; icon: string; color: string }
> = {
  activity: {
    label: "Daily Schedule",
    plural: "Daily Schedule",
    shortLabel: "Schedule",
    icon: "calendar",
    color: "indigo",
  },
  flight: {
    label: "Passenger Flights",
    plural: "Passenger Flights",
    shortLabel: "Flights",
    icon: "plane",
    color: "sky",
  },
  pet_relocation: {
    label: "Pet Relocation",
    plural: "Pet Relocation",
    shortLabel: "Pets",
    icon: "cat",
    color: "rose",
  },
  accommodation: {
    label: "Accommodation",
    plural: "Accommodation",
    shortLabel: "Stay",
    icon: "home",
    color: "emerald",
  },
  car_rental: {
    label: "Car Rental",
    plural: "Car Rentals",
    shortLabel: "Cars",
    icon: "car",
    color: "amber",
  },
  travel_insurance: {
    label: "Travel Insurance",
    plural: "Travel Insurance",
    shortLabel: "Insurance",
    icon: "shield",
    color: "violet",
  },
};

export function isCategory(value: string): value is Category {
  return CATEGORIES.includes(value as Category);
}

export function isPetRelocationItem(item: {
  category: string;
  details: unknown;
}): boolean {
  return item.category === "pet_relocation";
}

export function getFlightDetails(details: unknown): FlightDetails | null {
  if (!details || typeof details !== "object") return null;
  const d = details as FlightDetails;
  if (!d.from || !d.to) return null;
  return d;
}

export function getPetRelocationDetails(
  details: unknown,
): PetRelocationDetails | null {
  if (!details || typeof details !== "object") return null;
  const d = details as PetRelocationDetails;
  if (!d.petName) return null;
  return d;
}

export function getAccommodationDetails(
  details: unknown,
): AccommodationDetails | null {
  if (!details || typeof details !== "object") return null;
  const d = details as AccommodationDetails;
  if (!d.platform || !d.location) return null;
  if (typeof d.location === "object") return null;
  return d;
}

export function getActivityDetails(details: unknown): ActivityDetails | null {
  if (!details || typeof details !== "object") return null;
  const d = details as ActivityDetails;
  if (!d.slug || !d.activityType) return null;
  return d;
}

export function getCarRentalDetails(details: unknown): CarRentalDetails | null {
  if (!details || typeof details !== "object") return null;
  const d = details as CarRentalDetails;
  if (!d.company || !d.pickupLocation) return null;
  return d;
}

export function formatTravellerLabel(name: string, isCargo = false): string {
  if (name === "Seymour" && isCargo) return "Seymour (cat, cargo)";
  if (name === "Seymour") return "Seymour (cat)";
  return name;
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

export function airportRoute(from: string, to: string): string {
  return `${from} → ${to}`;
}
