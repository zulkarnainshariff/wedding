"use client";

import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ItineraryItem } from "@/lib/schema";
import {
  defaultTravellerRows,
  type StructuredItemDetails,
  type TravellerRecord,
} from "@/lib/admin-item-details";
import { travellerOptionsFromAccounts } from "@/lib/item-travellers";
import { CheckboxDropdown } from "@/components/admin/CheckboxDropdown";
import { AdditionalViewersDropdown } from "@/components/admin/AdditionalViewersDropdown";
import {
  additionalViewerOptions,
  participantNamesForItemCategory,
} from "@/lib/item-viewers";
import { travellerMatchesUsername } from "@/lib/item-travellers";
import type { BookingGroup } from "@/lib/booking-groups";
import {
  normalizeBookingGroupLinks,
  otherBookingReferences,
  remapBookingReference,
  removeBookingGroup,
  updateBookingGroupLinks,
} from "@/lib/booking-groups";
import type { AccommodationSuggestion, Category, FlightSegment } from "@/lib/types";
import {
  applySegmentSeatWithPropagation,
} from "@/lib/flight-seats";
import {
  getEffectiveFlightScheduleSortBy,
  isFlightArrivalOnEventDay,
  normalizeFlightScheduleSortBy,
  type FlightScheduleSortBy,
} from "@/lib/flight-schedule-sort";

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

function ParticipantMultiSelect({
  label = "Participants",
  value,
  onChange,
  accountUsernames,
}: {
  label?: string;
  value: string[];
  onChange: (value: string[]) => void;
  accountUsernames: string[];
}) {
  const options = travellerOptionsFromAccounts(accountUsernames, value);

  return (
    <CheckboxDropdown
      label={label}
      options={options}
      value={value}
      onChange={onChange}
      emptyLabel="Select participants…"
      className="sm:col-span-2"
    />
  );
}

function updateFlightTravellers(
  structured: StructuredItemDetails,
  travellers: string[],
): StructuredItemDetails {
  const nextGroups = structured.bookingGroups.map((group) => ({
    ...group,
    travellers: group.travellers.filter((name) => travellers.includes(name)),
  }));

  return {
    ...structured,
    travellers,
    bookingGroups: nextGroups,
    seats:
      structured.seats.length > 0
        ? structured.seats
        : defaultTravellerRows(travellers),
    baggage:
      structured.baggage.length > 0
        ? structured.baggage
        : defaultTravellerRows(travellers),
  };
}

function linkedParticipantsForCategory(
  structured: StructuredItemDetails,
  category: Category,
): string[] {
  if (category === "flight" || category === "travel_insurance") {
    return structured.travellers;
  }
  return structured.participants;
}

function patchStructured(
  structured: StructuredItemDetails,
  patch: Partial<StructuredItemDetails>,
): StructuredItemDetails {
  return {
    ...structured,
    ...patch,
    participants: patch.participants
      ? [...patch.participants]
      : [...structured.participants],
    travellers: patch.travellers
      ? [...patch.travellers]
      : [...structured.travellers],
    privateViewers: patch.privateViewers
      ? [...patch.privateViewers]
      : [...structured.privateViewers],
    viewers: patch.viewers ? [...patch.viewers] : [...structured.viewers],
    viewerLinks: patch.viewerLinks
      ? { ...patch.viewerLinks }
      : { ...structured.viewerLinks },
  };
}

function usernamesForParticipants(
  participants: string[],
  systemUsernames: string[],
): string[] {
  return systemUsernames.filter((username) =>
    participants.some((participant) =>
      travellerMatchesUsername(participant, username),
    ),
  );
}

function TravellerRecordsEditor({
  label,
  rows,
  onChange,
  valueLabel,
  inputType = "text",
  nameOptions,
  accountUsernames,
}: {
  label: string;
  rows: TravellerRecord[];
  onChange: (rows: TravellerRecord[]) => void;
  valueLabel: string;
  inputType?: "text" | "number";
  nameOptions?: string[];
  accountUsernames: string[];
}) {
  const travellerNameOptions = travellerOptionsFromAccounts(
    accountUsernames,
    nameOptions ?? rows.map((row) => row.name),
  );
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
              {travellerNameOptions.map((name) => (
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

function TravellerCheckboxDropdown({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const allSelected =
    options.length > 0 && options.every((name) => value.includes(name));
  const summary =
    value.length === 0
      ? "Select travellers"
      : allSelected
        ? "Everyone"
        : value.join(", ");

  function toggle(name: string) {
    onChange(
      value.includes(name)
        ? value.filter((entry) => entry !== name)
        : [...value, name],
    );
  }

  return (
    <div className="relative">
      <p className="mb-1 text-xs text-stone-500">{label}</p>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between rounded-lg border border-stone-200 bg-white px-3 py-2 text-left text-sm"
      >
        <span className="truncate text-stone-700">{summary}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-stone-400" />
      </button>
      {open && (
        <>
          <button
            type="button"
            aria-label="Close traveller selector"
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />
          <div className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-stone-200 bg-white p-2 shadow-lg">
          {options.length > 1 && (
            <label className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-stone-50">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={() =>
                  onChange(allSelected ? [] : [...options])
                }
              />
              <span className="font-medium">Everyone</span>
            </label>
          )}
          {options.map((name) => (
            <label
              key={name}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-stone-50"
            >
              <input
                type="checkbox"
                checked={value.includes(name)}
                onChange={() => toggle(name)}
              />
              <span>{name}</span>
            </label>
          ))}
          </div>
        </>
      )}
    </div>
  );
}

function LinkedReferencesDropdown({
  currentReference,
  options,
  value,
  onChange,
}: {
  currentReference: string;
  options: string[];
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const summary =
    value.length === 0
      ? "None"
      : value.length === 1
        ? value[0]
        : `${value.length} linked`;

  if (!options.length || !currentReference.trim()) return null;

  function toggle(ref: string) {
    onChange(
      value.includes(ref) ? value.filter((entry) => entry !== ref) : [...value, ref],
    );
  }

  return (
    <div className="relative sm:col-span-2">
      <p className="mb-1 text-xs text-stone-500">
        Linked with other booking(s)
      </p>
      <p className="mb-2 text-xs text-stone-400">
        Cross-linked at the airline — separate PNRs, travelling together.
      </p>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between rounded-lg border border-stone-200 bg-white px-3 py-2 text-left text-sm"
      >
        <span className="truncate text-stone-700">{summary}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-stone-400" />
      </button>
      {open && (
        <>
          <button
            type="button"
            aria-label="Close linked booking selector"
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />
          <div className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-stone-200 bg-white p-2 shadow-lg">
            {options.map((ref) => (
              <label
                key={ref}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-stone-50"
              >
                <input
                  type="checkbox"
                  checked={value.includes(ref)}
                  onChange={() => toggle(ref)}
                />
                <span>{ref}</span>
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function BookingGroupsEditor({
  groups,
  onChange,
  flightTravellers,
}: {
  groups: BookingGroup[];
  onChange: (groups: BookingGroup[]) => void;
  flightTravellers: string[];
}) {
  const participantOptions = flightTravellers.filter((name) => name !== "Everyone");

  return (
    <div className="sm:col-span-2">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm text-stone-500">Booking references</p>
        <button
          type="button"
          onClick={() =>
            onChange([
              ...groups,
              { reference: "", travellers: [], linkedWith: [] },
            ])
          }
          className="inline-flex items-center gap-1 rounded-lg border border-stone-200 px-2 py-1 text-xs"
        >
          <Plus className="h-3 w-3" />
          Add reference
        </button>
      </div>
      {participantOptions.length === 0 && (
        <p className="mb-2 text-xs text-amber-700">
          Add flight participants above before assigning booking references.
        </p>
      )}
      <div className="space-y-3">
        {groups.map((group, index) => (
          <div
            key={index}
            className="space-y-2 rounded-lg border border-stone-200 p-3"
          >
            <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <label className="block text-sm">
                <span className="mb-1 block text-xs text-stone-500">PNR / reference</span>
                <input
                  type="text"
                  value={group.reference}
                  placeholder="e.g. RTVP8U"
                  onChange={(e) => {
                    onChange(remapBookingReference(groups, index, e.target.value));
                  }}
                  className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
                />
              </label>
              <TravellerCheckboxDropdown
                label="Applies to"
                options={participantOptions}
                value={group.travellers}
                onChange={(travellers) => {
                  const next = [...groups];
                  next[index] = { ...group, travellers };
                  onChange(next);
                }}
              />
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => onChange(removeBookingGroup(groups, index))}
                  className="rounded-lg border border-red-200 px-3 py-2 text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            <LinkedReferencesDropdown
              currentReference={group.reference}
              options={otherBookingReferences(groups, index)}
              value={group.linkedWith ?? []}
              onChange={(linkedWith) =>
                onChange(updateBookingGroupLinks(groups, index, linkedWith))
              }
            />
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

function SegmentSeatsEditor({
  travellers,
  segment,
  onSeatChange,
}: {
  travellers: string[];
  segment: FlightSegment;
  onSeatChange: (traveller: string, seat: string) => void;
}) {
  if (travellers.length === 0) return null;

  return (
    <div className="sm:col-span-2">
      <p className="mb-2 text-sm text-stone-500">Seat numbers</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {travellers.map((traveller) => (
          <label key={traveller} className="block text-sm">
            <span className="mb-1 block text-stone-500">{traveller}</span>
            <input
              type="text"
              value={segment.seats?.[traveller] ?? ""}
              placeholder="Seat"
              onChange={(event) =>
                onSeatChange(traveller, event.target.value.toUpperCase())
              }
              className="w-full rounded-lg border border-stone-200 px-3 py-2"
            />
          </label>
        ))}
      </div>
      <p className="mt-2 text-xs text-stone-500">
        Matching aircraft on other segments uses the same seat automatically.
      </p>
    </div>
  );
}

function FlightSegmentsEditor({
  segments,
  travellers,
  onChange,
}: {
  segments: FlightSegment[];
  travellers: string[];
  onChange: (segments: FlightSegment[]) => void;
}) {
  return (
    <div className="sm:col-span-2">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-stone-600">Flight segments</p>
          <p className="text-xs text-stone-500">
            One item = one booking. Add a segment per flight leg; use your ticket
            number and operating number on each leg when they differ.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            const previous = segments[segments.length - 1];
            onChange([
              ...segments,
              {
                from: previous?.to,
                fromIata: previous?.toIata,
              },
            ]);
          }}
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
                label="Ticket / marketed flight no."
                value={segment.marketingFlightNumber ?? segment.flightNumber ?? ""}
                onChange={(value) => {
                  const next = [...segments];
                  next[index] = { ...segment, marketingFlightNumber: value.toUpperCase() };
                  onChange(next);
                }}
              />
              <TextInput
                label="Operating flight no."
                value={segment.operatingFlightNumber ?? ""}
                onChange={(value) => {
                  const next = [...segments];
                  next[index] = { ...segment, operatingFlightNumber: value.toUpperCase() };
                  onChange(next);
                }}
              />
              <p className="sm:col-span-2 text-xs text-stone-500">
                Example: ticket shows QF4716 but AA3164 operates the aircraft —
                put QF4716 as marketed and AA3164 as operating. Same number on
                both for a non-codeshare leg like QF93.
              </p>
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
              {travellers.length > 0 ? (
                <SegmentSeatsEditor
                  travellers={travellers}
                  segment={segment}
                  onSeatChange={(traveller, seat) => {
                    onChange(
                      applySegmentSeatWithPropagation(
                        segments,
                        index,
                        traveller,
                        seat,
                      ),
                    );
                  }}
                />
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SeatCheckInEditor({
  rows,
  checkInStatus,
  onChange,
  onCheckInChange,
  showSeats = true,
  nameOptions,
  accountUsernames,
}: {
  rows: TravellerRecord[];
  checkInStatus: Record<string, boolean>;
  onChange: (rows: TravellerRecord[]) => void;
  onCheckInChange: (status: Record<string, boolean>) => void;
  showSeats?: boolean;
  nameOptions?: string[];
  accountUsernames: string[];
}) {
  const travellerNameOptions = travellerOptionsFromAccounts(
    accountUsernames,
    nameOptions ?? rows.map((row) => row.name),
  );
  return (
    <div className="sm:col-span-2">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm text-stone-500">
          {showSeats ? "Seat numbers & check-in" : "Check-in"}
        </p>
        {showSeats ? (
          <button
            type="button"
            onClick={() => onChange([...rows, { name: "", value: "" }])}
            className="inline-flex items-center gap-1 rounded-lg border border-stone-200 px-2 py-1 text-xs"
          >
            <Plus className="h-3 w-3" />
            Add row
          </button>
        ) : null}
      </div>
      <div className="space-y-2">
        {(showSeats
          ? rows
          : rows.length > 0
            ? rows
            : [{ name: "", value: "" }]
        ).map((row, index) => (
          <div
            key={index}
            className={[
              "grid gap-2",
              showSeats
                ? "sm:grid-cols-[1fr_1fr_auto_auto]"
                : "sm:grid-cols-[1fr_auto_auto]",
            ].join(" ")}
          >
            <select
              value={row.name}
              onChange={(e) => {
                const next = [...rows];
                if (!showSeats && next.length === 0) {
                  onChange([{ name: e.target.value, value: "" }]);
                  return;
                }
                next[index] = { ...row, name: e.target.value };
                onChange(next);
              }}
              className="rounded-lg border border-stone-200 px-3 py-2 text-sm"
            >
              <option value="">Select traveller</option>
              {travellerNameOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            {showSeats ? (
              <input
                type="text"
                value={row.value}
                placeholder="Seat"
                onChange={(e) => {
                  const next = [...rows];
                  next[index] = { ...row, value: e.target.value };
                  onChange(next);
                }}
                className="rounded-lg border border-stone-200 px-3 py-2 text-sm"
              />
            ) : null}
            <label className="flex items-center gap-2 rounded-lg border border-stone-200 px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={Boolean(row.name && checkInStatus[row.name])}
                onChange={(e) => {
                  if (!row.name) return;
                  onCheckInChange({
                    ...checkInStatus,
                    [row.name]: e.target.checked,
                  });
                }}
              />
              Checked in
            </label>
            {showSeats ? (
              <button
                type="button"
                onClick={() => onChange(rows.filter((_, i) => i !== index))}
                className="rounded-lg border border-red-200 px-3 py-2 text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            ) : null}
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
  eventDate = null,
  startDatetime = null,
  endDatetime = null,
}: {
  category: Category;
  structured: StructuredItemDetails;
  allItems: ItineraryItem[];
  onChange: (next: StructuredItemDetails) => void;
  systemUsernames?: string[];
  eventDate?: string | null;
  startDatetime?: string | null;
  endDatetime?: Date | string | null;
}) {
  const [loadedUsernames, setLoadedUsernames] = useState<string[]>([]);

  useEffect(() => {
    if (systemUsernames.length > 0) return;

    void fetch("/api/users/brief")
      .then((response) => (response.ok ? response.json() : []))
      .then((rows: { username: string }[]) => {
        setLoadedUsernames(rows.map((row) => row.username));
      })
      .catch(() => undefined);
  }, [systemUsernames.length]);

  const allSystemUsernames = useMemo(
    () =>
      [...new Set([...systemUsernames, ...loadedUsernames])].sort((a, b) =>
        a.localeCompare(b),
      ),
    [loadedUsernames, systemUsernames],
  );

  const participants = linkedParticipantsForCategory(structured, category);
  const participantUsernames = usernamesForParticipants(
    participants,
    allSystemUsernames,
  );
  const privateViewerOptions = useMemo(
    () =>
      allSystemUsernames.filter(
        (username) => !participantUsernames.includes(username),
      ),
    [allSystemUsernames, participantUsernames],
  );
  const itemAdditionalViewerOptions = useMemo(
    () =>
      additionalViewerOptions(
        participantNamesForItemCategory(structured, category),
        structured.viewers,
        allSystemUsernames,
      ),
    [structured, category, allSystemUsernames],
  );

  const flightSortPreviewItem = useMemo(
    () =>
      ({
        category: "flight" as const,
        eventDate,
        startDatetime,
        endDatetime,
        details: {
          ...structured.simple,
          segments: structured.segments,
        },
      }),
    [structured.simple, structured.segments, eventDate, startDatetime, endDatetime],
  );

  const flightCanSortByArrival = useMemo(
    () => isFlightArrivalOnEventDay(flightSortPreviewItem),
    [flightSortPreviewItem],
  );

  const flightScheduleSortBy = useMemo(
    () => getEffectiveFlightScheduleSortBy(flightSortPreviewItem),
    [flightSortPreviewItem],
  );

  useEffect(() => {
    if (category !== "flight" || flightCanSortByArrival) return;
    if (structured.simple.scheduleSortBy === "departure") return;
    onChange({
      ...structured,
      simple: { ...structured.simple, scheduleSortBy: "departure" },
    });
  }, [category, flightCanSortByArrival, structured, onChange]);

  function setFlightScheduleSortBy(next: FlightScheduleSortBy) {
    const normalized = normalizeFlightScheduleSortBy(
      flightSortPreviewItem,
      next,
    );
    onChange({
      ...structured,
      simple: { ...structured.simple, scheduleSortBy: normalized },
    });
  }

  const setSimple = (key: string, value: string) =>
    onChange({
      ...structured,
      simple: { ...structured.simple, [key]: value },
    });

  const linkableItems = allItems.filter((item) => item.category !== "activity");

  return (
    <div className="mt-3 grid gap-4 sm:grid-cols-2">
      {category !== "flight" && (
        <LocationFields
          locationName={structured.locationName}
          locationMapUrl={structured.locationMapUrl}
          onChange={(locationName, locationMapUrl) =>
            onChange({ ...structured, locationName, locationMapUrl })
          }
        />
      )}

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
            onChange={(participants) =>
              onChange(patchStructured(structured, { participants }))
            }
            accountUsernames={allSystemUsernames}
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
          <label className="block text-sm sm:col-span-2">
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
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block text-stone-500">Day timeline sort</span>
            <select
              value={flightScheduleSortBy}
              onChange={(e) =>
                setFlightScheduleSortBy(e.target.value as FlightScheduleSortBy)
              }
              className="w-full rounded-lg border border-stone-200 px-3 py-2"
            >
              <option value="arrival" disabled={!flightCanSortByArrival}>
                Arrival time
              </option>
              <option value="departure">Departure time</option>
            </select>
            <p className="mt-1 text-xs text-stone-500">
              {flightCanSortByArrival
                ? "Choose whether this flight is ordered by departure or arrival when mixed with other plans on the same day."
                : "Arrival is on a different day than this item, so only departure time can be used for sorting."}
            </p>
          </label>
          <ParticipantMultiSelect
            value={structured.travellers}
            onChange={(travellers) =>
              onChange(updateFlightTravellers(structured, travellers))
            }
            accountUsernames={allSystemUsernames}
          />
          <BookingGroupsEditor
            groups={structured.bookingGroups}
            onChange={(bookingGroups) => onChange({ ...structured, bookingGroups })}
            flightTravellers={structured.travellers}
          />
          <SeatCheckInEditor
            rows={
              structured.segments.length >= 2
                ? structured.travellers.map((name) => ({ name, value: "" }))
                : structured.seats
            }
            showSeats={structured.segments.length < 2}
            checkInStatus={structured.checkInStatus}
            nameOptions={structured.travellers}
            accountUsernames={allSystemUsernames}
            onChange={(seats) => onChange({ ...structured, seats })}
            onCheckInChange={(checkInStatus) =>
              onChange({ ...structured, checkInStatus })
            }
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
              nameOptions={structured.travellers}
              accountUsernames={allSystemUsernames}
              onChange={(baggage) => onChange({ ...structured, baggage })}
              valueLabel={structured.baggageUnit === "imperial" ? "lb" : "kg"}
              inputType="number"
            />
          </div>
          {structured.segments.length > 0 ? (
            <FlightSegmentsEditor
              segments={structured.segments}
              travellers={structured.travellers}
              onChange={(segments) => onChange({ ...structured, segments })}
            />
          ) : (
            <div className="sm:col-span-2 rounded-lg border border-dashed border-stone-200 px-3 py-3">
              <p className="text-sm text-stone-600">
                Single-segment flight — edit the flight number, airports, and
                times in the schedule fields above.
              </p>
              <button
                type="button"
                onClick={() => {
                  const simple = structured.simple;
                  onChange({
                    ...structured,
                    segments: [
                      {
                        from: simple.from,
                        fromIata: simple.fromIata,
                        marketingFlightNumber: simple.marketingFlightNumber,
                        operatingFlightNumber:
                          simple.operatingFlightNumber ||
                          simple.marketingFlightNumber,
                        departureTime: simple.departureTime,
                        aircraft: simple.aircraft,
                      },
                      {
                        to: simple.to,
                        toIata: simple.toIata,
                        arrivalTime: simple.arrivalTime,
                      },
                    ],
                  });
                }}
                className="mt-2 inline-flex items-center gap-1 rounded-lg border border-stone-200 px-2 py-1 text-xs"
              >
                <Plus className="h-3 w-3" />
                Add connecting segment
              </button>
            </div>
          )}
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
          <ParticipantMultiSelect
            label="Guests staying"
            value={structured.participants}
            onChange={(participants) =>
              onChange(patchStructured(structured, { participants }))
            }
            accountUsernames={allSystemUsernames}
          />
          <TextInput
            label="Guests note (optional)"
            value={structured.simple.guests}
            onChange={(v) => setSimple("guests", v)}
          />
          <TextInput label="Address" value={structured.simple.address} onChange={(v) => setSimple("address", v)} />
          <TextInput label="Listing URL" value={structured.simple.listingUrl} onChange={(v) => setSimple("listingUrl", v)} type="url" />
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block text-stone-500">Check-in</span>
            <div className="flex flex-wrap gap-2">
              <input
                type="date"
                value={structured.simple.checkInDate}
                onChange={(e) => setSimple("checkInDate", e.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-stone-200 px-3 py-2"
              />
              <input
                type="time"
                value={structured.simple.checkInTime}
                onChange={(e) => setSimple("checkInTime", e.target.value)}
                className="w-32 rounded-lg border border-stone-200 px-3 py-2"
              />
            </div>
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block text-stone-500">Check-out</span>
            <div className="flex flex-wrap gap-2">
              <input
                type="date"
                value={structured.simple.checkOutDate}
                onChange={(e) => setSimple("checkOutDate", e.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-stone-200 px-3 py-2"
              />
              <input
                type="time"
                value={structured.simple.checkOutTime}
                onChange={(e) => setSimple("checkOutTime", e.target.value)}
                className="w-32 rounded-lg border border-stone-200 px-3 py-2"
              />
            </div>
          </label>
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
          <ParticipantMultiSelect
            label="Driver / participants"
            value={structured.participants}
            onChange={(participants) =>
              onChange(patchStructured(structured, { participants }))
            }
            accountUsernames={allSystemUsernames}
          />
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
          <ParticipantMultiSelect
            value={structured.participants}
            onChange={(participants) =>
              onChange(patchStructured(structured, { participants }))
            }
            accountUsernames={allSystemUsernames}
          />
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
          <ParticipantMultiSelect
            label="Travellers"
            value={structured.travellers}
            onChange={(travellers) =>
              onChange(patchStructured(structured, { travellers }))
            }
            accountUsernames={allSystemUsernames}
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

      <div className="rounded-xl border border-stone-200 bg-stone-50/80 p-4 sm:col-span-2">
        <AdditionalViewersDropdown
          label="Additional viewers"
          options={itemAdditionalViewerOptions}
          viewers={structured.viewers}
          viewerLinks={structured.viewerLinks}
          participantOptions={participants}
          onChange={({ viewers, viewerLinks }) =>
            onChange(patchStructured(structured, { viewers, viewerLinks }))
          }
          emptyLabel="No additional viewers"
        />
        <p className="mt-2 text-xs text-stone-500">
          Travellers who should see this item but are not listed as participants
          above — for example someone being picked up at the airport.
        </p>
      </div>

      <div className="rounded-xl border border-stone-200 bg-stone-50/80 p-4 sm:col-span-2">
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={structured.isPrivate}
            onChange={(e) =>
              onChange(patchStructured(structured, { isPrivate: e.target.checked }))
            }
            className="mt-0.5"
          />
          <span>
            <span className="font-medium text-stone-800">Private item</span>
            <span className="mt-0.5 block text-xs text-stone-500">
              Only participants on this item, additional viewers above, and admins can
              see it — even when someone&apos;s schedule filter is set to
              Everyone.
            </span>
          </span>
        </label>

        {structured.isPrivate ? (
          <div className="mt-3 border-t border-stone-200 pt-3">
            <CheckboxDropdown
              label="Private viewers (login accounts)"
              options={privateViewerOptions}
              value={structured.privateViewers}
              onChange={(privateViewers) =>
                onChange(
                  patchStructured(structured, {
                    privateViewers: privateViewers.map((username) =>
                      username.toLowerCase(),
                    ),
                  }),
                )
              }
              emptyLabel="Add viewers…"
            />
            <p className="mt-2 text-xs text-stone-500">
              People with accounts who can view this item but are not
              participants above — for example, a parent viewing their
              child&apos;s booking.
            </p>
            {privateViewerOptions.length === 0 ? (
              <p className="mt-1 text-xs text-amber-700">
                No additional accounts available. Everyone listed as a
                participant already has access.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

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
