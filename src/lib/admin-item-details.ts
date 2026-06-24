import type { AccommodationSuggestion, Category, FlightSegment } from "@/lib/types";
import { formatFlightNumberDisplay, parseLegacyFlightNumber } from "@/lib/flight-numbers";
import { buildLocationPayload, getItemLocation } from "@/lib/item-location";
import { TRAVELLER_NAMES } from "@/lib/travellers";
import type { UnitsPreference } from "@/lib/user-preferences";

export type TravellerRecord = { name: string; value: string };

export type StructuredItemDetails = {
  participants: string[];
  linkedItemId: string;
  locationName: string;
  locationMapUrl: string;
  travellers: string[];
  bookingReferences: TravellerRecord[];
  seats: TravellerRecord[];
  baggage: TravellerRecord[];
  baggageUnit: UnitsPreference;
  segments: FlightSegment[];
  suggestions: AccommodationSuggestion[];
  notes: string;
  simple: Record<string, string>;
};

const EMPTY_SIMPLE: Record<Category, Record<string, string>> = {
  flight: {
    from: "",
    to: "",
    fromIata: "",
    toIata: "",
    marketingFlightNumber: "",
    operatingFlightNumber: "",
    flightNumber: "",
    departureTime: "",
    arrivalTime: "",
    status: "confirmed",
    aircraft: "",
    departureTerminal: "",
    arrivalTerminal: "",
    departureGate: "",
    arrivalGate: "",
    totalFlightTime: "",
  },
  pet_relocation: {
    petName: "Seymour",
    species: "cat",
    from: "",
    to: "",
    handler: "Pet relocation company",
    status: "tbc",
  },
  accommodation: {
    platform: "airbnb",
    bookingStatus: "confirmed",
    location: "",
    address: "",
    listingUrl: "",
    mapUrl: "",
    checkInDate: "",
    checkOutDate: "",
    checkInTime: "15:00",
    checkOutTime: "10:00",
    guests: "",
    confirmationCode: "",
    hostName: "",
  },
  car_rental: {
    company: "",
    vehicleModel: "",
    bookingStatus: "confirmed",
    pickupLocation: "",
    pickupTime: "",
    returnLocation: "",
    returnTime: "",
    confirmationCode: "",
    mapUrl: "",
  },
  activity: {
    activityType: "outing",
    time: "",
    description: "",
    slug: "",
  },
  travel_insurance: {
    provider: "",
    policyNumber: "",
    coverage: "",
    emergencyPhone: "",
    documentUrl: "",
    policyStartDate: "",
    policyEndDate: "",
    countries: "",
    autoInsuranceIncluded: "false",
    autoInsuranceDetails: "",
  },
};

export function emptyStructuredDetails(category: Category): StructuredItemDetails {
  return {
    participants: [],
    linkedItemId: "",
    locationName: "",
    locationMapUrl: "",
    travellers: [],
    bookingReferences: [],
    seats: [],
    baggage: [],
    baggageUnit: "metric",
    segments: [],
    suggestions: [],
    notes: "",
    simple: { ...EMPTY_SIMPLE[category] },
  };
}

function recordsFromObject(
  record?: Record<string, string | number | null>,
): TravellerRecord[] {
  if (!record) return [];
  return Object.entries(record).map(([name, value]) => ({
    name,
    value: value == null ? "" : String(value),
  }));
}

function objectFromRecords(
  records: TravellerRecord[],
  numeric = false,
): Record<string, string | number | null> {
  return Object.fromEntries(
    records
      .filter((row) => row.name.trim())
      .map((row) => [
        row.name.trim(),
        numeric
          ? row.value.trim()
            ? Number(row.value)
            : null
          : row.value.trim() || null,
      ]),
  );
}

export function parseStructuredDetails(
  category: Category,
  details: Record<string, unknown>,
): StructuredItemDetails {
  const structured = emptyStructuredDetails(category);
  const location = getItemLocation(details);

  structured.locationName = location?.name ?? "";
  structured.locationMapUrl = location?.mapLink ?? "";
  structured.notes = Array.isArray(details.notes)
    ? (details.notes as string[]).join("\n")
    : String(details.notes ?? "");

  if (category === "activity") {
    const d = details;
    structured.simple.activityType = String(d.activityType ?? "outing");
    structured.simple.time = String(d.time ?? "");
    structured.simple.description = String(d.description ?? "");
    structured.simple.slug = String(d.slug ?? "");
    structured.participants = Array.isArray(d.participants)
      ? (d.participants as string[])
      : [];
    structured.linkedItemId = d.linkedItemId ? String(d.linkedItemId) : "";
    return structured;
  }

  for (const key of Object.keys(structured.simple)) {
    const val = details[key];
    if (val != null) structured.simple[key] = String(val);
  }

  if (category === "flight") {
    structured.travellers = Array.isArray(details.travellers)
      ? (details.travellers as string[])
      : [];
    const legacy = parseLegacyFlightNumber(details.flightNumber as string | undefined);
    if (!structured.simple.marketingFlightNumber) {
      structured.simple.marketingFlightNumber =
        (details.marketingFlightNumber as string | undefined) ||
        legacy.marketing ||
        "";
    }
    if (!structured.simple.operatingFlightNumber) {
      structured.simple.operatingFlightNumber =
        (details.operatingFlightNumber as string | undefined) ||
        legacy.operating ||
        "";
    }
    if (!structured.simple.fromIata && details.fromIata) {
      structured.simple.fromIata = String(details.fromIata);
    }
    if (!structured.simple.toIata && details.toIata) {
      structured.simple.toIata = String(details.toIata);
    }
    structured.bookingReferences = recordsFromObject(
      details.bookingReferences as Record<string, string> | undefined,
    );
    if (
      structured.bookingReferences.length === 0 &&
      details.bookingReference
    ) {
      structured.bookingReferences = [
        { name: "Booking", value: String(details.bookingReference) },
      ];
    }
    structured.seats = recordsFromObject(
      details.seats as Record<string, string | null> | undefined,
    );
    structured.baggage = recordsFromObject(
      details.baggage as Record<string, number | null> | undefined,
    );
    structured.segments = Array.isArray(details.segments)
      ? (details.segments as FlightSegment[])
      : [];
  }

  if (category === "accommodation") {
    structured.participants = [];
    if (Array.isArray(details.guests)) {
      structured.simple.guests = (details.guests as string[]).join(", ");
    }
    structured.suggestions = Array.isArray(details.suggestions)
      ? (details.suggestions as AccommodationSuggestion[])
      : [];
  }

  if (category === "travel_insurance") {
    structured.travellers = Array.isArray(details.travellers)
      ? (details.travellers as string[])
      : [];
    if (Array.isArray(details.countries)) {
      structured.simple.countries = (details.countries as string[]).join(", ");
    }
    structured.simple.autoInsuranceIncluded = details.autoInsuranceIncluded
      ? "true"
      : "false";
  }

  return structured;
}

export function buildStructuredDetailsPayload(
  category: Category,
  structured: StructuredItemDetails,
): Record<string, unknown> {
  const location = buildLocationPayload(
    structured.locationName,
    structured.locationMapUrl,
  );
  const notes = structured.notes
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (category === "activity") {
    return {
      slug: structured.simple.slug || `activity-${Date.now()}`,
      activityType: structured.simple.activityType,
      time: structured.simple.time || null,
      description: structured.simple.description || undefined,
      participants: structured.participants,
      linkedItemId: structured.linkedItemId
        ? Number(structured.linkedItemId)
        : undefined,
      location,
      notes: notes.length ? notes : undefined,
    };
  }

  const payload: Record<string, unknown> = {
    ...structured.simple,
    notes: notes.length ? notes : undefined,
    location,
  };

  if (category === "flight") {
    payload.label =
      structured.simple.from && structured.simple.to
        ? `${structured.simple.from} to ${structured.simple.to}`
        : "";
    payload.travellers = structured.travellers;
    payload.marketingFlightNumber =
      structured.simple.marketingFlightNumber.trim() || undefined;
    payload.operatingFlightNumber =
      structured.simple.operatingFlightNumber.trim() ||
      structured.simple.marketingFlightNumber.trim() ||
      undefined;
    payload.fromIata = structured.simple.fromIata.trim().toUpperCase() || undefined;
    payload.toIata = structured.simple.toIata.trim().toUpperCase() || undefined;
    payload.flightNumber = formatFlightNumberDisplay(
      payload.marketingFlightNumber as string | undefined,
      payload.operatingFlightNumber as string | undefined,
    );
    payload.departureTime = structured.simple.departureTime || null;
    payload.arrivalTime = structured.simple.arrivalTime || null;
    payload.departureTerminal = structured.simple.departureTerminal || undefined;
    payload.departureGate = structured.simple.departureGate || undefined;
    payload.arrivalTerminal = structured.simple.arrivalTerminal || undefined;
    payload.arrivalGate = structured.simple.arrivalGate || undefined;
    payload.status = structured.simple.status === "tbc" ? "tbc" : "confirmed";
    payload.bookingReferences = objectFromRecords(
      structured.bookingReferences,
    );
    payload.seats = objectFromRecords(structured.seats);
    payload.baggage = objectFromRecords(structured.baggage, true);
    payload.segments = structured.segments
      .filter(
        (segment) =>
          segment.from ||
          segment.to ||
          segment.marketingFlightNumber ||
          segment.operatingFlightNumber ||
          segment.flightNumber,
      )
      .map((segment) => ({
        ...segment,
        flightNumber:
          formatFlightNumberDisplay(
            segment.marketingFlightNumber,
            segment.operatingFlightNumber,
          ) || segment.flightNumber,
      }));
    delete payload.bookingReference;
  }

  if (category === "accommodation") {
    payload.guests = structured.simple.guests.includes(",")
      ? structured.simple.guests.split(",").map((s) => s.trim()).filter(Boolean)
      : structured.simple.guests;
    payload.suggestions = structured.suggestions.filter((s) => s.label && s.url);
  }

  if (category === "pet_relocation") {
    payload.transportMode = "cargo";
    payload.species = "cat";
    payload.status = structured.simple.status === "tbc" ? "tbc" : "confirmed";
  }

  if (category === "travel_insurance") {
    payload.travellers = structured.travellers;
    payload.policyStartDate = structured.simple.policyStartDate || undefined;
    payload.policyEndDate = structured.simple.policyEndDate || undefined;
    payload.countries = structured.simple.countries
      .split(/[,\n]/)
      .map((entry) => entry.trim())
      .filter(Boolean);
    payload.autoInsuranceIncluded =
      structured.simple.autoInsuranceIncluded === "true";
    payload.autoInsuranceDetails =
      structured.simple.autoInsuranceDetails || undefined;
  }

  return payload;
}

export function defaultTravellerRows(names: string[]): TravellerRecord[] {
  return names.map((name) => ({ name, value: "" }));
}

export function travellerOptions(existing: string[] = []): string[] {
  return [...new Set([...TRAVELLER_NAMES, ...existing])];
}
