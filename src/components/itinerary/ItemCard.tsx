"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { useDisplayFormat } from "@/hooks/useDisplayFormat";
import { formatBookingGroupsDisplay } from "@/lib/booking-groups";
import { CATEGORY_STYLES, getCategoryIcon } from "@/lib/category-ui";
import { formatFlightSeatsSummary } from "@/lib/flight-seats";
import { ACTIVITY_TYPE_LABELS } from "@/lib/activity-utils";
import { FlightItinerarySummary } from "@/components/itinerary/FlightViews";
import { getAccommodationTileLines, enrichStayDetailsFromItem, buildAccommodationCompactSummary } from "@/lib/accommodation-utils";
import { useStackedAccommodationLayout } from "@/hooks/useStackedAccommodationLayout";
import { getItemLocation, getItemMapLink } from "@/lib/item-location";
import { isItemPrivate } from "@/lib/item-privacy";
import { ItemMapLink } from "@/components/itinerary/ItemMapLink";
import { LinkedBookingCardPreview } from "@/components/itinerary/LinkedBookingViews";
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
import { FlightProgressBar } from "@/components/itinerary/FlightProgressBar";
import {
  ItemCompleteToggle,
  ItemDoneBadge,
  type ItemDoneAccent,
} from "@/components/itinerary/ItemCompleteToggle";
import { FlightCheckInBadge, FlightCheckInReminderPill, FlightCheckInToggle } from "@/components/itinerary/FlightCheckInToggle";
import {
  isFlightFullyCheckedIn,
  isFlightPartiallyCheckedIn,
} from "@/lib/flight-check-in";
import {
  formatFlightProgressDuration,
  flightRouteLine,
  flightSummaryExtraParts,
  getFlightTimelineDisplay,
  isFlightInProgress,
  isFlightLanded,
} from "@/lib/flight-progress";
import { isItemCompleted } from "@/lib/item-completion";
import type { ItineraryItemWithSubItems } from "@/lib/item-subitem-utils";
import { SubItemCascade } from "./SubItemDisplay";
import { useItineraryUI } from "./ItineraryUIContext";

function StatusPill({ status }: { status?: "confirmed" | "tbc" }) {
  if (status !== "tbc") return null;
  return (
    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800 uppercase">
      TBC
    </span>
  );
}

function PrivateItemPill() {
  return (
    <span className="rounded-full bg-stone-200 px-2 py-0.5 text-[10px] font-semibold text-stone-700 uppercase">
      Private
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
  item,
  details,
  formatBaggage,
}: {
  item: ItineraryItem;
  details: FlightDetails;
  formatBaggage: (value: number | null | undefined) => string;
}) {
  const bookingRefs = formatBookingGroupsDisplay(
    details.bookingGroups,
    details.bookingReferences,
    details.bookingReference,
  );

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

  const seatsSummary = formatFlightSeatsSummary(
    details,
    details.passengers ?? details.travellers,
  );

  const firstSegment = details.segments?.find((s) => !s.transit);

  return (
    <div className="mt-3 space-y-3 border-t border-stone-100 pt-3">
      <FlightItinerarySummary item={item} compact />
      <InlineDetail
        label="Dep. terminal"
        value={
          details.departureTerminal || details.departureGate
            ? [
                details.departureTerminal &&
                  `Terminal ${details.departureTerminal}`,
                details.departureGate && `Gate ${details.departureGate}`,
              ]
                .filter(Boolean)
                .join(" · ")
            : firstSegment?.departureTerminal || firstSegment?.departureGate
              ? [
                  firstSegment.departureTerminal &&
                    `Terminal ${firstSegment.departureTerminal}`,
                  firstSegment.departureGate &&
                    `Gate ${firstSegment.departureGate}`,
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
    <span className="rounded-full bg-brand-deep/10 px-2 py-0.5 text-[10px] font-semibold text-brand-deep uppercase">
      View booking
    </span>
  );
}

export function ItemCard({
  item,
  taskSummary,
}: {
  item: ItineraryItemWithSubItems;
  taskSummary?: ItemTaskSummary;
}) {
  const { openItem, viewMode } = useItineraryUI();
  const {
    formatDateTime,
    formatClockTime,
    formatBaggage,
    formatFlightSchedule,
    formatStayDateTime,
    preferences,
  } = useDisplayFormat();
  const category = isCategory(item.category) ? item.category : "flight";
  const styles = CATEGORY_STYLES[category];
  const Icon = getCategoryIcon(category);
  const flightDetails = getFlightDetails(item.details);
  const petDetails = getPetRelocationDetails(item.details);
  const stayDetails = getAccommodationDetails(item.details);
  const carDetails = getCarRentalDetails(item.details);
  const activityDetails = getActivityDetails(item.details);
  const itemLocation = getItemLocation(item.details as Record<string, unknown>);
  const itemMapLink = getItemMapLink(
    item.details as Record<string, unknown>,
    category,
  );
  const status = flightDetails?.status ?? petDetails?.status;
  const linkedItemId = activityDetails?.linkedItemId;

  const categoryLabel =
    category === "activity" && activityDetails?.activityType === "sub_item"
      ? null
      : category === "activity"
      ? ACTIVITY_TYPE_LABELS[activityDetails?.activityType ?? ""] ??
        "Schedule"
      : category === "pet_relocation"
        ? "Pet Relocation (cargo)"
        : CATEGORY_META[category as Category]?.label ?? item.category;

  const showFlightDetails =
    viewMode === "detailed" && category === "flight" && flightDetails;

  const flightSchedule =
    category === "flight" ? formatFlightSchedule(item) : null;
  const flightTimeline =
    category === "flight" ? getFlightTimelineDisplay(item) : null;
  const flightRoute =
    category === "flight" ? flightRouteLine(flightTimeline, item.summary) : null;
  const flightSummaryExtras =
    category === "flight" ? flightSummaryExtraParts(item.summary, flightRoute) : [];
  const completed = isItemCompleted(item);
  const flightCheckedIn =
    category === "flight" &&
    (isFlightFullyCheckedIn(flightDetails) ||
      isFlightPartiallyCheckedIn(flightDetails));
  const subItems = item.subItems ?? [];
  const router = useRouter();
  const autoCompleteRequestedRef = useRef(false);

  const [flightInProgress, setFlightInProgress] = useState(() =>
    category === "flight" ? isFlightInProgress(item) : false,
  );

  useEffect(() => {
    autoCompleteRequestedRef.current = false;
  }, [item.id]);

  useEffect(() => {
    if (category !== "flight") return;
    const tick = () => setFlightInProgress(isFlightInProgress(item));
    tick();
    const interval = window.setInterval(tick, 30_000);
    return () => window.clearInterval(interval);
  }, [item, category]);

  useEffect(() => {
    if (category !== "flight") return;

    const tryAutoComplete = () => {
      if (!isFlightLanded(item)) return;
      if (isItemCompleted(item)) return;
      if (autoCompleteRequestedRef.current) return;

      autoCompleteRequestedRef.current = true;
      void fetch(`/api/items/${item.id}/complete-if-landed`, { method: "POST" })
        .then((response) => (response.ok ? response.json() : null))
        .then((payload: { autoCompleted?: boolean } | null) => {
          if (payload?.autoCompleted) {
            router.refresh();
          }
        })
        .catch(() => {
          autoCompleteRequestedRef.current = false;
        });
    };

    tryAutoComplete();
    const interval = window.setInterval(tryAutoComplete, 30_000);
    return () => window.clearInterval(interval);
  }, [category, item, router]);

  const doneAccent: ItemDoneAccent = flightInProgress ? "amber" : "emerald";

  const stackedAccommodation = useStackedAccommodationLayout();
  const enrichedStayDetails =
    category === "accommodation" && stayDetails
      ? enrichStayDetailsFromItem(item, stayDetails)
      : null;
  const accommodationLines =
    enrichedStayDetails && stackedAccommodation
      ? getAccommodationTileLines(enrichedStayDetails, preferences)
      : [];
  const accommodationSummary =
    enrichedStayDetails && !stackedAccommodation
      ? buildAccommodationCompactSummary(enrichedStayDetails, preferences) ||
        item.summary
      : null;

  const displayTime =
    (activityDetails?.time
      ? formatClockTime(activityDetails.time)
      : null) ??
    (item.startDatetime ? formatDateTime(item.startDatetime) : null);

  return (
    <div
      className={[
        "group theme-card w-full rounded-2xl border bg-surface shadow-sm transition-all",
        "hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-md",
        styles.border,
        completed
          ? doneAccent === "amber"
            ? "border-amber-200 bg-amber-50/40"
            : "border-emerald-200 bg-emerald-50/40"
          : flightInProgress
            ? "border-amber-200/80 bg-amber-50/20"
            : "",
      ].join(" ")}
    >
      <div className="flex items-start gap-1.5 p-4">
        <button
          type="button"
          onClick={() => openItem(item.id)}
          className="flex min-w-0 flex-1 items-start gap-3 text-left"
        >
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
          <div className="flex min-w-0 flex-1 items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                {categoryLabel && (
                  <p className="text-[11px] font-semibold tracking-wide text-stone-400 uppercase">
                    {categoryLabel}
                  </p>
                )}
                <StatusPill status={status} />
                {isItemPrivate(item.details) ? <PrivateItemPill /> : null}
                <BookingStatusPill status={stayDetails?.bookingStatus} />
                <BookingStatusPill status={carDetails?.bookingStatus} />
                {linkedItemId && <LinkedPill />}
                {subItems.length > 0 && (
                  <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold text-brand-deep uppercase">
                    {subItems.length} sub-item{subItems.length === 1 ? "" : "s"}
                  </span>
                )}
                {completed && <ItemDoneBadge accent={doneAccent} />}
                {category === "flight" && <FlightCheckInReminderPill item={item} />}
                {flightCheckedIn && <FlightCheckInBadge />}
                <ItemTaskIndicator summary={taskSummary} />
              </div>
              <h3
                className={[
                  "mt-0.5 break-words font-medium group-hover:text-brand-deep",
                  completed
                    ? doneAccent === "amber"
                      ? "text-stone-500 line-through decoration-amber-600/40"
                      : "text-stone-500 line-through decoration-emerald-600/40"
                    : "text-stone-900",
                ].join(" ")}
              >
                {item.title}
              </h3>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {itemMapLink ? (
                <ItemMapLink href={itemMapLink.href} label={itemMapLink.label} />
              ) : null}
              <ChevronRight className="mt-1 h-4 w-4 text-stone-300 group-hover:text-accent" />
            </div>
          </div>

          {category === "flight" && flightRoute ? (
            <p className="mt-1 text-xs font-semibold tracking-wide text-stone-600">
              {flightRoute}
            </p>
          ) : null}

          {flightSummaryExtras.length > 0 ? (
            <div className="mt-1 space-y-0.5 text-sm text-stone-500">
              {flightSummaryExtras.map((part, index) => (
                <p key={`${index}-${part}`} className="break-words">
                  {part}
                </p>
              ))}
            </div>
          ) : accommodationLines.length > 0 ? (
            <div className="mt-1 space-y-0.5 text-sm text-stone-500">
              {accommodationLines.map((line, index) => (
                <p key={`${index}-${line}`} className="break-words">
                  {line}
                </p>
              ))}
            </div>
          ) : accommodationSummary ? (
            <p className="mt-1 break-words text-sm text-stone-500">
              {accommodationSummary}
            </p>
          ) : item.summary && category !== "flight" ? (
            <p className="mt-1 break-words text-sm text-stone-500">{item.summary}</p>
          ) : null}

          {category !== "flight" &&
            category !== "accommodation" &&
            itemLocation?.name &&
            !itemMapLink && (
            <p className="mt-1 text-sm text-stone-600">{itemLocation.name}</p>
          )}

          {displayTime &&
            category !== "flight" &&
            category !== "accommodation" &&
            (viewMode === "condensed" || category === "activity") && (
            <p className="mt-2 text-xs text-stone-400">{displayTime}</p>
          )}

          {category === "flight" && flightSchedule && (
            <div className="mt-2 space-y-0.5 text-xs text-stone-500">
              {flightSchedule.departure && (
                <p>
                  <span className="font-medium text-stone-400">Departs </span>
                  {flightSchedule.departure}
                </p>
              )}
              {flightSchedule.arrival && (
                <p>
                  <span className="font-medium text-stone-400">Arrives </span>
                  {flightSchedule.arrival}
                </p>
              )}
              {viewMode === "condensed" &&
                flightTimeline?.transitStops.map((stop) => {
                const layover = formatFlightProgressDuration(stop.layoverMinutes);
                if (!layover) return null;
                return (
                  <p key={stop.airport}>
                    <span className="font-medium text-amber-700/80">Transit </span>
                    <span className="text-amber-800">
                      {stop.airport} · {layover}
                    </span>
                  </p>
                );
              })}
            </div>
          )}

          {category === "flight" && <FlightProgressBar item={item} />}

          {viewMode === "condensed" &&
            category !== "activity" &&
            category !== "flight" &&
            category !== "accommodation" &&
            item.startDatetime && (
              <p className="mt-2 text-xs text-stone-400">
                {formatDateTime(item.startDatetime)}
              </p>
            )}

          {showFlightDetails && (
            <FlightDetailedPreview
              item={item}
              details={flightDetails}
              formatBaggage={formatBaggage}
            />
          )}

          {viewMode === "detailed" && category === "accommodation" && stayDetails && (
            <div className="mt-3 space-y-1 border-t border-stone-100 pt-3">
              {(stayDetails.checkInDate || stayDetails.checkInTime) && (
                <InlineDetail
                  label="Check-in"
                  value={formatStayDateTime(
                    stayDetails.checkInDate,
                    stayDetails.checkInTime,
                  )}
                />
              )}
              {stayDetails.checkOutDate && (
                <InlineDetail
                  label="Check-out"
                  value={formatStayDateTime(
                    stayDetails.checkOutDate,
                    stayDetails.checkOutTime,
                  )}
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

          {viewMode === "detailed" && category === "car_rental" && carDetails && (
            <div className="mt-3 space-y-1 border-t border-stone-100 pt-3">
              <InlineDetail
                label="Pickup"
                value={
                  carDetails.pickupTime
                    ? formatClockTime(carDetails.pickupTime)
                    : null
                }
              />
              <InlineDetail label="Location" value={carDetails.pickupLocation} />
              {carDetails.returnTime && (
                <InlineDetail
                  label="Return"
                  value={formatClockTime(carDetails.returnTime)}
                />
              )}
            </div>
          )}
        </div>
        </button>

        <div className="flex shrink-0 items-center gap-1.5 self-start pt-0.5">
          {category === "flight" && (
            <FlightCheckInToggle item={item} compact />
          )}
          <ItemCompleteToggle item={item} compact accent={doneAccent} />
        </div>
      </div>

      {viewMode === "detailed" &&
        category === "activity" &&
        linkedItemId != null && (
          <div className="pr-4 pb-4 pl-[4.5rem]">
            <LinkedBookingCardPreview linkedItemId={linkedItemId} />
          </div>
        )}

      <SubItemCascade
        subItems={subItems}
        onSubItemClick={(id) => openItem(id)}
      />
    </div>
  );
}
