"use client";

import { CheckCircle2 } from "lucide-react";
import type { FlightDetails, PetRelocationDetails } from "@/lib/types";
import { formatTravellerLabel, isCargoFlight } from "@/lib/types";
import { formatBookingGroupsDisplay } from "@/lib/booking-groups";
import { useDisplayFormat } from "@/hooks/useDisplayFormat";
import { useItineraryUI } from "@/components/itinerary/ItineraryUIContext";
import { usePetItemsLinkedToFlight } from "@/hooks/usePetItemsLinkedToFlight";
import { LinkedBookingDetailSection } from "@/components/itinerary/LinkedBookingViews";
import {
  formatFlightSeatsSummary,
  hasFlightAssignedSeats,
  segmentRouteLabel,
  usesPerSegmentSeats,
} from "@/lib/flight-seats";
import { flightSegmentsFromDetails } from "@/lib/flight-segment-timing";
import { normalizeFlightDetails } from "@/lib/flight-numbers";
import { resolveAirlineLabel } from "@/lib/airlines";
import { FlightLiveStatusPanel } from "@/components/itinerary/FlightLiveStatus";
import { formatFlightProgressDuration } from "@/lib/flight-progress";
import {
  buildFlightItinerarySummaries,
  resolveTotalJourneyTimeLabel,
} from "@/lib/flight-itinerary-display";
import { ItemNotesSection } from "@/components/itinerary/FormattedItemNotes";
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

function StatusBadge({ status }: { status: "confirmed" | "tbc" }) {
  if (status === "confirmed") return null;
  return (
    <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
      To be confirmed
    </span>
  );
}

export function FlightItinerarySummary({
  item,
  compact = false,
}: {
  item: ItineraryItem;
  compact?: boolean;
}) {
  const { preferences } = useDisplayFormat();
  const legs = buildFlightItinerarySummaries(item, preferences);
  if (legs.length === 0) return null;

  return (
    <div className={compact ? "space-y-2" : "border-b border-stone-100 py-4"}>
      {!compact ? (
        <h3 className="mb-3 text-sm font-semibold tracking-wide text-stone-500 uppercase">
          Flight details
        </h3>
      ) : null}
      <div className="space-y-3">
        {legs.map((leg, index) => (
          <div key={`leg-${index}`} className="space-y-2">
            <div
              className={[
                "rounded-xl border border-sky-100 bg-gradient-to-br from-sky-50/80 to-white px-3 py-2.5",
                compact ? "text-sm" : "px-4 py-3",
              ].join(" ")}
            >
              {leg.flightNumber ? (
                <p className="text-sm font-semibold text-brand-deep">
                  {leg.flightNumber}
                </p>
              ) : null}
              <p className="mt-1 text-sm leading-relaxed text-stone-800">
                <span className="block sm:inline">{leg.departureLabel}</span>
                <span className="hidden text-stone-400 sm:inline"> · </span>
                <span className="mt-0.5 block sm:mt-0 sm:inline">
                  {leg.arrivalLabel}
                </span>
                {leg.flightTime ? (
                  <>
                    <span className="hidden text-stone-400 sm:inline"> · </span>
                    <span className="mt-0.5 block text-stone-600 sm:mt-0 sm:inline">
                      {leg.flightTime}
                    </span>
                  </>
                ) : null}
              </p>
            </div>
            {leg.transitAirport ? (
              <div className="flex items-center gap-2 px-1">
                <span className="inline-flex flex-wrap items-center gap-x-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-900 max-md:whitespace-nowrap">
                  <span className="tracking-wide uppercase">
                    Transit {leg.transitAirport}
                  </span>
                  {leg.transitLayoverMinutes ? (
                    <>
                      <span className="text-amber-700">·</span>
                      <span className="font-medium normal-case">
                        {formatFlightProgressDuration(leg.transitLayoverMinutes)}
                      </span>
                    </>
                  ) : null}
                </span>
              </div>
            ) : leg.connectionMissing ? (
              <div className="flex items-center gap-2 px-1">
                <span className="inline-flex flex-wrap items-center gap-x-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-[11px] font-semibold text-red-800 max-md:whitespace-nowrap">
                  Missing connecting flight
                </span>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

export function FlightCardScheduleBlock({
  item,
  schedule,
}: {
  item: ItineraryItem;
  schedule: { departure: string | null; arrival: string | null };
}) {
  const totalTime = resolveTotalJourneyTimeLabel(item);

  return (
    <div className="mt-2 space-y-2">
      <FlightItinerarySummary item={item} compact />
      <div className="space-y-0.5 text-xs text-stone-500">
        {totalTime ? (
          <p className="leading-relaxed">
            <span className="font-medium text-stone-400">Total time </span>
            <span className="text-stone-600">{totalTime}</span>
            <span className="text-stone-400"> (incl. transit)</span>
          </p>
        ) : null}
        {schedule.departure ? (
          <p className="leading-relaxed break-words">
            <span className="font-medium text-stone-400">Departs </span>
            {schedule.departure}
          </p>
        ) : null}
        {schedule.arrival ? (
          <p className="leading-relaxed break-words">
            <span className="font-medium text-stone-400">Arrives </span>
            {schedule.arrival}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function BaggageTable({
  baggage,
  cargoParty = [],
}: {
  baggage?: Record<string, number | null>;
  cargoParty?: string[];
}) {
  const { formatBaggage } = useDisplayFormat();
  if (!baggage || Object.keys(baggage).length === 0) return null;
  const cargoSet = new Set(cargoParty);

  return (
    <div className="py-4">
      <h3 className="text-sm font-semibold tracking-wide text-stone-500 uppercase">
        Baggage allowance
      </h3>
      <div className="mt-3 overflow-hidden rounded-xl border border-stone-200">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-left text-stone-500">
            <tr>
              <th className="px-4 py-2 font-medium">Traveller</th>
              <th className="px-4 py-2 font-medium">Allowance</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(baggage).map(([name, kg]) => (
              <tr key={name} className="border-t border-stone-100">
                <td className="px-4 py-2 text-stone-800">
                  {formatTravellerLabel(name, cargoSet.has(name))}
                </td>
                <td className="px-4 py-2 text-stone-600">
                  {cargoSet.has(name) || kg == null
                    ? "N/A (cargo)"
                    : formatBaggage(kg)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function FlightDetailView({
  details,
  item,
  itemId,
  canEdit = false,
}: {
  details: FlightDetails;
  item: ItineraryItem;
  itemId?: number;
  canEdit?: boolean;
}) {
  const flight = normalizeFlightDetails(details);
  const cargoOnly = isCargoFlight(flight);
  const passengers = cargoOnly
    ? []
    : (flight.passengers ??
      flight.travellers.filter((name) => !flight.cargoParty?.includes(name)));
  const bookingRefs = formatBookingGroupsDisplay(
    flight.bookingGroups,
    flight.bookingReferences,
    flight.bookingReference,
  );

  const airlineLabel = resolveAirlineLabel(flight.airlineIata, flight.airlineName);
  const operatingAirlineLabel = resolveAirlineLabel(
    flight.operatingAirlineIata,
    flight.operatingAirlineName,
  );
  const isCodeshare = Boolean(
    flight.marketingFlightNumber &&
      flight.operatingFlightNumber &&
      flight.marketingFlightNumber.trim().toUpperCase() !==
        flight.operatingFlightNumber.trim().toUpperCase(),
  );

  return (
    <div>
      {itemId ? (
        <FlightLiveStatusPanel
          item={item}
          itemId={itemId}
          marketingFlightNumber={flight.marketingFlightNumber}
          operatingFlightNumber={flight.operatingFlightNumber}
          savedDeparture={{
            terminal: flight.departureTerminal,
            gate: flight.departureGate,
          }}
          savedArrival={{
            terminal: flight.arrivalTerminal,
            gate: flight.arrivalGate,
          }}
        />
      ) : null}

      <div className="flex flex-wrap items-center gap-2 border-b border-stone-100 py-3">
        <StatusBadge status={flight.status} />
        {cargoOnly ? (
          <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-800">
            Cargo flight
          </span>
        ) : null}
      </div>

      <dl>
        <DetailRow
          label="Route"
          value={`${flight.from}${flight.fromIata ? ` (${flight.fromIata})` : ""} → ${flight.to}${flight.toIata ? ` (${flight.toIata})` : ""}`}
        />
        <DetailRow label="Day" value={flight.dayOfWeek} />
        <DetailRow label="Airline" value={airlineLabel ?? undefined} />
        {isCodeshare ? (
          <>
            <DetailRow
              label="Operated as"
              value={flight.operatingFlightNumber ?? undefined}
            />
            <DetailRow
              label="Operating airline"
              value={operatingAirlineLabel ?? undefined}
            />
          </>
        ) : null}
        <DetailRow label="Aircraft" value={flight.aircraft} />
        <DetailRow
          label="Dep. terminal"
          value={
            flight.departureTerminal
              ? `${flight.departureTerminal}${flight.departureGate ? ` · Gate ${flight.departureGate}` : ""}`
              : flight.departureGate
                ? `Gate ${flight.departureGate}`
                : undefined
          }
        />
        <DetailRow
          label="Arr. terminal"
          value={
            flight.arrivalTerminal
              ? `${flight.arrivalTerminal}${flight.arrivalGate ? ` · Gate ${flight.arrivalGate}` : ""}`
              : flight.arrivalGate
                ? `Gate ${flight.arrivalGate}`
                : undefined
          }
        />
        <DetailRow
          label="Passengers"
          value={
            cargoOnly
              ? "None (cargo flight)"
              : passengers.map((p) => formatTravellerLabel(p)).join(", ") ||
                undefined
          }
        />
        {flight.cargoParty && flight.cargoParty.length > 0 && (
          <DetailRow
            label="Cargo (not passengers)"
            value={flight.cargoParty
              ?.map((p) => formatTravellerLabel(p, true))
              .join(", ")}
          />
        )}
        {canEdit && (
          <DetailRow label="Booking ref." value={bookingRefs} />
        )}
      </dl>

      <BaggageTable baggage={flight.baggage} cargoParty={flight.cargoParty} />

      <div className="border-t border-stone-100 py-4">
        <h3 className="text-sm font-semibold tracking-wide text-stone-500 uppercase">
          Seats
        </h3>
        {hasFlightAssignedSeats(flight) ? (
          usesPerSegmentSeats(flight) ? (
            <div className="mt-3 space-y-3">
              {flightSegmentsFromDetails(flight).map((segment, index) => (
                <div
                  key={`${segmentRouteLabel(segment)}-${index}`}
                  className="overflow-hidden rounded-xl border border-stone-200"
                >
                  <p className="bg-stone-50 px-4 py-2 text-xs font-semibold tracking-wide text-stone-500 uppercase">
                    {segmentRouteLabel(segment)}
                  </p>
                  <table className="w-full text-sm">
                    <thead className="bg-stone-50/70 text-left text-stone-500">
                      <tr>
                        <th className="px-4 py-2 font-medium">Traveller</th>
                        <th className="px-4 py-2 font-medium">Seat</th>
                      </tr>
                    </thead>
                    <tbody>
                      {passengers.map((name) => (
                        <tr key={name} className="border-t border-stone-100">
                          <td className="px-4 py-2 text-stone-800">
                            {formatTravellerLabel(name)}
                          </td>
                          <td className="px-4 py-2 text-stone-600">
                            {segment.seats?.[name] ?? "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
              {passengers.some((name) => flight.checkInStatus?.[name]) ? (
                <p className="text-sm text-stone-600">
                  Check-in recorded for{" "}
                  {passengers
                    .filter((name) => flight.checkInStatus?.[name])
                    .map((name) => formatTravellerLabel(name))
                    .join(", ")}
                </p>
              ) : null}
            </div>
          ) : (
            <div className="mt-3 overflow-hidden rounded-xl border border-stone-200">
              <table className="w-full text-sm">
                <thead className="bg-stone-50 text-left text-stone-500">
                  <tr>
                    <th className="px-4 py-2 font-medium">Traveller</th>
                    <th className="px-4 py-2 font-medium">Seat</th>
                    <th className="px-4 py-2 font-medium">Check-in</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(flight.seats!).map(([name, seat]) => (
                    <tr key={name} className="border-t border-stone-100">
                      <td className="px-4 py-2 text-stone-800">
                        {formatTravellerLabel(name)}
                      </td>
                      <td className="px-4 py-2 text-stone-600">{seat ?? "—"}</td>
                      <td className="px-4 py-2 text-stone-600">
                        {flight.checkInStatus?.[name] ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700">
                            <CheckCircle2 className="h-4 w-4" />
                            Checked in
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          <p className="mt-2 text-sm text-stone-500">
            {formatFlightSeatsSummary(
              flight,
              flight.passengers ?? flight.travellers,
            )}
          </p>
        )}
      </div>

      <ItemNotesSection notes={flight.notes} variant="section" />

      {itemId ? <LinkedPetTravelSection flightItemId={itemId} canEdit={canEdit} /> : null}
    </div>
  );
}

function LinkedPetTravelSection({
  flightItemId,
  canEdit,
}: {
  flightItemId: number;
  canEdit: boolean;
}) {
  const { petItems, loading } = usePetItemsLinkedToFlight(flightItemId);
  const { openItem } = useItineraryUI();

  if (loading && petItems.length === 0) {
    return (
      <p className="mt-4 border-t border-stone-100 pt-4 text-sm text-stone-400">
        Loading linked pet travel…
      </p>
    );
  }

  if (petItems.length === 0) return null;

  return (
    <div className="mt-4 border-t border-stone-100 pt-4">
      <h3 className="mb-3 text-sm font-semibold tracking-wide text-stone-500 uppercase">
        Linked pet travel
      </h3>
      <div className="space-y-3">
        {petItems.map((petItem) => {
          const details = petItem.details as PetRelocationDetails;
          return (
            <button
              key={petItem.id}
              type="button"
              onClick={() => openItem(petItem.id)}
              className="w-full rounded-xl border border-rose-100 bg-rose-50/60 px-4 py-3 text-left transition hover:bg-rose-50"
            >
              <p className="text-sm font-medium text-stone-800">{petItem.title}</p>
              <p className="mt-1 text-xs text-stone-600">
                {details.petName} · {details.from} → {details.to}
                {details.handler ? ` · ${details.handler}` : ""}
              </p>
            </button>
          );
        })}
      </div>
      {!canEdit ? null : (
        <p className="mt-2 text-xs text-stone-500">
          Edit pet travel items from Manage → Items.
        </p>
      )}
    </div>
  );
}

export function PetRelocationDetailView({
  details,
  linkedItem,
}: {
  details: PetRelocationDetails;
  linkedItem?: ItineraryItem | null;
}) {
  return (
    <div>
      <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
        This is a <strong>pet relocation booking</strong>, not a passenger airline
        ticket. {details.petName} travels as cargo via the relocation company.
      </div>

      <dl>
        <DetailRow label="Pet" value={`${details.petName} (${details.species})`} />
        <DetailRow label="Route" value={`${details.from} → ${details.to}`} />
        <DetailRow label="Day" value={details.dayOfWeek} />
        <DetailRow label="Handled by" value={details.handler} />
        <DetailRow label="Transport" value="Cargo (not passenger cabin)" />
        <DetailRow label="Departure" value={details.departureTime ?? undefined} />
        <DetailRow label="Arrival" value={details.arrivalTime ?? undefined} />
        {details.status === "tbc" && (
          <DetailRow label="Status" value="To be confirmed" />
        )}
      </dl>

      {linkedItem ? (
        <LinkedBookingDetailSection linkedItem={linkedItem} canEdit={false} />
      ) : details.linkedItemId ? (
        <p className="mt-3 text-sm text-stone-400">Loading linked flight…</p>
      ) : null}

      <ItemNotesSection notes={details.notes} variant="section" />
    </div>
  );
}
