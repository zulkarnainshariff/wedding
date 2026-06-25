"use client";

import Link from "next/link";
import { ArrowLeft, ExternalLink, MapPin, Pencil, Trash2, X } from "lucide-react";
import { ItemDocumentsSection } from "@/components/itinerary/ItemDocumentsSection";
import { ItemSubItemsSection } from "@/components/itinerary/ItemSubItemsSection";
import { ItemCompleteToggle } from "@/components/itinerary/ItemCompleteToggle";
import { ItemTaskSection } from "@/components/tasks/ItemTaskSection";
import {
  FlightDetailView,
  PetRelocationDetailView,
} from "@/components/itinerary/FlightViews";
import { CATEGORY_STYLES, getCategoryIcon } from "@/lib/category-ui";
import { ACTIVITY_TYPE_LABELS } from "@/lib/activity-utils";
import { getItemLocation } from "@/lib/item-location";
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
      className="inline-flex items-center gap-2 rounded-xl border border-[#1e3a5f]/20 bg-[#1e3a5f] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#16304f]"
    >
      <MapPin className="h-4 w-4" />
      {label}
      <ExternalLink className="h-3.5 w-3.5 opacity-70" />
    </a>
  );
}

function AccommodationDetail({
  details,
}: {
  details: NonNullable<ReturnType<typeof getAccommodationDetails>>;
}) {
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
          value={
            details.checkInDate
              ? `${details.checkInDate} at ${details.checkInTime}`
              : undefined
          }
        />
        <DetailRow
          label="Check-out"
          value={
            details.checkOutDate
              ? `${details.checkOutDate} at ${details.checkOutTime}`
              : undefined
          }
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

      {details.notes && details.notes.length > 0 && (
        <div className="border-t border-stone-100 py-4">
          <h3 className="text-sm font-semibold tracking-wide text-stone-500 uppercase">
            Notes
          </h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-stone-700">
            {details.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function CarRentalDetail({
  details,
}: {
  details: NonNullable<ReturnType<typeof getCarRentalDetails>>;
}) {
  const notes = Array.isArray(details.notes)
    ? details.notes.join("; ")
    : details.notes;

  return (
    <div className="space-y-6">
      {details.bookingStatus === "suggested" && (
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
        <DetailRow label="Notes" value={notes} />
      </dl>
      <div className="flex flex-wrap gap-3">
        <MapLink
          label="Pickup on Maps"
          href={
            details.mapUrl ??
            mapsUrl(details.pickupLocation, details.pickupLat, details.pickupLng)
          }
        />
        {(details.returnMapUrl || details.returnLocation !== details.pickupLocation) && (
          <MapLink
            label="Return on Maps"
            href={
              details.returnMapUrl ??
              mapsUrl(details.returnLocation, details.returnLat, details.returnLng)
            }
          />
        )}
      </div>
    </div>
  );
}

function ActivityDetail({
  details,
}: {
  details: NonNullable<ReturnType<typeof getActivityDetails>>;
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
      {details.linkedItemId && (
        <p className="text-sm text-stone-500">
          Tap this schedule item from the timeline to open the linked booking
          details.
        </p>
      )}
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

function ItemDetailHeader({
  item,
  category,
  activityType,
  styles,
  Icon,
  sharedLocation,
  formatDateTime,
  formatFlightSchedule,
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
  onEdit?: () => void;
  onDelete?: () => void;
  onClose?: () => void;
}) {
  const flightSchedule =
    category === "flight" ? formatFlightSchedule(item) : null;

  const categoryLabel =
    category === "activity" && activityType === "sub_item"
      ? "Sub-itinerary"
      : CATEGORY_META[category as Category]?.label;

  return (
    <>
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
            <p className="text-xs font-semibold tracking-wide text-stone-400 uppercase">
              {categoryLabel}
            </p>
            <h1 className="mt-1 break-words font-serif text-xl text-[#1e3a5f] sm:text-3xl">
              {item.title}
            </h1>
            {item.summary && category === "flight" ? (
              <div className="mt-2 space-y-0.5 text-sm text-stone-500">
                {item.summary.split(" · ").map((part, index) => (
                  <p key={`${index}-${part}`} className="break-words">
                    {part}
                  </p>
                ))}
              </div>
            ) : item.summary ? (
              <p className="mt-2 break-words text-stone-500">{item.summary}</p>
            ) : null}
            {sharedLocation?.name && (
              <p className="mt-2 break-words text-sm">
                {sharedLocation.mapLink ? (
                  <MapLink label={sharedLocation.name} href={sharedLocation.mapLink} />
                ) : (
                  <span className="text-stone-600">{sharedLocation.name}</span>
                )}
              </p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 self-stretch sm:self-start">
          <ItemCompleteToggle item={item} />
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-700 hover:border-[#1e3a5f]/30 hover:text-[#1e3a5f]"
            >
              <Pencil className="h-4 w-4" />
              <span className="hidden sm:inline">Edit</span>
            </button>
          )}
          {onDelete && (
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
      </div>

      <div className="mt-5 flex flex-wrap gap-4 text-sm text-stone-500">
        {category === "flight" ? (
          <>
            {flightSchedule?.departure && (
              <span>Departs: {flightSchedule.departure}</span>
            )}
            {flightSchedule?.arrival && (
              <span>Arrives: {flightSchedule.arrival}</span>
            )}
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
}: {
  item: ItineraryItem;
  category: string;
  flightDetails: ReturnType<typeof getFlightDetails>;
  petDetails: ReturnType<typeof getPetRelocationDetails>;
  stayDetails: ReturnType<typeof getAccommodationDetails>;
  carDetails: ReturnType<typeof getCarRentalDetails>;
  activityDetails: ReturnType<typeof getActivityDetails>;
}) {
  return (
    <>
      {category === "flight" && flightDetails && (
        <FlightDetailView details={flightDetails} itemId={item.id} />
      )}
      {category === "pet_relocation" && petDetails && (
        <PetRelocationDetailView details={petDetails} />
      )}
      {category === "accommodation" && stayDetails && (
        <AccommodationDetail details={stayDetails} />
      )}
      {category === "car_rental" && carDetails && (
        <CarRentalDetail details={carDetails} />
      )}
      {category === "activity" && activityDetails && (
        <ActivityDetail details={activityDetails} />
      )}
      {category === "travel_insurance" && (
        <InsuranceDetail details={item.details as TravelInsuranceDetails} />
      )}
      {!item.parentItemId && <ItemSubItemsSection item={item} />}
      {!item.parentItemId && <ItemDocumentsSection item={item} />}
      <ItemTaskSection item={item} />
    </>
  );
}

export function ItemDetailView({
  item,
  modal = false,
  onClose,
  onEdit,
  onDelete,
}: {
  item: ItineraryItem;
  modal?: boolean;
  onClose?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const category = isCategory(item.category) ? item.category : "flight";
  const styles = CATEGORY_STYLES[category];
  const Icon = getCategoryIcon(category);
  const flightDetails = getFlightDetails(item.details);
  const petDetails = getPetRelocationDetails(item.details);
  const stayDetails = getAccommodationDetails(item.details);
  const carDetails = getCarRentalDetails(item.details);
  const activityDetails = getActivityDetails(item.details);
  const sharedLocation = getItemLocation(item.details as Record<string, unknown>);
  const { formatDateTime, formatFlightSchedule } = useDisplayFormat();

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
      onEdit={onEdit}
      onDelete={onDelete}
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
    />
  );

  if (modal) {
    return (
      <div className="flex max-h-[92vh] flex-col overflow-hidden rounded-t-3xl border border-stone-200 bg-white shadow-xl sm:rounded-3xl">
        <div className="shrink-0 border-b border-stone-100 bg-gradient-to-r from-[#faf8f5] to-white px-6 py-6 sm:px-8">
          {header}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4 pb-8 sm:px-8">
          {body}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href={`/itinerary/${category}`}
        className="mb-6 inline-flex items-center gap-2 text-sm text-stone-500 hover:text-[#1e3a5f]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to {CATEGORY_META[category as Category]?.plural ?? "itinerary"}
      </Link>

      <div className="overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm">
        <div className="border-b border-stone-100 bg-gradient-to-r from-[#faf8f5] to-white px-6 py-6 sm:px-8">
          {header}
        </div>
        <div className="px-6 py-2 pb-8 sm:px-8">{body}</div>
      </div>
    </div>
  );
}
