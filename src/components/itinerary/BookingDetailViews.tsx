"use client";

import type { ReactNode } from "react";
import { ExternalLink, MapPin } from "lucide-react";
import { useDisplayFormat } from "@/hooks/useDisplayFormat";
import {
  getAccommodationDetails,
  getCarRentalDetails,
  getFlightDetails,
  mapsUrl,
} from "@/lib/types";
import { FlightDetailView } from "@/components/itinerary/FlightViews";
import { FormattedItemNotes, ItemNotesSection } from "@/components/itinerary/FormattedItemNotes";
import type { ItineraryItem } from "@/lib/schema";

function DetailRow({
  label,
  value,
}: {
  label: string;
  value?: ReactNode;
}) {
  if (value == null || value === "") return null;
  return (
    <div className="grid gap-1 border-b border-stone-100 py-3 last:border-0 sm:grid-cols-[10rem_1fr]">
      <dt className="text-sm font-medium text-stone-500">{label}</dt>
      <dd className="text-sm text-stone-800">{value}</dd>
    </div>
  );
}

function MapLink({
  label,
  href,
}: {
  label: string;
  href: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 rounded-xl border border-brand-deep/20 bg-brand-deep px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-ink"
    >
      <MapPin className="h-4 w-4" />
      {label}
      <ExternalLink className="h-3.5 w-3.5 opacity-70" />
    </a>
  );
}

export function AccommodationDetailView({
  details,
}: {
  details: NonNullable<ReturnType<typeof getAccommodationDetails>>;
}) {
  const { formatStayDateTime } = useDisplayFormat();
  const guests = Array.isArray(details.guests)
    ? details.guests.join(", ")
    : details.guests;

  const statusLabel =
    details.bookingStatus === "suggested"
      ? "Suggested — not booked yet"
      : details.bookingStatus === "private"
        ? "Private stay"
        : "Confirmed";

  return (
    <div className="space-y-4">
      {details.bookingStatus === "suggested" && (
        <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-800">
          This stay is not booked yet. Suggested listings are options you are
          considering.
        </div>
      )}

      <dl>
        <DetailRow label="Status" value={statusLabel} />
        <DetailRow label="Platform" value={details.platform} />
        <DetailRow label="Location" value={details.location} />
        <DetailRow label="Guests" value={guests} />
        <DetailRow label="Address" value={details.address ?? undefined} />
        <DetailRow
          label="Check-in"
          value={formatStayDateTime(details.checkInDate, details.checkInTime) ?? undefined}
        />
        <DetailRow
          label="Check-out"
          value={formatStayDateTime(details.checkOutDate, details.checkOutTime) ?? undefined}
        />
        <DetailRow label="Confirmation" value={details.confirmationCode} />
      </dl>

      <div className="flex flex-wrap gap-3">
        {details.listingUrl && (
          <a
            href={details.listingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-800 hover:bg-emerald-100"
          >
            View booking
            <ExternalLink className="h-4 w-4" />
          </a>
        )}
        {details.mapUrl && (
          <MapLink label="Open in Google Maps" href={details.mapUrl} />
        )}
        {details.address && !details.mapUrl && (
          <MapLink
            label="Open in Google Maps"
            href={mapsUrl(details.address)}
          />
        )}
      </div>

      {details.suggestions && details.suggestions.length > 0 && (
        <div className="border-t border-stone-100 py-4">
          <h3 className="text-sm font-semibold tracking-wide text-stone-500 uppercase">
            Suggested listings
          </h3>
          <div className="mt-3 space-y-2">
            {details.suggestions.map((suggestion) => (
              <a
                key={suggestion.url}
                href={suggestion.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between rounded-xl border border-violet-200 bg-violet-50/60 px-4 py-3 text-sm text-violet-900 hover:bg-violet-50"
              >
                <span>
                  {suggestion.label}
                  {suggestion.platform ? ` · ${suggestion.platform}` : ""}
                </span>
                <ExternalLink className="h-4 w-4 shrink-0" />
              </a>
            ))}
          </div>
        </div>
      )}

      <ItemNotesSection notes={details.notes} variant="section" />
    </div>
  );
}

export function CarRentalDetailView({
  details,
}: {
  details: NonNullable<ReturnType<typeof getCarRentalDetails>>;
}) {
  return (
    <div className="space-y-6">
      {details.bookingStatus !== "confirmed" && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          This car rental is not booked yet. The map link shows a suggested
          pick-up location only.
        </div>
      )}

      <dl>
        <DetailRow
          label="Status"
          value={
            details.bookingStatus === "suggested"
              ? "Not booked yet"
              : "Confirmed"
          }
        />
        <DetailRow label="Company" value={details.company} />
        <DetailRow label="Vehicle" value={details.vehicleModel} />
        <DetailRow label="Pickup time" value={details.pickupTime} />
        <DetailRow label="Pickup location" value={details.pickupLocation} />
        <DetailRow label="Return time" value={details.returnTime} />
        <DetailRow label="Return location" value={details.returnLocation} />
        <DetailRow label="Confirmation" value={details.confirmationCode} />
        <DetailRow
          label="Notes"
          value={<FormattedItemNotes notes={details.notes} />}
        />
      </dl>
      <div className="flex flex-wrap gap-3">
        <MapLink
          label="Pickup on Maps"
          href={
            details.mapUrl ??
            mapsUrl(details.pickupLocation, details.pickupLat, details.pickupLng)
          }
        />
        {(details.returnMapUrl ||
          details.returnLocation !== details.pickupLocation) && (
          <MapLink
            label="Return on Maps"
            href={
              details.returnMapUrl ??
              mapsUrl(
                details.returnLocation,
                details.returnLat,
                details.returnLng,
              )
            }
          />
        )}
      </div>
    </div>
  );
}

export function LinkedBookingFullDetail({
  item,
  canEdit = false,
}: {
  item: ItineraryItem;
  canEdit?: boolean;
}) {
  if (item.category === "flight") {
    const details = getFlightDetails(item.details);
    if (!details) return null;
    return (
      <FlightDetailView
        details={details}
        item={item}
        itemId={item.id}
        canEdit={canEdit}
      />
    );
  }

  if (item.category === "accommodation") {
    const details = getAccommodationDetails(item.details);
    if (!details) return null;
    return <AccommodationDetailView details={details} />;
  }

  if (item.category === "car_rental") {
    const details = getCarRentalDetails(item.details);
    if (!details) return null;
    return <CarRentalDetailView details={details} />;
  }

  return null;
}
