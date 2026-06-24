import type { CarRentalDetails } from "./types";

export type RawCarRental = {
  label: string;
  company: string;
  bookingStatus?: "confirmed" | "suggested";
  vehicleModel?: string;
  pickupDate: string;
  returnDate?: string | null;
  pickupLocation: string;
  returnLocation?: string;
  mapUrl?: string;
  returnMapUrl?: string;
  pickupTime?: string;
  returnTime?: string;
  confirmationCode?: string;
  notes?: string[];
};

export function buildCarRentalDetails(raw: RawCarRental): CarRentalDetails {
  return {
    company: raw.company,
    vehicleModel: raw.vehicleModel ?? "To be confirmed",
    bookingStatus: raw.bookingStatus ?? "suggested",
    pickupLocation: raw.pickupLocation,
    returnLocation: raw.returnLocation ?? raw.pickupLocation,
    mapUrl: raw.mapUrl,
    returnMapUrl: raw.returnMapUrl ?? raw.mapUrl,
    pickupTime: raw.pickupTime,
    returnTime: raw.returnTime,
    confirmationCode: raw.confirmationCode,
    notes: raw.notes,
  };
}

export function buildCarRentalSummary(raw: RawCarRental): string {
  const status = raw.bookingStatus === "suggested" ? " · Not booked yet" : "";
  return `${raw.pickupLocation}${status}`;
}

export function carRentalPickupDatetime(date: string, time?: string): Date {
  if (time) return new Date(`${date}T${time}:00`);
  return new Date(`${date}T12:00:00`);
}
