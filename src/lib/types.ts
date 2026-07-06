import {
  DEFAULT_USER_PREFERENCES,
  type UserPreferences,
} from "./user-preferences";
import { formatDateOnlyWithPrefs } from "./display-format";

/** Built-in item category slugs — kept for legacy fallbacks and specialized forms. */
export const LEGACY_CATEGORIES = [
  "activity",
  "flight",
  "pet_relocation",
  "accommodation",
  "car_rental",
  "travel_insurance",
] as const;

/** @deprecated Prefer DB-backed categories via app-categories / useCategories(). */
export const CATEGORIES = LEGACY_CATEGORIES;

export type LegacyCategory = (typeof LEGACY_CATEGORIES)[number];

/** Item category slug — may be a built-in or custom DB category. */
export type Category = string;

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
  seats?: Record<string, string | null>;
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
  airlineIata?: string;
  airlineName?: string;
  operatingAirlineIata?: string;
  operatingAirlineName?: string;
  from: string;
  to: string;
  fromIata?: string;
  toIata?: string;
  fromTimezone?: string;
  toTimezone?: string;
  departureTime?: string | null;
  arrivalTime?: string | null;
  totalFlightTime?: string;
  flightTime?: string;
  bookingReference?: string | null;
  bookingReferences?: Record<string, string>;
  bookingGroups?: import("./booking-groups").BookingGroup[];
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
  checkInStatus?: Record<string, boolean>;
};

export type PetRelocationDetails = {
  petName: string;
  species: "cat";
  from: string;
  to: string;
  handler: string;
  transportMode: "cargo";
  participants?: string[];
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
  driver?: string;
  participants?: string[];
  linkedItemId?: number;
  isCarRentalBooking?: boolean;
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
  viewers?: string[];
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

/** @deprecated Prefer getCategoryMeta() / useCategories().getMeta(). */
export const CATEGORY_META: Record<
  string,
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
    label: "Flights",
    plural: "Flights",
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

export function getLegacyCategoryMeta(
  slug: string,
): (typeof CATEGORY_META)[LegacyCategory] | undefined {
  return CATEGORY_META[slug as LegacyCategory];
}

export function isCategory(
  value: string,
  slugs?: readonly string[],
): value is Category {
  const list = slugs ?? LEGACY_CATEGORIES;
  return (list as readonly string[]).includes(value);
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
  const fromIata =
    typeof d.fromIata === "string" ? d.fromIata.trim().toUpperCase() : "";
  const toIata =
    typeof d.toIata === "string" ? d.toIata.trim().toUpperCase() : "";
  const fromCity = d.from?.trim() || "";
  const toCity = d.to?.trim() || "";
  const from = fromCity || fromIata;
  const to = toCity || toIata;
  if (!from || !to) return null;
  return {
    ...d,
    from,
    to,
    fromIata: fromIata || undefined,
    toIata: toIata || undefined,
  };
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

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** Calendar date using display preferences (defaults to DD-MM-YYYY). */
export function formatDate(
  dateStr: string,
  preferences: UserPreferences = DEFAULT_USER_PREFERENCES,
): string {
  return formatDateOnlyWithPrefs(dateStr, preferences);
}

export function formatDateTime(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return "—";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${WEEKDAY_SHORT[d.getDay()]}, ${d.getDate()} ${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
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
