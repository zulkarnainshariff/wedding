"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  applyFlightStartDatetimeChange,
  copyFlightDepartureDateToArrival,
  type ItemFormState,
} from "@/lib/admin-item-form";
import { resolveOperatingFlightNumber } from "@/lib/flight-numbers";
import type { FlightScheduleLookupResult } from "@/lib/flight-schedule-lookup";

type ScheduleState = {
  loading: boolean;
  manualRequired: boolean;
  message: string | null;
};

const initialScheduleState: ScheduleState = {
  loading: false,
  manualRequired: false,
  message: null,
};

function applyLookupToForm(
  form: ItemFormState,
  lookup: FlightScheduleLookupResult,
): ItemFormState {
  const nextSimple = {
    ...form.structured.simple,
    fromIata: lookup.fromIata ?? form.structured.simple.fromIata,
    toIata: lookup.toIata ?? form.structured.simple.toIata,
    departureTime: lookup.departureTime ?? form.structured.simple.departureTime,
    arrivalTime: lookup.arrivalTime ?? form.structured.simple.arrivalTime,
  };

  return {
    ...form,
    eventDate: lookup.eventDate ?? form.eventDate,
    startDatetime: lookup.departureDatetimeLocal ?? form.startDatetime,
    endDatetime: lookup.arrivalDatetimeLocal ?? form.endDatetime,
    structured: {
      ...form.structured,
      simple: nextSimple,
    },
  };
}

export function FlightScheduleTimes({
  itemForm,
  setItemForm,
}: {
  itemForm: ItemFormState;
  setItemForm: React.Dispatch<React.SetStateAction<ItemFormState>>;
}) {
  const [scheduleState, setScheduleState] =
    useState<ScheduleState>(initialScheduleState);
  const requestIdRef = useRef(0);

  const operatingFlightNumber = resolveOperatingFlightNumber({
    operatingFlightNumber: itemForm.structured.simple.operatingFlightNumber,
    marketingFlightNumber: itemForm.structured.simple.marketingFlightNumber,
    flightNumber: itemForm.structured.simple.flightNumber,
  });
  const flightDate = itemForm.eventDate?.trim() ?? "";
  const depIata = itemForm.structured.simple.fromIata?.trim() ?? "";
  const arrIata = itemForm.structured.simple.toIata?.trim() ?? "";

  useEffect(() => {
    if (itemForm.category !== "flight") return;

    if (!operatingFlightNumber || !flightDate) {
      setScheduleState(initialScheduleState);
      return;
    }

    const requestId = ++requestIdRef.current;
    const timer = window.setTimeout(() => {
      setScheduleState((current) => ({
        ...current,
        loading: true,
        message: "Looking up flight times…",
      }));

      void fetch("/api/flights/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operatingFlightNumber,
          flightDate,
          depIata: depIata || undefined,
          arrIata: arrIata || undefined,
        }),
      })
        .then(async (response) => {
          const lookup = (await response.json()) as FlightScheduleLookupResult;
          if (requestId !== requestIdRef.current) return;

          if (lookup.available) {
            setItemForm((current) => applyLookupToForm(current, lookup));
            setScheduleState({
              loading: false,
              manualRequired: false,
              message: lookup.message ?? "Times loaded from flight schedule.",
            });
            return;
          }

          setScheduleState({
            loading: false,
            manualRequired: true,
            message:
              lookup.message ??
              "Enter departure and arrival times manually below.",
          });
        })
        .catch(() => {
          if (requestId !== requestIdRef.current) return;
          setScheduleState({
            loading: false,
            manualRequired: true,
            message:
              "Could not reach the flight schedule API. Enter times manually below.",
          });
        });
    }, 450);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    arrIata,
    depIata,
    flightDate,
    itemForm.category,
    operatingFlightNumber,
    setItemForm,
  ]);

  const timeInputClass = scheduleState.manualRequired
    ? "w-full rounded-lg border border-red-400 bg-red-50 px-3 py-2 text-red-900 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-300"
    : "w-full rounded-lg border border-stone-200 px-3 py-2";

  return (
    <>
      <label className="block text-sm sm:col-span-2">
        <span className="mb-1 block text-stone-500">
          Operating flight number (for tracking) *
        </span>
        <input
          required
          value={itemForm.structured.simple.operatingFlightNumber}
          onChange={(e) =>
            setItemForm({
              ...itemForm,
              structured: {
                ...itemForm.structured,
                simple: {
                  ...itemForm.structured.simple,
                  operatingFlightNumber: e.target.value.toUpperCase(),
                },
              },
            })
          }
          placeholder="e.g. QF123"
          className="w-full rounded-lg border border-stone-200 px-3 py-2"
        />
      </label>

      <label className="block text-sm sm:col-span-2">
        <span className="mb-1 block text-stone-500">Travel date *</span>
        <input
          type="date"
          required
          value={itemForm.eventDate}
          onChange={(e) => setItemForm({ ...itemForm, eventDate: e.target.value })}
          className="w-full rounded-lg border border-stone-200 px-3 py-2"
        />
        <p className="mt-1 text-xs text-stone-500">
          Departure and arrival times are filled automatically from the schedule
          API when both fields above are set.
        </p>
      </label>

      {scheduleState.message ? (
        <p
          className={[
            "sm:col-span-2 text-xs",
            scheduleState.manualRequired ? "text-red-700" : "text-stone-500",
          ].join(" ")}
        >
          {scheduleState.loading ? (
            <span className="inline-flex items-center gap-1.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              {scheduleState.message}
            </span>
          ) : (
            scheduleState.message
          )}
        </p>
      ) : null}

      <label className="block text-sm">
        <span className="mb-1 block text-stone-500">
          {`Departs${itemForm.structured.simple.fromIata ? ` (${itemForm.structured.simple.fromIata})` : ""} — airport local`}
        </span>
        <input
          type="datetime-local"
          value={itemForm.startDatetime}
          onChange={(e) =>
            setItemForm(applyFlightStartDatetimeChange(itemForm, e.target.value))
          }
          className={timeInputClass}
          aria-invalid={scheduleState.manualRequired}
        />
      </label>

      <div className="block text-sm">
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="text-stone-500">
            {`Arrives${itemForm.structured.simple.toIata ? ` (${itemForm.structured.simple.toIata})` : ""} — airport local`}
          </span>
          {itemForm.startDatetime ? (
            <button
              type="button"
              onClick={() =>
                setItemForm(copyFlightDepartureDateToArrival(itemForm))
              }
              className="text-xs text-sky-700 hover:underline"
            >
              Copy departure date
            </button>
          ) : null}
        </div>
        <input
          type="datetime-local"
          value={itemForm.endDatetime}
          onChange={(e) =>
            setItemForm({ ...itemForm, endDatetime: e.target.value })
          }
          className={timeInputClass}
          aria-invalid={scheduleState.manualRequired}
        />
      </div>

      {scheduleState.manualRequired ? (
        <p className="sm:col-span-2 text-xs text-red-700">
          Schedule times could not be loaded — enter departure and arrival times
          manually in the fields above.
        </p>
      ) : (
        <p className="sm:col-span-2 text-xs text-stone-500">
          Departure and arrival times use each airport&apos;s local timezone
          (from the IATA codes in flight details), not your device timezone.
        </p>
      )}
    </>
  );
}
