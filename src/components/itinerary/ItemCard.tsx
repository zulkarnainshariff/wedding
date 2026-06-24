"use client";

import { ChevronRight } from "lucide-react";
import { useDisplayFormat } from "@/hooks/useDisplayFormat";
import { CATEGORY_STYLES, getCategoryIcon } from "@/lib/category-ui";
import { formatSeatsSummary } from "@/lib/seats";
import { ACTIVITY_TYPE_LABELS } from "@/lib/activity-utils";
import { getItemLocation } from "@/lib/item-location";
import {
  CATEGORY_META,
  formatTravellerLabel,
  getAccommodationDetails,
  getActivityDetails,
  getCarRentalDetails,
  getFlightDetails,
  getPetRelocationDetails,
  isCategory,
  type Category,
  type FlightDetails,
} from "@/lib/types";
import type { ItineraryItem } from "@/lib/schema";
import { ItemTaskIndicator } from "@/components/tasks/useTaskIndicators";
import type { ItemTaskSummary } from "@/lib/task-queries";
import { useItineraryUI } from "./ItineraryUIContext";

function StatusPill({ status }: { status?: "confirmed" | "tbc" }) {
  if (status !== "tbc") return null;
  return (
    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800 uppercase">
      TBC
    </span>
  );
}

function BookingStatusPill({
  status,
}: {
  status?: "confirmed" | "suggested" | "private";
}) {
  if (!status || status === "confirmed") return null;
  const label = status === "suggested" ? "Suggested" : "Private stay";
  const styles =
    status === "suggested"
      ? "bg-violet-100 text-violet-800"
      : "bg-stone-100 text-stone-700";
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${styles}`}
    >
      {label}
    </span>
  );
}

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

function FlightDetailedPreview({
  details,
  formatClockTime,
  formatBaggage,
}: {
  details: FlightDetails;
  formatClockTime: (time: string | null | undefined) => string;
  formatBaggage: (value: number | null | undefined) => string;
}) {
  const bookingRefs = details.bookingReferences
    ? Object.entries(details.bookingReferences)
        .map(([name, ref]) => `${formatTravellerLabel(name)} ${ref}`)
        .join(" · ")
    : details.bookingReference;

  const baggageSummary = details.baggage
    ? Object.entries(details.baggage)
        .map(([name, kg]) => {
          const cargo = details.cargoParty?.includes(name);
          if (cargo || kg == null) {
            return `${formatTravellerLabel(name, cargo)}: N/A`;
          }
          return `${formatTravellerLabel(name)}: ${formatBaggage(kg)}`;
        })
        .join(" · ")
    : null;

  const seatsSummary = formatSeatsSummary(
    details.seats,
    details.passengers ?? details.travellers,
  );

  const firstSegment = details.segments?.find((s) => !s.transit);

  return (
    <div className="mt-3 space-y-1 border-t border-stone-100 pt-3">
      <InlineDetail
        label="Departs"
        value={formatClockTime(details.departureTime ?? undefined)}
      />
      <InlineDetail
        label="Arrives"
        value={formatClockTime(details.arrivalTime ?? undefined)}
      />
      <InlineDetail
        label="Terminal"
        value={
          details.departureTerminal || details.arrivalTerminal
            ? [
                details.departureTerminal && `Dep ${details.departureTerminal}`,
                details.arrivalTerminal && `Arr ${details.arrivalTerminal}`,
              ]
                .filter(Boolean)
                .join(" · ")
            : firstSegment
              ? [
                  firstSegment.departureTerminal &&
                    `Dep ${firstSegment.departureTerminal}`,
                  firstSegment.arrivalTerminal &&
                    `Arr ${firstSegment.arrivalTerminal}`,
                ]
                  .filter(Boolean)
                  .join(" · ")
              : undefined
        }
      />
      <InlineDetail label="Baggage" value={baggageSummary} />
      <InlineDetail label="Booking ref" value={bookingRefs} />
      <InlineDetail
        label="Aircraft"
        value={details.aircraft ?? firstSegment?.aircraft}
      />
      <InlineDetail label="Seats" value={seatsSummary} />
    </div>
  );
}

function LinkedPill() {
  return (
    <span className="rounded-full bg-[#1e3a5f]/10 px-2 py-0.5 text-[10px] font-semibold text-[#1e3a5f] uppercase">
      View booking
    </span>
  );
}

export function ItemCard({
  item,
  taskSummary,
}: {
  item: ItineraryItem;
  taskSummary?: ItemTaskSummary;
}) {
  const { openItem, viewMode } = useItineraryUI();
  const { formatDateTime, formatClockTime, formatBaggage } = useDisplayFormat();
  const category = isCategory(item.category) ? item.category : "flight";
  const styles = CATEGORY_STYLES[category];
  const Icon = getCategoryIcon(category);
  const flightDetails = getFlightDetails(item.details);
  const petDetails = getPetRelocationDetails(item.details);
  const stayDetails = getAccommodationDetails(item.details);
  const carDetails = getCarRentalDetails(item.details);
  const activityDetails = getActivityDetails(item.details);
  const itemLocation = getItemLocation(item.details as Record<string, unknown>);
  const status = flightDetails?.status ?? petDetails?.status;
  const linkedItemId = activityDetails?.linkedItemId;

  const categoryLabel =
    category === "activity"
      ? ACTIVITY_TYPE_LABELS[activityDetails?.activityType ?? ""] ??
        "Schedule"
      : category === "pet_relocation"
        ? "Pet Relocation (cargo)"
        : CATEGORY_META[category as Category]?.label ?? item.category;

  const showFlightDetails =
    viewMode === "detailed" && category === "flight" && flightDetails;

  const displayTime =
    (activityDetails?.time
      ? formatClockTime(activityDetails.time)
      : null) ??
    (item.startDatetime ? formatDateTime(item.startDatetime) : null);

  return (
    <button
      type="button"
      onClick={() => openItem(item.id)}
      className={[
        "group w-full rounded-2xl border bg-white p-4 text-left shadow-sm transition-all",
        "hover:-translate-y-0.5 hover:border-[#1e3a5f]/20 hover:shadow-md",
        styles.border,
      ].join(" ")}
    >
      <div className="flex items-start gap-3">
        <div
          className={[
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
            styles.bg,
            styles.text,
          ].join(" ")}
        >
          <Icon className="h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[11px] font-semibold tracking-wide text-stone-400 uppercase">
                  {categoryLabel}
                </p>
                <StatusPill status={status} />
                <BookingStatusPill status={stayDetails?.bookingStatus} />
                <BookingStatusPill status={carDetails?.bookingStatus} />
                {linkedItemId && <LinkedPill />}
                <ItemTaskIndicator summary={taskSummary} />
              </div>
              <h3 className="mt-0.5 font-medium text-stone-900 group-hover:text-[#1e3a5f]">
                {item.title}
              </h3>
            </div>
            <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-stone-300 group-hover:text-[#d4a853]" />
          </div>

          {item.summary && (
            <p className="mt-1 text-sm text-stone-500">{item.summary}</p>
          )}

          {itemLocation?.name && (
            <p className="mt-1 text-sm">
              {itemLocation.mapLink ? (
                <a
                  href={itemLocation.mapLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(event) => event.stopPropagation()}
                  className="text-[#1e3a5f] underline decoration-[#d4a853]/60"
                >
                  {itemLocation.name}
                </a>
              ) : (
                <span className="text-stone-600">{itemLocation.name}</span>
              )}
            </p>
          )}

          {displayTime && (viewMode === "condensed" || category === "activity") && (
            <p className="mt-2 text-xs text-stone-400">{displayTime}</p>
          )}

          {viewMode === "condensed" &&
            category !== "activity" &&
            item.startDatetime && (
              <p className="mt-2 text-xs text-stone-400">
                {formatDateTime(item.startDatetime)}
              </p>
            )}

          {showFlightDetails && (
            <FlightDetailedPreview
              details={flightDetails}
              formatClockTime={formatClockTime}
              formatBaggage={formatBaggage}
            />
          )}

          {viewMode === "detailed" && stayDetails && (
            <div className="mt-3 space-y-1 border-t border-stone-100 pt-3">
              <InlineDetail
                label="Check-in"
                value={`${stayDetails.checkInDate} ${stayDetails.checkInTime}`}
              />
              {stayDetails.checkOutDate && (
                <InlineDetail
                  label="Check-out"
                  value={`${stayDetails.checkOutDate} ${stayDetails.checkOutTime}`}
                />
              )}
              <InlineDetail
                label="Guests"
                value={
                  Array.isArray(stayDetails.guests)
                    ? stayDetails.guests.join(", ")
                    : stayDetails.guests
                }
              />
              {stayDetails.suggestions && stayDetails.suggestions.length > 0 && (
                <InlineDetail
                  label="Suggestions"
                  value={`${stayDetails.suggestions.length} listing(s)`}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
