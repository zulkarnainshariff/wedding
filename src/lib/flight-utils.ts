import type { Category, FlightDetails, PetRelocationDetails } from "./types";
import { parseStoredClockTime } from "./flight-datetime";
import {
  normalizeNotes,
  normalizeTravellerList,
  normalizeTravellerRecord,
} from "./travellers";

type RawFlight = {
  label: string;
  date: string;
  day?: string;
  travellers: string[];
  flightNumber?: string | null;
  from: string;
  to: string;
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
  segments?: FlightDetails["segments"];
  notes?: string[];
};

export function isPetRelocationFlight(flight: RawFlight): boolean {
  return (
    flight.label.toLowerCase().includes("seymour relocation") ||
    (flight.travellers.length === 1 && flight.travellers[0] === "Seymour")
  );
}

export function isTbcFlight(flight: RawFlight): boolean {
  if (isPetRelocationFlight(flight)) {
    return flight.label.includes("(TBC)");
  }
  return (
    flight.label.includes("(TBC)") ||
    flight.flightNumber == null ||
    flight.departureTime == null
  );
}

export function resolveCargoParty(flight: RawFlight): string[] {
  const cargo: string[] = [];
  if (flight.notes?.some((n) => n.toLowerCase().includes("seymour") && n.toLowerCase().includes("cargo"))) {
    if (flight.travellers.includes("Seymour")) cargo.push("Seymour");
  }
  return cargo;
}

export function resolvePassengers(flight: RawFlight): string[] {
  const cargo = new Set(resolveCargoParty(flight));
  return normalizeTravellerList(flight.travellers).filter((t) => !cargo.has(t));
}

export function combineDateTime(
  date: string,
  time: string | null | undefined,
): Date | null {
  if (!time) return new Date(`${date}T12:00:00`);
  const parsed = parseStoredClockTime(time);
  if (parsed) {
    const useDate = parsed.embeddedDate ?? date;
    return new Date(`${useDate}T${parsed.clock}:00`);
  }
  return new Date(`${date}T${time}:00`);
}

function normalizeClockField(
  value: string | null | undefined,
): string | null | undefined {
  if (!value) return value;
  return parseStoredClockTime(value)?.clock ?? value;
}

export function buildFlightCategory(flight: RawFlight): Category {
  return isPetRelocationFlight(flight) ? "pet_relocation" : "flight";
}

export function buildFlightSummary(flight: RawFlight, category: Category): string {
  const route = `${flight.from} → ${flight.to}`;
  if (category === "pet_relocation") {
    return `${route} · Seymour (cat) · cargo via pet relocation company`;
  }
  const passengers = resolvePassengers(flight);
  const cargo = resolveCargoParty(flight);
  const people = passengers.join(", ");
  const cargoNote =
    cargo.length > 0
      ? ` · ${cargo.map((c) => "Seymour (cat, cargo)").join(", ")}`
      : "";
  const status = isTbcFlight(flight) ? " · TBC" : "";
  return `${route} · ${people}${cargoNote}${status}`;
}

export function buildFlightDetails(flight: RawFlight): FlightDetails {
  const cargoParty = resolveCargoParty(flight);
  const passengers = resolvePassengers(flight);

  return {
    label: flight.label,
    dayOfWeek: flight.day,
    travellers: normalizeTravellerList(flight.travellers),
    passengers,
    cargoParty: cargoParty.length > 0 ? cargoParty : undefined,
    flightNumber: flight.flightNumber,
    from: flight.from,
    to: flight.to,
    departureTime: normalizeClockField(flight.departureTime),
    arrivalTime: normalizeClockField(flight.arrivalTime),
    totalFlightTime: flight.totalFlightTime,
    flightTime: flight.flightTime,
    bookingReference: flight.bookingReference,
    bookingReferences: flight.bookingReferences
      ? normalizeTravellerRecord(flight.bookingReferences)
      : undefined,
    baggage: flight.baggage
      ? normalizeTravellerRecord(flight.baggage)
      : undefined,
    seats: flight.seats ? normalizeTravellerRecord(flight.seats) : undefined,
    aircraft: flight.aircraft,
    departureTerminal: flight.departureTerminal,
    arrivalTerminal: flight.arrivalTerminal,
    segments: flight.segments?.map((segment) =>
      segment.transit
        ? segment
        : {
            ...segment,
            departureTime: normalizeClockField(segment.departureTime) ?? segment.departureTime,
            arrivalTime: normalizeClockField(segment.arrivalTime) ?? segment.arrivalTime,
          },
    ),
    notes: normalizeNotes(flight.notes),
    status: isTbcFlight(flight) ? "tbc" : "confirmed",
  };
}

export function buildPetRelocationDetails(flight: RawFlight): PetRelocationDetails {
  return {
    petName: "Seymour",
    species: "cat",
    from: flight.from,
    to: flight.to,
    handler: "Pet relocation company",
    transportMode: "cargo",
    dayOfWeek: flight.day,
    departureTime: flight.departureTime,
    arrivalTime: flight.arrivalTime,
    notes: flight.notes ?? [
      "Cat relocation handled by pet relocation company",
      "Travelling as cargo — not a passenger booking",
    ],
    status: isTbcFlight(flight) ? "tbc" : "confirmed",
  };
}

export type { RawFlight };
