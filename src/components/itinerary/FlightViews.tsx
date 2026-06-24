"use client";

import type { FlightDetails, FlightSegment } from "@/lib/types";
import { formatTravellerLabel } from "@/lib/types";
import { useDisplayFormat } from "@/hooks/useDisplayFormat";
import { formatSeatsSummary, hasAssignedSeats } from "@/lib/seats";

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
                {segment.flightNumber} · {segment.from} → {segment.to}
              </p>
              <p className="mt-1 text-sm text-stone-600">
                {segment.departureTime && `Departs ${segment.departureTime}`}
                {segment.arrivalTime && ` · Arrives ${segment.arrivalTime}`}
                {segment.flightTime && ` · ${segment.flightTime}`}
              </p>
              {(segment.departureTerminal || segment.arrivalTerminal) && (
                <p className="mt-1 text-xs text-stone-500">
                  {segment.departureTerminal && `Dep. terminal ${segment.departureTerminal}`}
                  {segment.arrivalTerminal && ` · Arr. terminal ${segment.arrivalTerminal}`}
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

export function FlightDetailView({ details }: { details: FlightDetails }) {
  const passengers = details.passengers ?? details.travellers;
  const bookingRefs = details.bookingReferences
    ? Object.entries(details.bookingReferences)
        .map(([name, ref]) => `${name}: ${ref}`)
        .join(" · ")
    : details.bookingReference;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b border-stone-100 py-3">
        <StatusBadge status={details.status} />
      </div>

      <dl>
        <DetailRow label="Route" value={`${details.from} → ${details.to}`} />
        <DetailRow label="Day" value={details.dayOfWeek} />
        <DetailRow label="Flight" value={details.flightNumber ?? undefined} />
        <DetailRow label="Departure" value={details.departureTime ?? undefined} />
        <DetailRow label="Arrival" value={details.arrivalTime ?? undefined} />
        <DetailRow label="Duration" value={details.totalFlightTime ?? details.flightTime} />
        <DetailRow label="Aircraft" value={details.aircraft} />
        <DetailRow label="Dep. terminal" value={details.departureTerminal} />
        <DetailRow label="Arr. terminal" value={details.arrivalTerminal} />
        <DetailRow
          label="Passengers"
          value={passengers.map((p) => formatTravellerLabel(p)).join(", ")}
        />
        {details.cargoParty && details.cargoParty.length > 0 && (
          <DetailRow
            label="Cargo (not passengers)"
            value={details.cargoParty
              .map((p) => formatTravellerLabel(p, true))
              .join(", ")}
          />
        )}
        <DetailRow label="Booking ref." value={bookingRefs} />
      </dl>

      {details.segments && details.segments.length > 0 && (
        <SegmentTimeline segments={details.segments} />
      )}

      <BaggageTable baggage={details.baggage} cargoParty={details.cargoParty} />

      <div className="border-t border-stone-100 py-4">
        <h3 className="text-sm font-semibold tracking-wide text-stone-500 uppercase">
          Seats
        </h3>
        {hasAssignedSeats(details.seats) ? (
          <div className="mt-3 overflow-hidden rounded-xl border border-stone-200">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 text-left text-stone-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Traveller</th>
                  <th className="px-4 py-2 font-medium">Seat</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(details.seats!).map(([name, seat]) => (
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
              details.seats,
              details.passengers ?? details.travellers,
            )}
          </p>
        )}
      </div>

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
