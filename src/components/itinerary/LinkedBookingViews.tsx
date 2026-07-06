"use client";

import { ExternalLink } from "lucide-react";
import { LinkedBookingFullDetail } from "@/components/itinerary/BookingDetailViews";
import { FlightItinerarySummary } from "@/components/itinerary/FlightViews";
import { useItineraryUI } from "@/components/itinerary/ItineraryUIContext";
import { useDisplayFormat } from "@/hooks/useDisplayFormat";
import { useLinkedItem } from "@/hooks/useLinkedItem";
import { formatBookingGroupsDisplay } from "@/lib/booking-groups";
import {
  getAccommodationDetails,
  getCarRentalDetails,
  getFlightDetails,
  getLegacyCategoryMeta,
  isCategory,
} from "@/lib/types";
import type { ItineraryItem } from "@/lib/schema";

function InlineDetail({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  if (!value) return null;
  return (
    <div className="text-xs text-stone-600">
      <span className="font-medium text-stone-500">{label}: </span>
      {value}
    </div>
  );
}

function LinkedBookingCardContent({ item }: { item: ItineraryItem }) {
  const { formatClockTime, formatStayDateTime, formatFlightSchedule } =
    useDisplayFormat();

  if (item.category === "flight") {
    const details = getFlightDetails(item.details);
    const schedule = formatFlightSchedule(item);
    const bookingRef = details
      ? formatBookingGroupsDisplay(
          details.bookingGroups,
          details.bookingReferences,
          details.bookingReference,
        )
      : null;

    return (
      <div className="space-y-2">
        <FlightItinerarySummary item={item} compact />
        {schedule?.departure ? (
          <InlineDetail label="Departs" value={schedule.departure} />
        ) : null}
        {schedule?.arrival ? (
          <InlineDetail label="Arrives" value={schedule.arrival} />
        ) : null}
        <InlineDetail label="Booking ref" value={bookingRef} />
      </div>
    );
  }

  if (item.category === "accommodation") {
    const details = getAccommodationDetails(item.details);
    if (!details) return null;

    return (
      <div className="space-y-0.5">
        <InlineDetail label="Stay" value={details.location} />
        {(details.checkInDate || details.checkInTime) && (
          <InlineDetail
            label="Check-in"
            value={formatStayDateTime(details.checkInDate, details.checkInTime)}
          />
        )}
        {details.checkOutDate ? (
          <InlineDetail
            label="Check-out"
            value={formatStayDateTime(
              details.checkOutDate,
              details.checkOutTime,
            )}
          />
        ) : null}
        <InlineDetail
          label="Guests"
          value={
            Array.isArray(details.guests)
              ? details.guests.join(", ")
              : details.guests
          }
        />
      </div>
    );
  }

  if (item.category === "car_rental") {
    const details = getCarRentalDetails(item.details);
    if (!details) return null;

    return (
      <div className="space-y-0.5">
        <InlineDetail label="Company" value={details.company} />
        <InlineDetail
          label="Pickup"
          value={
            details.pickupTime
              ? `${formatClockTime(details.pickupTime)} · ${details.pickupLocation}`
              : details.pickupLocation
          }
        />
        {details.returnTime || details.returnLocation ? (
          <InlineDetail
            label="Return"
            value={
              details.returnTime
                ? `${formatClockTime(details.returnTime)} · ${details.returnLocation}`
                : details.returnLocation
            }
          />
        ) : null}
      </div>
    );
  }

  return null;
}

export function LinkedBookingCardPreview({
  linkedItemId,
}: {
  linkedItemId: number;
}) {
  const { linkedItem, loading } = useLinkedItem(linkedItemId);
  const { openItem } = useItineraryUI();

  if (loading && !linkedItem) {
    return (
      <p className="mt-3 border-t border-stone-100 pt-3 text-xs text-stone-400">
        Loading booking details…
      </p>
    );
  }

  if (!linkedItem) return null;

  const category = isCategory(linkedItem.category) ? linkedItem.category : null;
  const categoryLabel = category
    ? (getLegacyCategoryMeta(category)?.label ?? category)
    : "Booking";

  return (
    <div className="mt-3 border-t border-stone-100 pt-3">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold tracking-wide text-stone-400 uppercase">
            {categoryLabel}
          </p>
          <p className="text-sm font-medium text-stone-800">{linkedItem.title}</p>
        </div>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            openItem(linkedItem.id);
          }}
          className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-brand-deep hover:underline"
        >
          Open
          <ExternalLink className="h-3 w-3" />
        </button>
      </div>
      <LinkedBookingCardContent item={linkedItem} />
    </div>
  );
}

export function LinkedBookingDetailSection({
  linkedItem,
  canEdit = false,
}: {
  linkedItem: ItineraryItem;
  canEdit?: boolean;
}) {
  const category = isCategory(linkedItem.category) ? linkedItem.category : null;
  const categoryLabel = category
    ? (getLegacyCategoryMeta(category)?.label ?? category)
    : "Booking";

  return (
    <div className="border-t border-stone-100 pt-4">
      <p className="text-[11px] font-semibold tracking-wide text-stone-400 uppercase">
        Linked {categoryLabel.toLowerCase()}
      </p>
      <p className="mt-1 text-base font-medium text-stone-900">{linkedItem.title}</p>
      <div className="mt-4">
        <LinkedBookingFullDetail item={linkedItem} canEdit={canEdit} />
      </div>
    </div>
  );
}
