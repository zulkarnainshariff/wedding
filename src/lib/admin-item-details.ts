import type { AccommodationSuggestion, Category, FlightSegment } from "@/lib/types";
import { airlineInfoFromFlightNumbers } from "@/lib/airlines";
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
  checkInStatus: Record<string, boolean>;
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
    airlineIata: "",
    airlineName: "",
    operatingAirlineIata: "",
    operatingAirlineName: "",
    departureTime: "",
    arrivalTime: "",
    status: "confirmed",
    aircraft: "",
    arrivalTerminal: "",
    arrivalGate: "",
    departureTerminal: "",
    departureGate: "",
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
    checkInStatus: {},
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
    if (
      !structured.simple.airlineIata &&
      (structured.simple.marketingFlightNumber ||
        structured.simple.operatingFlightNumber)
    ) {
      const airline = airlineInfoFromFlightNumbers({
        marketingFlightNumber: structured.simple.marketingFlightNumber,
        operatingFlightNumber: structured.simple.operatingFlightNumber,
      });
      structured.simple.airlineIata = airline.airlineIata ?? "";
      structured.simple.airlineName =
        structured.simple.airlineName || airline.airlineName || "";
      structured.simple.operatingAirlineIata = airline.operatingAirlineIata ?? "";
      structured.simple.operatingAirlineName =
        structured.simple.operatingAirlineName || airline.operatingAirlineName || "";
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
    if (
      details.checkInStatus &&
      typeof details.checkInStatus === "object" &&
      !Array.isArray(details.checkInStatus)
    ) {
      structured.checkInStatus = Object.fromEntries(
        Object.entries(details.checkInStatus as Record<string, unknown>).filter(
          ([, value]) => typeof value === "boolean",
        ),
      ) as Record<string, boolean>;
    }
  }

  if (category === "accommodation") {
    if (Array.isArray(details.guests)) {
      structured.participants = details.guests as string[];
      structured.simple.guests = (details.guests as string[]).join(", ");
    } else if (typeof details.guests === "string" && details.guests.trim()) {
      structured.simple.guests = details.guests;
      const parts = details.guests
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
      const knownGuests = parts.filter((name) =>
        (TRAVELLER_NAMES as readonly string[]).includes(name),
      );
      if (knownGuests.length > 0) {
        structured.participants = knownGuests;
      }
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
  };

  if (category !== "flight") {
    payload.location = location;
  }

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
    payload.arrivalTerminal = structured.simple.arrivalTerminal || undefined;
    payload.arrivalGate = structured.simple.arrivalGate || undefined;
    payload.departureTerminal = structured.simple.departureTerminal || undefined;
    payload.departureGate = structured.simple.departureGate || undefined;
    payload.airlineIata = structured.simple.airlineIata.trim().toUpperCase() || undefined;
    payload.airlineName = structured.simple.airlineName.trim() || undefined;
    payload.operatingAirlineIata =
      structured.simple.operatingAirlineIata.trim().toUpperCase() || undefined;
    payload.operatingAirlineName =
      structured.simple.operatingAirlineName.trim() || undefined;
    payload.status = structured.simple.status === "tbc" ? "tbc" : "confirmed";
    payload.bookingReferences = objectFromRecords(
      structured.bookingReferences,
    );
    payload.seats = objectFromRecords(structured.seats);
    payload.baggage = objectFromRecords(structured.baggage, true);
    payload.checkInStatus = structured.checkInStatus;
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
    payload.guests = structured.participants.length
      ? structured.participants
      : structured.simple.guests.includes(",")
        ? structured.simple.guests
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : structured.simple.guests || undefined;
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
