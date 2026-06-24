"use client";

import { Plus, Trash2 } from "lucide-react";
import type { ItineraryItem } from "@/lib/schema";
import {
  defaultTravellerRows,
  travellerOptions,
  type StructuredItemDetails,
  type TravellerRecord,
} from "@/lib/admin-item-details";
import type { AccommodationSuggestion, Category, FlightSegment } from "@/lib/types";

function TimeInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-stone-500">{label}</span>
      <input
        type="time"
        value={value?.slice(0, 5) ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-stone-200 px-3 py-2"
      />
    </label>
  );
}

function TextInput({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-stone-500">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-stone-200 px-3 py-2"
      />
    </label>
  );
}

function SystemUserMultiSelect({
  value,
  onChange,
  options,
  label,
}: {
  value: string[];
  onChange: (value: string[]) => void;
  options: string[];
  label: string;
}) {
  if (!options.length) return null;

  return (
    <div className="text-sm sm:col-span-2">
      <p className="mb-2 text-stone-500">{label}</p>
      <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-stone-200 p-2">
        {options.map((name) => (
          <label
            key={name}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-stone-50"
          >
            <input
              type="checkbox"
              checked={value.includes(name)}
              onChange={() =>
                onChange(
                  value.includes(name)
                    ? value.filter((item) => item !== name)
                    : [...value, name],
                )
              }
            />
            <span>{name}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function ParticipantMultiSelect({
  value,
  onChange,
}: {
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const options = travellerOptions(value);

  return (
    <div className="text-sm sm:col-span-2">
      <p className="mb-2 text-stone-500">Participants</p>
      <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-stone-200 p-2">
        {options.map((name) => (
          <label
            key={name}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-stone-50"
          >
            <input
              type="checkbox"
              checked={value.includes(name)}
              onChange={() =>
                onChange(
                  value.includes(name)
                    ? value.filter((item) => item !== name)
                    : [...value, name],
                )
              }
            />
            <span>{name}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function TravellerRecordsEditor({
  label,
  rows,
  onChange,
  valueLabel,
  inputType = "text",
}: {
  label: string;
  rows: TravellerRecord[];
  onChange: (rows: TravellerRecord[]) => void;
  valueLabel: string;
  inputType?: "text" | "number";
}) {
  return (
    <div className="sm:col-span-2">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm text-stone-500">{label}</p>
        <button
          type="button"
          onClick={() => onChange([...rows, { name: "", value: "" }])}
          className="inline-flex items-center gap-1 rounded-lg border border-stone-200 px-2 py-1 text-xs"
        >
          <Plus className="h-3 w-3" />
          Add row
        </button>
      </div>
      <div className="space-y-2">
        {rows.map((row, index) => (
          <div key={index} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <select
              value={row.name}
              onChange={(e) => {
                const next = [...rows];
                next[index] = { ...row, name: e.target.value };
                onChange(next);
              }}
              className="rounded-lg border border-stone-200 px-3 py-2 text-sm"
            >
              <option value="">Select traveller</option>
              {travellerOptions(rows.map((r) => r.name)).map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <input
              type={inputType}
              value={row.value}
              placeholder={valueLabel}
              onChange={(e) => {
                const next = [...rows];
                next[index] = { ...row, value: e.target.value };
                onChange(next);
              }}
              className="rounded-lg border border-stone-200 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() => onChange(rows.filter((_, i) => i !== index))}
              className="rounded-lg border border-red-200 px-3 py-2 text-red-600"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function LocationFields({
  locationName,
  locationMapUrl,
  onChange,
}: {
  locationName: string;
  locationMapUrl: string;
  onChange: (name: string, mapUrl: string) => void;
}) {
  return (
    <>
      <TextInput
        label="Location name"
        value={locationName}
        onChange={(value) => onChange(value, locationMapUrl)}
      />
      <TextInput
        label="Google Maps link"
        value={locationMapUrl}
        onChange={(value) => onChange(locationName, value)}
        type="url"
      />
    </>
  );
}

function FlightSegmentsEditor({
  segments,
  onChange,
}: {
  segments: FlightSegment[];
  onChange: (segments: FlightSegment[]) => void;
}) {
  return (
    <div className="sm:col-span-2">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold text-stone-600">Flight segments</p>
        <button
          type="button"
          onClick={() => onChange([...segments, {}])}
          className="inline-flex items-center gap-1 rounded-lg border border-stone-200 px-2 py-1 text-xs"
        >
          <Plus className="h-3 w-3" />
          Add segment
        </button>
      </div>
      <div className="space-y-4">
        {segments.map((segment, index) => (
          <div
            key={index}
            className="rounded-xl border border-stone-200 p-4"
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-medium text-stone-700">
                Segment {index + 1}
              </p>
              <button
                type="button"
                onClick={() => onChange(segments.filter((_, i) => i !== index))}
                className="text-sm text-red-600"
              >
                Remove
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <TextInput
                label="From"
                value={segment.from ?? ""}
                onChange={(value) => {
                  const next = [...segments];
                  next[index] = { ...segment, from: value };
                  onChange(next);
                }}
              />
              <TextInput
                label="To"
                value={segment.to ?? ""}
                onChange={(value) => {
                  const next = [...segments];
                  next[index] = { ...segment, to: value };
                  onChange(next);
                }}
              />
              <TextInput
                label="From airport (IATA)"
                value={segment.fromIata ?? ""}
                onChange={(value) => {
                  const next = [...segments];
                  next[index] = { ...segment, fromIata: value.toUpperCase() };
                  onChange(next);
                }}
              />
              <TextInput
                label="To airport (IATA)"
                value={segment.toIata ?? ""}
                onChange={(value) => {
                  const next = [...segments];
                  next[index] = { ...segment, toIata: value.toUpperCase() };
                  onChange(next);
                }}
              />
              <TextInput
                label="Your flight number"
                value={segment.marketingFlightNumber ?? segment.flightNumber ?? ""}
                onChange={(value) => {
                  const next = [...segments];
                  next[index] = { ...segment, marketingFlightNumber: value.toUpperCase() };
                  onChange(next);
                }}
              />
              <TextInput
                label="Operating flight number"
                value={segment.operatingFlightNumber ?? ""}
                onChange={(value) => {
                  const next = [...segments];
                  next[index] = { ...segment, operatingFlightNumber: value.toUpperCase() };
                  onChange(next);
                }}
              />
              <TimeInput
                label="Departure"
                value={segment.departureTime ?? ""}
                onChange={(value) => {
                  const next = [...segments];
                  next[index] = { ...segment, departureTime: value };
                  onChange(next);
                }}
              />
              <TimeInput
                label="Arrival"
                value={segment.arrivalTime ?? ""}
                onChange={(value) => {
                  const next = [...segments];
                  next[index] = { ...segment, arrivalTime: value };
                  onChange(next);
                }}
              />
              <TextInput
                label="Aircraft"
                value={segment.aircraft ?? ""}
                onChange={(value) => {
                  const next = [...segments];
                  next[index] = { ...segment, aircraft: value };
                  onChange(next);
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminItemDetailsForm({
  category,
  structured,
  allItems,
  onChange,
  systemUsernames = [],
}: {
  category: Category;
  structured: StructuredItemDetails;
  allItems: ItineraryItem[];
  onChange: (next: StructuredItemDetails) => void;
  systemUsernames?: string[];
}) {
  const setSimple = (key: string, value: string) =>
    onChange({
      ...structured,
      simple: { ...structured.simple, [key]: value },
    });

  const linkableItems = allItems.filter((item) => item.category !== "activity");

  return (
    <div className="mt-3 grid gap-4 sm:grid-cols-2">
      <LocationFields
        locationName={structured.locationName}
        locationMapUrl={structured.locationMapUrl}
        onChange={(locationName, locationMapUrl) =>
          onChange({ ...structured, locationName, locationMapUrl })
        }
      />

      {category === "activity" && (
        <>
          <label className="block text-sm">
            <span className="mb-1 block text-stone-500">Activity type</span>
            <input
              value={structured.simple.activityType}
              onChange={(e) => setSimple("activityType", e.target.value)}
              className="w-full rounded-lg border border-stone-200 px-3 py-2"
            />
          </label>
          <TimeInput
            label="Time"
            value={structured.simple.time}
            onChange={(value) => setSimple("time", value)}
          />
          <TextInput
            label="Description"
            value={structured.simple.description}
            onChange={(value) => setSimple("description", value)}
          />
          <ParticipantMultiSelect
            value={structured.participants}
            onChange={(participants) => onChange({ ...structured, participants })}
          />
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block text-stone-500">Linked booking</span>
            <select
              value={structured.linkedItemId}
              onChange={(e) =>
                onChange({ ...structured, linkedItemId: e.target.value })
              }
              className="w-full rounded-lg border border-stone-200 px-3 py-2"
            >
              <option value="">None</option>
              {linkableItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
          </label>
        </>
      )}

      {category === "flight" && (
        <>
          <TextInput label="From" value={structured.simple.from} onChange={(v) => setSimple("from", v)} />
          <TextInput label="From airport (IATA)" value={structured.simple.fromIata} onChange={(v) => setSimple("fromIata", v.toUpperCase())} />
          <TextInput label="To" value={structured.simple.to} onChange={(v) => setSimple("to", v)} />
          <TextInput label="To airport (IATA)" value={structured.simple.toIata} onChange={(v) => setSimple("toIata", v.toUpperCase())} />
          <TextInput
            label="Your flight number (codeshare / ticket)"
            value={structured.simple.marketingFlightNumber}
            onChange={(v) => setSimple("marketingFlightNumber", v.toUpperCase())}
          />
          <TextInput
            label="Operating flight number (for tracking)"
            value={structured.simple.operatingFlightNumber}
            onChange={(v) => setSimple("operatingFlightNumber", v.toUpperCase())}
          />
          <p className="sm:col-span-2 text-xs text-stone-500">
            Displayed as your flight (operating), e.g. QF1234 (AA456). Live
            tracking uses the operating flight and departure IATA code.
          </p>
          <TimeInput label="Departure time" value={structured.simple.departureTime} onChange={(v) => setSimple("departureTime", v)} />
          <TimeInput label="Arrival time" value={structured.simple.arrivalTime} onChange={(v) => setSimple("arrivalTime", v)} />
          <p className="sm:col-span-2 text-xs text-stone-500">
            Departure and arrival times use each airport&apos;s local timezone (from
            the IATA codes above), not your device timezone.
          </p>
          <TextInput label="Aircraft" value={structured.simple.aircraft} onChange={(v) => setSimple("aircraft", v)} />
          <TextInput label="Total flight time" value={structured.simple.totalFlightTime} onChange={(v) => setSimple("totalFlightTime", v)} />
          <TextInput label="Dep. terminal" value={structured.simple.departureTerminal} onChange={(v) => setSimple("departureTerminal", v)} />
          <TextInput label="Dep. gate" value={structured.simple.departureGate} onChange={(v) => setSimple("departureGate", v)} />
          <TextInput label="Arr. terminal" value={structured.simple.arrivalTerminal} onChange={(v) => setSimple("arrivalTerminal", v)} />
          <TextInput label="Arr. gate" value={structured.simple.arrivalGate} onChange={(v) => setSimple("arrivalGate", v)} />
          <label className="block text-sm">
            <span className="mb-1 block text-stone-500">Status</span>
            <select
              value={structured.simple.status}
              onChange={(e) => setSimple("status", e.target.value)}
              className="w-full rounded-lg border border-stone-200 px-3 py-2"
            >
              <option value="confirmed">Confirmed</option>
              <option value="tbc">To be confirmed</option>
            </select>
          </label>
          <ParticipantMultiSelect
            value={structured.travellers}
            onChange={(travellers) => {
              onChange({
                ...structured,
                travellers,
                seats:
                  structured.seats.length > 0
                    ? structured.seats
                    : defaultTravellerRows(travellers),
                baggage:
                  structured.baggage.length > 0
                    ? structured.baggage
                    : defaultTravellerRows(travellers),
              });
            }}
          />
          <TravellerRecordsEditor
            label="Booking references"
            rows={structured.bookingReferences}
            onChange={(bookingReferences) =>
              onChange({ ...structured, bookingReferences })
            }
            valueLabel="Reference"
          />
          <TravellerRecordsEditor
            label="Seat numbers"
            rows={structured.seats}
            onChange={(seats) => onChange({ ...structured, seats })}
            valueLabel="Seat"
          />
          <div className="sm:col-span-2">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm text-stone-500">Baggage allowance</p>
              <select
                value={structured.baggageUnit}
                onChange={(e) =>
                  onChange({
                    ...structured,
                    baggageUnit: e.target.value as "metric" | "imperial",
                  })
                }
                className="rounded-lg border border-stone-200 px-2 py-1 text-xs"
              >
                <option value="metric">Kilograms (kg)</option>
                <option value="imperial">Pounds (lb)</option>
              </select>
            </div>
            <TravellerRecordsEditor
              label=""
              rows={structured.baggage}
              onChange={(baggage) => onChange({ ...structured, baggage })}
              valueLabel={structured.baggageUnit === "imperial" ? "lb" : "kg"}
              inputType="number"
            />
          </div>
          <FlightSegmentsEditor
            segments={structured.segments}
            onChange={(segments) => onChange({ ...structured, segments })}
          />
        </>
      )}

      {category === "accommodation" && (
        <>
          <TextInput label="Platform" value={structured.simple.platform} onChange={(v) => setSimple("platform", v)} />
          <label className="block text-sm">
            <span className="mb-1 block text-stone-500">Booking status</span>
            <select
              value={structured.simple.bookingStatus}
              onChange={(e) => setSimple("bookingStatus", e.target.value)}
              className="w-full rounded-lg border border-stone-200 px-3 py-2"
            >
              <option value="confirmed">Confirmed</option>
              <option value="suggested">Suggested</option>
              <option value="private">Private stay</option>
            </select>
          </label>
          <TextInput label="Stay name" value={structured.simple.location} onChange={(v) => setSimple("location", v)} />
          <TextInput label="Guests" value={structured.simple.guests} onChange={(v) => setSimple("guests", v)} />
          <TextInput label="Address" value={structured.simple.address} onChange={(v) => setSimple("address", v)} />
          <TextInput label="Listing URL" value={structured.simple.listingUrl} onChange={(v) => setSimple("listingUrl", v)} type="url" />
          <TextInput label="Check-in date" value={structured.simple.checkInDate} onChange={(v) => setSimple("checkInDate", v)} type="date" />
          <TextInput label="Check-out date" value={structured.simple.checkOutDate} onChange={(v) => setSimple("checkOutDate", v)} type="date" />
          <TimeInput label="Check-in time" value={structured.simple.checkInTime} onChange={(v) => setSimple("checkInTime", v)} />
          <TimeInput label="Check-out time" value={structured.simple.checkOutTime} onChange={(v) => setSimple("checkOutTime", v)} />
          <div className="sm:col-span-2">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm text-stone-500">Alternative suggestions</p>
              <button
                type="button"
                onClick={() =>
                  onChange({
                    ...structured,
                    suggestions: [
                      ...structured.suggestions,
                      { label: "", url: "", platform: "airbnb" },
                    ],
                  })
                }
                className="inline-flex items-center gap-1 rounded-lg border border-stone-200 px-2 py-1 text-xs"
              >
                <Plus className="h-3 w-3" />
                Add suggestion
              </button>
            </div>
            {structured.suggestions.map((suggestion, index) => (
              <div key={index} className="mb-2 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <input
                  value={suggestion.label}
                  placeholder="Label"
                  onChange={(e) => {
                    const next = [...structured.suggestions];
                    next[index] = { ...suggestion, label: e.target.value };
                    onChange({ ...structured, suggestions: next });
                  }}
                  className="rounded-lg border border-stone-200 px-3 py-2 text-sm"
                />
                <input
                  value={suggestion.url}
                  placeholder="URL"
                  onChange={(e) => {
                    const next = [...structured.suggestions];
                    next[index] = { ...suggestion, url: e.target.value };
                    onChange({ ...structured, suggestions: next });
                  }}
                  className="rounded-lg border border-stone-200 px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      ...structured,
                      suggestions: structured.suggestions.filter((_, i) => i !== index),
                    })
                  }
                  className="rounded-lg border border-red-200 px-3 py-2 text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {category === "car_rental" && (
        <>
          <TextInput label="Company" value={structured.simple.company} onChange={(v) => setSimple("company", v)} />
          <label className="block text-sm">
            <span className="mb-1 block text-stone-500">Booking status</span>
            <select
              value={structured.simple.bookingStatus}
              onChange={(e) => setSimple("bookingStatus", e.target.value)}
              className="w-full rounded-lg border border-stone-200 px-3 py-2"
            >
              <option value="confirmed">Confirmed</option>
              <option value="suggested">Not booked yet</option>
            </select>
          </label>
          <TextInput label="Vehicle" value={structured.simple.vehicleModel} onChange={(v) => setSimple("vehicleModel", v)} />
          <TextInput label="Pickup location" value={structured.simple.pickupLocation} onChange={(v) => setSimple("pickupLocation", v)} />
          <TimeInput label="Pickup time" value={structured.simple.pickupTime} onChange={(v) => setSimple("pickupTime", v)} />
          <TextInput label="Return location" value={structured.simple.returnLocation} onChange={(v) => setSimple("returnLocation", v)} />
          <TimeInput label="Return time" value={structured.simple.returnTime} onChange={(v) => setSimple("returnTime", v)} />
          <TextInput label="Confirmation code" value={structured.simple.confirmationCode} onChange={(v) => setSimple("confirmationCode", v)} />
        </>
      )}

      {category === "pet_relocation" && (
        <>
          <TextInput label="Pet name" value={structured.simple.petName} onChange={(v) => setSimple("petName", v)} />
          <TextInput label="From" value={structured.simple.from} onChange={(v) => setSimple("from", v)} />
          <TextInput label="To" value={structured.simple.to} onChange={(v) => setSimple("to", v)} />
          <TextInput label="Handler" value={structured.simple.handler} onChange={(v) => setSimple("handler", v)} />
        </>
      )}

      {category === "travel_insurance" && (
        <>
          <TextInput label="Provider" value={structured.simple.provider} onChange={(v) => setSimple("provider", v)} />
          <TextInput label="Policy number" value={structured.simple.policyNumber} onChange={(v) => setSimple("policyNumber", v)} />
          <TextInput label="Coverage" value={structured.simple.coverage} onChange={(v) => setSimple("coverage", v)} />
          <TextInput label="Emergency phone" value={structured.simple.emergencyPhone} onChange={(v) => setSimple("emergencyPhone", v)} />
          <TextInput label="Document URL" value={structured.simple.documentUrl} onChange={(v) => setSimple("documentUrl", v)} type="url" />
          <TextInput label="Policy start date" value={structured.simple.policyStartDate} onChange={(v) => setSimple("policyStartDate", v)} type="date" />
          <TextInput label="Policy end date" value={structured.simple.policyEndDate} onChange={(v) => setSimple("policyEndDate", v)} type="date" />
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block text-stone-500">Countries covered</span>
            <textarea
              value={structured.simple.countries}
              onChange={(e) => setSimple("countries", e.target.value)}
              rows={2}
              placeholder="One per line or comma-separated"
              className="w-full rounded-lg border border-stone-200 px-3 py-2"
            />
          </label>
          <SystemUserMultiSelect
            label="Travellers"
            options={[
              ...new Set([...systemUsernames, ...structured.travellers]),
            ].sort((a, b) => a.localeCompare(b))}
            value={structured.travellers}
            onChange={(travellers) => onChange({ ...structured, travellers })}
          />
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={structured.simple.autoInsuranceIncluded === "true"}
              onChange={(e) =>
                setSimple(
                  "autoInsuranceIncluded",
                  e.target.checked ? "true" : "false",
                )
              }
            />
            Auto insurance included
          </label>
          {structured.simple.autoInsuranceIncluded === "true" && (
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block text-stone-500">Auto insurance details</span>
              <textarea
                value={structured.simple.autoInsuranceDetails}
                onChange={(e) => setSimple("autoInsuranceDetails", e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-stone-200 px-3 py-2"
              />
            </label>
          )}
        </>
      )}

      <label className="block text-sm sm:col-span-2">
        <span className="mb-1 block text-stone-500">Notes</span>
        <textarea
          value={structured.notes}
          onChange={(e) => onChange({ ...structured, notes: e.target.value })}
          rows={3}
          className="w-full rounded-lg border border-stone-200 px-3 py-2"
        />
      </label>
    </div>
  );
}
