import type { AccommodationSuggestion, Category, FlightSegment } from "@/lib/types";
import {
  migrateTopLevelSeatsToSegments,
  usesPerSegmentSeats,
} from "@/lib/flight-seats";
import {
  flatMapFromGroups,
  groupsFromDetails,
  normalizeBookingGroupLinks,
  type BookingGroup,
} from "@/lib/booking-groups";
import { airlineInfoFromFlightNumbers } from "@/lib/airlines";
import { formatFlightNumberDisplay, parseLegacyFlightNumber } from "@/lib/flight-numbers";
import { buildLocationPayload, getItemLocation } from "@/lib/item-location";
import { mergeItemPrivacyFields } from "@/lib/admin-item-privacy";
import { parsePrivateViewers } from "@/lib/item-privacy";
import { TRAVELLER_NAMES } from "@/lib/travellers";
import type { UnitsPreference } from "@/lib/user-preferences";

export type TravellerRecord = { name: string; value: string };

export type StructuredItemDetails = {
  participants: string[];
  linkedItemId: string;
  locationName: string;
  locationMapUrl: string;
  isPrivate: boolean;
  privateViewers: string[];
  travellers: string[];
  bookingGroups: BookingGroup[];
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
    isPrivate: false,
    privateViewers: [],
    travellers: [],
    bookingGroups: [],
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
  structured.isPrivate = Boolean(details.isPrivate);
  structured.privateViewers = parsePrivateViewers(
    details.privateViewers ?? details.extraViewers,
  );
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
    structured.bookingGroups = groupsFromDetails(details);
    structured.baggage = recordsFromObject(
      details.baggage as Record<string, number | null> | undefined,
    );
    structured.segments = Array.isArray(details.segments)
      ? (details.segments as FlightSegment[])
      : [];
    const migrated = migrateTopLevelSeatsToSegments({
      ...(details as Record<string, unknown>),
      segments: structured.segments,
      seats: details.seats as Record<string, string | null> | undefined,
    } as import("@/lib/types").FlightDetails);
    if (usesPerSegmentSeats(migrated)) {
      structured.segments = migrated.segments ?? structured.segments;
      structured.seats = [];
    } else {
      structured.seats = recordsFromObject(
        details.seats as Record<string, string | null> | undefined,
      );
    }
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

  if (category === "car_rental") {
    if (Array.isArray(details.participants)) {
      structured.participants = (details.participants as string[]).filter(
        (entry): entry is string => typeof entry === "string",
      );
    } else if (typeof details.driver === "string" && details.driver.trim()) {
      structured.participants = [details.driver.trim()];
    }
  }

  if (category === "pet_relocation") {
    structured.participants = Array.isArray(details.participants)
      ? (details.participants as string[]).filter(
          (entry): entry is string => typeof entry === "string",
        )
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
    return mergeItemPrivacyFields(
      {
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
      },
      structured,
    );
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
    payload.bookingGroups = normalizeBookingGroupLinks(
      structured.bookingGroups.filter((group) => group.reference.trim()),
    ).map((group) => ({
      reference: group.reference.trim(),
      travellers: group.travellers.filter((name) => name.trim()),
      linkedWith: (group.linkedWith ?? []).filter(Boolean),
    }));
    payload.bookingReferences = flatMapFromGroups(structured.bookingGroups);
    payload.baggage = objectFromRecords(structured.baggage, true);
    payload.checkInStatus = structured.checkInStatus;
    const filteredSegments = structured.segments
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
        seats: segment.seats
          ? (Object.fromEntries(
              Object.entries(segment.seats).map(([name, value]) => [
                name,
                typeof value === "string" && value.trim() ? value.trim() : null,
              ]),
            ) as Record<string, string | null>)
          : undefined,
      }));
    payload.segments = filteredSegments;
    if (filteredSegments.length >= 2) {
      delete payload.seats;
    } else {
      payload.seats = objectFromRecords(structured.seats);
    }
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

  if (category === "car_rental" && structured.participants.length > 0) {
    payload.driver = structured.participants[0];
  }

  if (category === "pet_relocation") {
    payload.transportMode = "cargo";
    payload.species = "cat";
    payload.status = structured.simple.status === "tbc" ? "tbc" : "confirmed";
    payload.participants = structured.participants;
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

  return mergeItemPrivacyFields(payload, structured);
}

export function defaultTravellerRows(names: string[]): TravellerRecord[] {
  return names.map((name) => ({ name, value: "" }));
}

export function travellerOptions(existing: string[] = []): string[] {
  return [...new Set([...TRAVELLER_NAMES, ...existing])];
}
