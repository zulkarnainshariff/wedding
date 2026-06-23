import Link from "next/link";
import {
  ArrowLeft,
  ExternalLink,
  MapPin,
} from "lucide-react";
import { CATEGORY_STYLES, getCategoryIcon } from "@/lib/category-ui";
import {
  CATEGORY_META,
  formatDateTime,
  isCategory,
  mapsUrl,
  type AccommodationDetails,
  type CarRentalDetails,
  type Category,
  type FlightDetails,
  type TravelInsuranceDetails,
} from "@/lib/types";
import type { ItineraryItem } from "@/lib/schema";

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

function MapButton({
  label,
  address,
  lat,
  lng,
}: {
  label: string;
  address: string;
  lat?: number;
  lng?: number;
}) {
  return (
    <a
      href={mapsUrl(address, lat, lng)}
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

function FlightDetail({ details }: { details: FlightDetails }) {
  return (
    <dl>
      <DetailRow label="Airline" value={details.airline} />
      <DetailRow label="Flight" value={details.flightNumber} />
      <DetailRow label="From" value={details.departureAirport} />
      <DetailRow label="To" value={details.arrivalAirport} />
      <DetailRow label="Departure" value={details.departureTime} />
      <DetailRow label="Arrival" value={details.arrivalTime} />
      <DetailRow label="Terminal" value={details.terminal} />
      <DetailRow label="Seats" value={details.seat} />
      <DetailRow label="Confirmation" value={details.confirmationCode} />
      <DetailRow label="Notes" value={details.notes} />
    </dl>
  );
}

function AccommodationDetail({ details }: { details: AccommodationDetails }) {
  return (
    <div className="space-y-4">
      <dl>
        <DetailRow label="Platform" value={details.platform} />
        <DetailRow label="Address" value={details.address} />
        <DetailRow label="Check-in" value={details.checkInTime} />
        <DetailRow label="Check-out" value={details.checkOutTime} />
        <DetailRow label="Host" value={details.hostName} />
        <DetailRow label="Confirmation" value={details.confirmationCode} />
        <DetailRow label="Notes" value={details.notes} />
      </dl>

      <div className="flex flex-wrap gap-3">
        {details.listingUrl && (
          <a
            href={details.listingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-800 hover:bg-emerald-100"
          >
            View on {details.platform}
            <ExternalLink className="h-4 w-4" />
          </a>
        )}
        <MapButton
          label="Open in Google Maps"
          address={details.address}
          lat={details.lat}
          lng={details.lng}
        />
      </div>
    </div>
  );
}

function CarRentalDetail({ details }: { details: CarRentalDetails }) {
  return (
    <div className="space-y-6">
      <dl>
        <DetailRow label="Company" value={details.company} />
        <DetailRow label="Vehicle" value={details.vehicleModel} />
        <DetailRow label="Pickup time" value={details.pickupTime} />
        <DetailRow label="Pickup location" value={details.pickupLocation} />
        <DetailRow label="Return time" value={details.returnTime} />
        <DetailRow label="Return location" value={details.returnLocation} />
        <DetailRow label="Confirmation" value={details.confirmationCode} />
        <DetailRow label="Notes" value={details.notes} />
      </dl>

      <div className="grid gap-3 sm:grid-cols-2">
        <MapButton
          label="Pickup on Maps"
          address={details.pickupLocation}
          lat={details.pickupLat}
          lng={details.pickupLng}
        />
        <MapButton
          label="Return on Maps"
          address={details.returnLocation}
          lat={details.returnLat}
          lng={details.returnLng}
        />
      </div>
    </div>
  );
}

function InsuranceDetail({ details }: { details: TravelInsuranceDetails }) {
  return (
    <div className="space-y-4">
      <dl>
        <DetailRow label="Provider" value={details.provider} />
        <DetailRow label="Policy number" value={details.policyNumber} />
        <DetailRow label="Coverage" value={details.coverage} />
        <DetailRow label="Emergency" value={details.emergencyPhone} />
        <DetailRow label="Notes" value={details.notes} />
      </dl>
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

export function ItemDetailView({ item }: { item: ItineraryItem }) {
  const category = isCategory(item.category) ? item.category : "flight";
  const styles = CATEGORY_STYLES[category];
  const Icon = getCategoryIcon(category);
  const details = item.details as Record<string, unknown>;

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href={category ? `/itinerary/${category}` : "/itinerary"}
        className="mb-6 inline-flex items-center gap-2 text-sm text-stone-500 hover:text-[#1e3a5f]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to {CATEGORY_META[category as Category]?.plural ?? "itinerary"}
      </Link>

      <div className="overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm">
        <div className="border-b border-stone-100 bg-gradient-to-r from-[#faf8f5] to-white px-6 py-6 sm:px-8">
          <div className="flex items-start gap-4">
            <div
              className={[
                "flex h-14 w-14 items-center justify-center rounded-2xl",
                styles.bg,
                styles.text,
              ].join(" ")}
            >
              <Icon className="h-7 w-7" />
            </div>
            <div>
              <p className="text-xs font-semibold tracking-wide text-stone-400 uppercase">
                {CATEGORY_META[category as Category]?.label}
              </p>
              <h1 className="mt-1 font-serif text-2xl text-[#1e3a5f] sm:text-3xl">
                {item.title}
              </h1>
              {item.summary && (
                <p className="mt-2 text-stone-500">{item.summary}</p>
              )}
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-4 text-sm text-stone-500">
            {item.startDatetime && (
              <span>Starts: {formatDateTime(item.startDatetime)}</span>
            )}
            {item.endDatetime && (
              <span>Ends: {formatDateTime(item.endDatetime)}</span>
            )}
          </div>
        </div>

        <div className="px-6 py-2 sm:px-8">
          {category === "flight" && (
            <FlightDetail details={details as FlightDetails} />
          )}
          {category === "accommodation" && (
            <AccommodationDetail details={details as AccommodationDetails} />
          )}
          {category === "car_rental" && (
            <CarRentalDetail details={details as CarRentalDetails} />
          )}
          {category === "travel_insurance" && (
            <InsuranceDetail details={details as TravelInsuranceDetails} />
          )}
        </div>
      </div>
    </div>
  );
}
