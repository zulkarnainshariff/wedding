"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink, MapPin, Pencil, Trash2, X } from "lucide-react";
import { ItemDocumentsSection } from "@/components/itinerary/ItemDocumentsSection";
import { ItemSubItemsSection } from "@/components/itinerary/ItemSubItemsSection";
import { ItemCompleteToggle, type ItemDoneAccent } from "@/components/itinerary/ItemCompleteToggle";
import { FlightCheckInReminderPill, FlightCheckInToggle } from "@/components/itinerary/FlightCheckInToggle";
import {
  flightRouteLine,
  flightSummaryExtraParts,
  getFlightTimelineDisplay,
  isFlightInProgress,
} from "@/lib/flight-progress";
import { ItemTaskSection } from "@/components/tasks/ItemTaskSection";
import {
  ItemDocumentIndicator,
  useDocumentIndicators,
} from "@/components/itinerary/useDocumentIndicators";
import {
  FlightDetailView,
  PetRelocationDetailView,
} from "@/components/itinerary/FlightViews";
import {
  AccommodationDetailView,
  CarRentalDetailView,
} from "@/components/itinerary/BookingDetailViews";
import { LinkedBookingDetailSection } from "@/components/itinerary/LinkedBookingViews";
import { useLinkedItem } from "@/hooks/useLinkedItem";
import { CATEGORY_STYLES, getCategoryIcon } from "@/lib/category-ui";
import { ACTIVITY_TYPE_LABELS } from "@/lib/activity-utils";
import { getItemLocation } from "@/lib/item-location";
import { extractItemAdditionalViewers } from "@/lib/item-viewers";
import { useDisplayFormat } from "@/hooks/useDisplayFormat";
import {
  CATEGORY_META,
  getAccommodationDetails,
  getActivityDetails,
  getCarRentalDetails,
  getFlightDetails,
  getPetRelocationDetails,
  isCategory,
  mapsUrl,
  type Category,
  type TravelInsuranceDetails,
} from "@/lib/types";
import { formatJourneyFlightLabel } from "@/lib/flight-numbers";
import type { ItineraryItemWithSubItems } from "@/lib/item-subitem-utils";
import type { ItineraryItem } from "@/lib/schema";

function NotesBlock({
  title = "Notes",
  notes,
}: {
  title?: string;
  notes?: string[] | string | null;
}) {
  const lines = Array.isArray(notes)
    ? notes
    : notes
      ? notes.split("\n").map((line) => line.trim()).filter(Boolean)
      : [];
  if (lines.length === 0) return null;

  return (
    <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3">
      <h3 className="text-sm font-semibold tracking-wide text-stone-500 uppercase">
        {title}
      </h3>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-stone-700">
        {lines.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
    </div>
  );
}

function DescriptionBlock({ description }: { description?: string | null }) {
  if (!description?.trim()) return null;
  return (
    <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 px-4 py-3">
      <h3 className="text-sm font-semibold tracking-wide text-indigo-800 uppercase">
        Details
      </h3>
      <p className="mt-2 whitespace-pre-wrap text-sm text-stone-700">
        {description}
      </p>
    </div>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  if (!value) return null;
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

function AdditionalViewersRow({ details }: { details: unknown }) {
  const viewers = extractItemAdditionalViewers(details);
  if (viewers.length === 0) return null;

  return (
    <dl>
      <DetailRow label="Also visible to" value={viewers.join(", ")} />
    </dl>
  );
}

function ActivityDetail({
  details,
  linkedItem,
  canEdit,
}: {
  details: NonNullable<ReturnType<typeof getActivityDetails>>;
  linkedItem?: ItineraryItem | null;
  canEdit?: boolean;
}) {
  const mapHref =
    details.location?.mapLink ??
    (details.location?.plusCode
      ? mapsUrl(details.location.plusCode)
      : details.location?.name
        ? mapsUrl(details.location.name)
        : undefined);

  return (
    <div className="space-y-4">
      <DescriptionBlock description={details.description} />
      <NotesBlock notes={details.notes} />
      <dl>
        <DetailRow
          label="Type"
          value={ACTIVITY_TYPE_LABELS[details.activityType] ?? details.activityType}
        />
        <DetailRow label="Time" value={details.time ?? undefined} />
        <DetailRow
          label="Participants"
          value={details.participants?.join(", ")}
        />
        <DetailRow label="Location" value={details.location?.name} />
        <DetailRow label="Airport" value={details.location?.airportCode} />
      </dl>
      {mapHref && <MapLink label="Open in Google Maps" href={mapHref} />}
      {linkedItem ? (
        <LinkedBookingDetailSection linkedItem={linkedItem} canEdit={canEdit} />
      ) : details.linkedItemId ? (
        <p className="text-sm text-stone-500">Loading linked booking…</p>
      ) : null}
    </div>
  );
}

function InsuranceDetail({ details }: { details: TravelInsuranceDetails }) {
  const notesText = Array.isArray(details.notes)
    ? details.notes.join("\n")
    : details.notes;

  return (
    <div className="space-y-4">
      <dl>
        <DetailRow label="Provider" value={details.provider} />
        <DetailRow label="Policy number" value={details.policyNumber} />
        <DetailRow label="Coverage" value={details.coverage} />
        <DetailRow label="Policy period" value={
          details.policyStartDate || details.policyEndDate
            ? [details.policyStartDate, details.policyEndDate].filter(Boolean).join(" – ")
            : undefined
        } />
        <DetailRow
          label="Countries"
          value={
            details.countries?.length
              ? details.countries.join(", ")
              : undefined
          }
        />
        <DetailRow
          label="Travellers"
          value={
            details.travellers?.length
              ? details.travellers.join(", ")
              : undefined
          }
        />
        <DetailRow label="Emergency" value={details.emergencyPhone} />
        <DetailRow label="Notes" value={notesText} />
      </dl>
      {details.autoInsuranceIncluded && (
        <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3">
          <p className="text-sm font-medium text-stone-700">Auto insurance included</p>
          {details.autoInsuranceDetails && (
            <p className="mt-1 text-sm text-stone-600">{details.autoInsuranceDetails}</p>
          )}
        </div>
      )}
      {details.documentUrl && (
        <a
          href={details.documentUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm font-medium text-violet-800 hover:bg-violet-100"
        >
          View policy document
          <ExternalLink className="h-4 w-4" />
        </a>
      )}
    </div>
  );
}

function ModalHeaderIconButton({
  onClick,
  ariaLabel,
  children,
  className = "",
}: {
  onClick: () => void;
  ariaLabel: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={[
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-stone-200 bg-white text-stone-500 transition-all hover:border-brand-deep/30 hover:text-brand-deep",
        className,
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function ItemDetailHeader({
  item,
  category,
  activityType,
  styles,
  Icon,
  sharedLocation,
  formatDateTime,
  formatFlightSchedule,
  documentCount,
  modal = false,
  onEdit,
  onDelete,
  onClose,
}: {
  item: ItineraryItem;
  category: string;
  activityType?: string | null;
  styles: { bg: string; text: string };
  Icon: React.ComponentType<{ className?: string }>;
  sharedLocation: ReturnType<typeof getItemLocation>;
  formatDateTime: (value: string | Date) => string;
  formatFlightSchedule: (item: ItineraryItem) => {
    departure: string | null;
    arrival: string | null;
  };
  documentCount?: number;
  modal?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onClose?: () => void;
}) {
  const flightSchedule =
    category === "flight" ? formatFlightSchedule(item) : null;
  const showLocation = category !== "flight" && sharedLocation?.name;
  const flightDetails = category === "flight" ? getFlightDetails(item.details) : null;
  const flightNumberLabel = flightDetails
    ? formatJourneyFlightLabel(flightDetails)
    : null;
  const flightTimeline =
    category === "flight" ? getFlightTimelineDisplay(item) : null;
  const flightRoute =
    category === "flight" ? flightRouteLine(flightTimeline, item.summary) : null;
  const flightSummaryExtras =
    category === "flight" ? flightSummaryExtraParts(item.summary, flightRoute) : [];
  const [flightInProgress, setFlightInProgress] = useState(() =>
    category === "flight" ? isFlightInProgress(item) : false,
  );

  useEffect(() => {
    if (category !== "flight") return;
    const tick = () => setFlightInProgress(isFlightInProgress(item));
    tick();
    const interval = window.setInterval(tick, 30_000);
    return () => window.clearInterval(interval);
  }, [item, category]);

  const doneAccent: ItemDoneAccent = flightInProgress ? "amber" : "emerald";

  const categoryLabel =
    category === "activity" && activityType === "sub_item"
      ? "Sub-itinerary"
      : CATEGORY_META[category as Category]?.label;

  const mobileModalActions = modal ? (
      <div className="flex shrink-0 items-center gap-1.5">
        {category === "flight" && <FlightCheckInToggle item={item} compact />}
        <ItemCompleteToggle item={item} accent={doneAccent} compact />
        {onEdit && (
          <ModalHeaderIconButton onClick={onEdit} ariaLabel="Edit">
            <Pencil className="h-4 w-4" />
          </ModalHeaderIconButton>
        )}
        {onClose && (
          <ModalHeaderIconButton onClick={onClose} ariaLabel="Close">
            <X className="h-4 w-4" />
          </ModalHeaderIconButton>
        )}
      </div>
    ) : null;

  const desktopActions = (
    <div
      className={[
        "flex shrink-0 flex-wrap items-center justify-end gap-2 self-stretch sm:self-start",
        modal ? "hidden sm:flex" : "",
      ].join(" ")}
    >
      {category === "flight" && <FlightCheckInToggle item={item} />}
      <ItemCompleteToggle item={item} accent={doneAccent} />
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-700 hover:border-brand-deep/30 hover:text-brand-deep"
        >
          <Pencil className="h-4 w-4" />
          <span className="hidden sm:inline">Edit</span>
        </button>
      )}
      {!modal && onDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
        >
          <Trash2 className="h-4 w-4" />
          <span className="hidden sm:inline">Delete</span>
        </button>
      )}
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-stone-200 bg-white p-2 text-stone-500 shadow-sm hover:bg-stone-50"
          aria-label="Close details"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );

  return (
    <>
      {modal ? (
        <div className="mb-3 flex items-center justify-between gap-3 sm:hidden">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <p className="truncate text-xs font-semibold tracking-wide text-stone-400 uppercase">
              {categoryLabel}
            </p>
            {category === "flight" && <FlightCheckInReminderPill item={item} />}
          </div>
          {mobileModalActions}
        </div>
      ) : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-1 items-start gap-3 sm:gap-4">
          <div
            className={[
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl sm:h-14 sm:w-14",
              styles.bg,
              styles.text,
            ].join(" ")}
          >
            <Icon className="h-6 w-6 sm:h-7 sm:w-7" />
          </div>
          <div className="min-w-0 flex-1">
            <p
              className={[
                "text-xs font-semibold tracking-wide text-stone-400 uppercase",
                modal ? "hidden sm:block" : "",
              ].join(" ")}
            >
              {categoryLabel}
            </p>
            {category === "flight" && (
              <div className="mt-2 hidden flex-wrap items-center gap-2 sm:flex">
                <FlightCheckInReminderPill item={item} />
              </div>
            )}
            <h1 className="mt-1 break-words font-serif text-xl text-brand-deep sm:text-3xl">
              {item.title}
            </h1>
            {documentCount ? (
              <div className="mt-2">
                <ItemDocumentIndicator count={documentCount} />
              </div>
            ) : null}
            {category === "flight" && flightNumberLabel && (
              <p className="mt-1 text-sm font-medium text-sky-800">
                {flightNumberLabel}
              </p>
            )}
            {category === "flight" && flightRoute && (
              <p className="mt-1 text-sm font-semibold tracking-wide text-stone-600">
                {flightRoute}
              </p>
            )}
            {flightSummaryExtras.length > 0 ? (
              <div className="mt-2 space-y-0.5 text-sm text-stone-500">
                {flightSummaryExtras.map((part, index) => (
                  <p key={`${index}-${part}`} className="break-words">
                    {part}
                  </p>
                ))}
              </div>
            ) : item.summary && category !== "flight" ? (
              <p className="mt-2 break-words text-stone-500">{item.summary}</p>
            ) : null}
            {showLocation && (
              <p className="mt-2 break-words text-sm">
                {sharedLocation.mapLink ? (
                  <MapLink label={sharedLocation.name!} href={sharedLocation.mapLink} />
                ) : (
                  <span className="text-stone-600">{sharedLocation.name}</span>
                )}
              </p>
            )}
          </div>
        </div>
        {desktopActions}
      </div>

      <div className="mt-5 flex flex-col gap-1 text-sm text-stone-500">
        {category === "flight" ? (
          <>
            <div className="flex flex-wrap gap-4">
              {flightSchedule?.departure && (
                <span>Departs: {flightSchedule.departure}</span>
              )}
              {flightSchedule?.arrival && (
                <span>Arrives: {flightSchedule.arrival}</span>
              )}
            </div>
          </>
        ) : (
          <>
            {item.startDatetime && (
              <span>Starts: {formatDateTime(item.startDatetime)}</span>
            )}
            {item.endDatetime && (
              <span>Ends: {formatDateTime(item.endDatetime)}</span>
            )}
          </>
        )}
      </div>
    </>
  );
}

function ItemDetailBody({
  item,
  category,
  flightDetails,
  petDetails,
  stayDetails,
  carDetails,
  activityDetails,
  linkedItem,
  canEdit,
  limitedView = false,
}: {
  item: ItineraryItem;
  category: string;
  flightDetails: ReturnType<typeof getFlightDetails>;
  petDetails: ReturnType<typeof getPetRelocationDetails>;
  stayDetails: ReturnType<typeof getAccommodationDetails>;
  carDetails: ReturnType<typeof getCarRentalDetails>;
  activityDetails: ReturnType<typeof getActivityDetails>;
  linkedItem?: ItineraryItem | null;
  canEdit: boolean;
  limitedView?: boolean;
}) {
  if (limitedView) {
    return (
      <>
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Limited view — you can see sub-items you are linked to, but not the
          full details of this schedule entry.
        </p>
        <ItemSubItemsSection item={item} />
      </>
    );
  }

  return (
    <>
      {category === "flight" && flightDetails && (
        <FlightDetailView
          details={flightDetails}
          item={item}
          itemId={item.id}
          canEdit={canEdit}
        />
      )}
      {category === "pet_relocation" && petDetails && (
        <PetRelocationDetailView details={petDetails} />
      )}
      {category === "accommodation" && stayDetails && (
        <AccommodationDetailView details={stayDetails} />
      )}
      {category === "car_rental" && carDetails && (
        <CarRentalDetailView details={carDetails} />
      )}
      {category === "activity" && activityDetails && (
        <ActivityDetail
          details={activityDetails}
          linkedItem={linkedItem}
          canEdit={canEdit}
        />
      )}
      {category === "travel_insurance" && (
        <InsuranceDetail details={item.details as TravelInsuranceDetails} />
      )}
      <AdditionalViewersRow details={item.details} />
      {!item.parentItemId && <ItemSubItemsSection item={item} />}
      {!item.parentItemId && <ItemDocumentsSection item={item} />}
      <ItemTaskSection item={item} />
    </>
  );
}

function ItemDetailModalFooter({
  onDelete,
  onClose,
}: {
  onDelete?: () => void;
  onClose?: () => void;
}) {
  if (!onDelete && !onClose) return null;

  return (
    <div className="shrink-0 border-t border-stone-100 px-6 py-4 sm:px-8">
      <div className="flex items-center justify-between gap-3">
        {onDelete ? (
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
        ) : (
          <span />
        )}
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-medium text-stone-600 hover:bg-stone-50"
          >
            <X className="h-4 w-4" />
            Close
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function ItemDetailView({
  item,
  modal = false,
  onClose,
  onEdit,
  onDelete,
  canEdit = false,
}: {
  item: ItineraryItem;
  modal?: boolean;
  onClose?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  canEdit?: boolean;
}) {
  const category = isCategory(item.category) ? item.category : "flight";
  const styles = CATEGORY_STYLES[category];
  const Icon = getCategoryIcon(category);
  const flightDetails = getFlightDetails(item.details);
  const petDetails = getPetRelocationDetails(item.details);
  const stayDetails = getAccommodationDetails(item.details);
  const carDetails = getCarRentalDetails(item.details);
  const activityDetails = getActivityDetails(item.details);
  const { linkedItem } = useLinkedItem(activityDetails?.linkedItemId);
  const sharedLocation = getItemLocation(item.details as Record<string, unknown>);
  const { formatDateTime, formatFlightSchedule } = useDisplayFormat();
  const documentCounts = useDocumentIndicators();
  const limitedView = Boolean((item as ItineraryItemWithSubItems).limitedView);

  const header = (
    <ItemDetailHeader
      item={item}
      category={category}
      activityType={activityDetails?.activityType}
      styles={styles}
      Icon={Icon}
      sharedLocation={sharedLocation}
      formatDateTime={formatDateTime}
      formatFlightSchedule={formatFlightSchedule}
      documentCount={documentCounts[item.id]}
      modal={modal}
      onEdit={onEdit}
      onDelete={modal ? undefined : onDelete}
      onClose={modal ? onClose : undefined}
    />
  );

  const body = (
    <ItemDetailBody
      item={item}
      category={category}
      flightDetails={flightDetails}
      petDetails={petDetails}
      stayDetails={stayDetails}
      carDetails={carDetails}
      activityDetails={activityDetails}
      linkedItem={linkedItem}
      canEdit={canEdit}
      limitedView={limitedView}
    />
  );

  if (modal) {
    return (
      <div className="flex max-h-[92vh] flex-col overflow-hidden rounded-t-3xl border border-stone-200 bg-white shadow-xl sm:rounded-3xl">
        <div className="shrink-0 border-b border-stone-100 bg-gradient-to-r from-surface-soft to-white px-6 py-6 sm:px-8">
          {header}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4 sm:px-8 sm:pb-8">
          {body}
        </div>
        <ItemDetailModalFooter onDelete={onDelete} onClose={onClose} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href={`/itinerary/${category}`}
        className="mb-6 inline-flex items-center gap-2 text-sm text-stone-500 hover:text-brand-deep"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to {CATEGORY_META[category as Category]?.plural ?? "itinerary"}
      </Link>

      <div className="overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm">
        <div className="border-b border-stone-100 bg-gradient-to-r from-surface-soft to-white px-6 py-6 sm:px-8">
          {header}
        </div>
        <div className="px-6 py-2 pb-8 sm:px-8">{body}</div>
      </div>
    </div>
  );
}
