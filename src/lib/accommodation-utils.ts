import type { AccommodationDetails } from "./types";
import { normalizeGuestText, normalizeTravellerList } from "./travellers";

export type RawAccommodation = {
  label: string;
  type: string;
  bookingStatus?: "confirmed" | "suggested" | "private";
  location: string;
  checkInDate: string;
  checkOutDate?: string | null;
  guests: string | string[];
  address?: { fullAddress?: string } | null;
  links?: {
    listing?: string;
    map?: string;
    suggestedListing?: string;
  };
  suggestions?: Array<{
    label: string;
    url: string;
    platform?: string;
  }>;
  notes?: string[];
};

const CHECK_IN_TIME = "15:00";
const CHECK_OUT_TIME = "10:00";

export function buildAccommodationDetails(
  raw: RawAccommodation,
): AccommodationDetails {
  const guests = Array.isArray(raw.guests)
    ? normalizeTravellerList(raw.guests)
    : normalizeGuestText(raw.guests);

  const suggestions = [
    ...(raw.suggestions ?? []),
    ...(raw.links?.suggestedListing
      ? [
          {
            label: "Suggested listing",
            url: raw.links.suggestedListing,
            platform: raw.type,
          },
        ]
      : []),
  ];

  let bookingStatus = raw.bookingStatus;
  if (!bookingStatus) {
    if (raw.type === "private-home") bookingStatus = "private";
    else if (suggestions.length > 0 && !raw.links?.listing) {
      bookingStatus = "suggested";
    } else {
      bookingStatus = "confirmed";
    }
  }

  return {
    platform: raw.type,
    bookingStatus,
    location: raw.location,
    guests,
    address: raw.address?.fullAddress ?? null,
    mapUrl: raw.links?.map,
    listingUrl: raw.links?.listing,
    suggestions: suggestions.length > 0 ? suggestions : undefined,
    checkInDate: raw.checkInDate,
    checkOutDate: raw.checkOutDate ?? null,
    checkInTime: CHECK_IN_TIME,
    checkOutTime: CHECK_OUT_TIME,
    notes: raw.notes?.map(normalizeGuestText),
  };
}

export function buildAccommodationSummary(raw: RawAccommodation): string {
  const guests = Array.isArray(raw.guests)
    ? normalizeTravellerList(raw.guests).join(", ")
    : normalizeGuestText(raw.guests);
  const status =
    raw.bookingStatus === "suggested"
      ? " · Suggested"
      : raw.bookingStatus === "private"
        ? " · Private stay"
        : "";
  const dates = raw.checkOutDate
    ? `${raw.checkInDate} → ${raw.checkOutDate}`
    : `From ${raw.checkInDate}`;
  return `${raw.location} · ${guests} · ${dates}${status}`;
}

export function accommodationCheckInDatetime(date: string): Date {
  return new Date(`${date}T${CHECK_IN_TIME}:00`);
}

export function accommodationCheckOutDatetime(
  date: string | null | undefined,
): Date | null {
  if (!date) return null;
  return new Date(`${date}T${CHECK_OUT_TIME}:00`);
}
