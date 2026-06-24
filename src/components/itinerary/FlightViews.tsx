"use client";

import type { FlightDetails, FlightSegment } from "@/lib/types";
import { formatTravellerLabel } from "@/lib/types";
import { useDisplayFormat } from "@/hooks/useDisplayFormat";
import { formatSeatsSummary, hasAssignedSeats } from "@/lib/seats";
import {
  formatFlightNumberDisplay,
  normalizeFlightDetails,
} from "@/lib/flight-numbers";
import { FlightLiveStatusPanel } from "@/components/itinerary/FlightLiveStatus";

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

function SegmentTimeline({ segments }: { segments: FlightSegment[] }) {
  return (
    <div className="space-y-3 py-4">
      <h3 className="text-sm font-semibold tracking-wide text-stone-500 uppercase">
        Itinerary segments
      </h3>
      <div className="space-y-3">
        {segments.map((segment, index) => {
          if (segment.transit) {
            return (
              <div
                key={`transit-${index}`}
                className="rounded-xl border border-dashed border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-600"
              >
                Layover at {segment.airport} · {segment.transit}
              </div>
            );
          }

          return (
            <div
              key={`segment-${index}`}
              className="rounded-xl border border-sky-100 bg-sky-50/50 px-4 py-3"
            >
              <p className="font-medium text-sky-900">
                {formatFlightNumberDisplay(
                  segment.marketingFlightNumber,
                  segment.operatingFlightNumber,
                ) || segment.flightNumber}{" "}
                · {segment.from}
                {segment.fromIata ? ` (${segment.fromIata})` : ""} → {segment.to}
                {segment.toIata ? ` (${segment.toIata})` : ""}
              </p>
              <p className="mt-1 text-sm text-stone-600">
                {segment.departureTime && `Departs ${segment.departureTime}`}
                {segment.arrivalTime && ` · Arrives ${segment.arrivalTime}`}
                {segment.flightTime && ` · ${segment.flightTime}`}
              </p>
              {(segment.departureTerminal || segment.departureGate) && (
                <p className="mt-1 text-xs text-stone-500">
                  {segment.departureTerminal &&
                    `Dep. terminal ${segment.departureTerminal}`}
                  {segment.departureGate && ` · Dep. gate ${segment.departureGate}`}
                </p>
              )}
              {segment.aircraft && (
                <p className="mt-1 text-xs text-stone-500">Aircraft: {segment.aircraft}</p>
              )}
            </div>
          );
        })}
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
  itemId,
}: {
  details: FlightDetails;
  itemId?: number;
}) {
  const flight = normalizeFlightDetails(details);
  const passengers = flight.passengers ?? flight.travellers;
  const bookingRefs = flight.bookingReferences
    ? Object.entries(flight.bookingReferences)
        .map(([name, ref]) => `${name}: ${ref}`)
        .join(" · ")
    : flight.bookingReference;

  const flightNumberLabel = formatFlightNumberDisplay(
    flight.marketingFlightNumber,
    flight.operatingFlightNumber,
  );

  return (
    <div>
      {itemId ? (
        <FlightLiveStatusPanel
          itemId={itemId}
          marketingFlightNumber={flight.marketingFlightNumber}
          operatingFlightNumber={flight.operatingFlightNumber}
          savedDeparture={{
            terminal: flight.departureTerminal,
            gate: flight.departureGate,
          }}
        />
      ) : null}

      <div className="flex flex-wrap items-center gap-2 border-b border-stone-100 py-3">
        <StatusBadge status={flight.status} />
      </div>

      <dl>
        <DetailRow
          label="Route"
          value={`${flight.from}${flight.fromIata ? ` (${flight.fromIata})` : ""} → ${flight.to}${flight.toIata ? ` (${flight.toIata})` : ""}`}
        />
        <DetailRow label="Day" value={flight.dayOfWeek} />
        <DetailRow label="Flight" value={flightNumberLabel ?? undefined} />
        <DetailRow label="Departure" value={flight.departureTime ?? undefined} />
        <DetailRow label="Arrival" value={flight.arrivalTime ?? undefined} />
        <DetailRow label="Duration" value={flight.totalFlightTime ?? flight.flightTime} />
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
          label="Passengers"
          value={passengers.map((p) => formatTravellerLabel(p)).join(", ")}
        />
        {flight.cargoParty && flight.cargoParty.length > 0 && (
          <DetailRow
            label="Cargo (not passengers)"
            value={flight.cargoParty
              ?.map((p) => formatTravellerLabel(p, true))
              .join(", ")}
          />
        )}
        <DetailRow label="Booking ref." value={bookingRefs} />
      </dl>

      {flight.segments && flight.segments.length > 0 && (
        <SegmentTimeline segments={flight.segments} />
      )}

      <BaggageTable baggage={flight.baggage} cargoParty={flight.cargoParty} />

      <div className="border-t border-stone-100 py-4">
        <h3 className="text-sm font-semibold tracking-wide text-stone-500 uppercase">
          Seats
        </h3>
        {hasAssignedSeats(flight.seats) ? (
          <div className="mt-3 overflow-hidden rounded-xl border border-stone-200">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 text-left text-stone-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Traveller</th>
                  <th className="px-4 py-2 font-medium">Seat</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(flight.seats!).map(([name, seat]) => (
                  <tr key={name} className="border-t border-stone-100">
                    <td className="px-4 py-2 text-stone-800">
                      {formatTravellerLabel(name)}
                    </td>
                    <td className="px-4 py-2 text-stone-600">{seat ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-2 text-sm text-stone-500">
            {formatSeatsSummary(
              flight.seats,
              flight.passengers ?? flight.travellers,
            )}
          </p>
        )}
      </div>

      {flight.notes && flight.notes.length > 0 && (
        <div className="border-t border-stone-100 py-4">
          <h3 className="text-sm font-semibold tracking-wide text-stone-500 uppercase">
            Notes
          </h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-stone-700">
            {flight.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function PetRelocationDetailView({
  details,
}: {
  details: import("@/lib/types").PetRelocationDetails;
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
