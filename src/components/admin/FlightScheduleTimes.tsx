"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import {
  applyFlightStartDatetimeChange,
  copyFlightDepartureDateToArrival,
  type ItemFormState,
} from "@/lib/admin-item-form";
import { resolveAirportCitySync } from "@/lib/airport-cities";
import { airlineInfoFromFlightNumbers, resolveAirlineNameSync } from "@/lib/airlines";
import {
  parseLegacyFlightNumber,
  resolveOperatingFlightNumber,
} from "@/lib/flight-numbers";
import type { FlightScheduleLookupResult } from "@/lib/flight-schedule-lookup";

type FieldErrors = NonNullable<FlightScheduleLookupResult["fieldErrors"]>;

type ScheduleState = {
  loading: boolean;
  manualRequired: boolean;
  message: string | null;
  fieldErrors: FieldErrors;
  lastLookupSucceeded: boolean;
};

const initialScheduleState: ScheduleState = {
  loading: false,
  manualRequired: false,
  message: null,
  fieldErrors: {},
  lastLookupSucceeded: false,
};

function airlineFieldsFromFlightNumber(value: string) {
  const legacy = parseLegacyFlightNumber(value);
  const marketing = legacy.marketing ?? value.trim().toUpperCase();
  const operating = legacy.operating ?? marketing;
  const info = airlineInfoFromFlightNumbers({
    marketingFlightNumber: marketing,
    operatingFlightNumber: operating,
  });

  return {
    marketingFlightNumber: marketing,
    operatingFlightNumber: operating,
    airlineIata: info.airlineIata ?? "",
    airlineName: info.airlineName ?? "",
    operatingAirlineIata: info.operatingAirlineIata ?? "",
    operatingAirlineName: info.operatingAirlineName ?? "",
  };
}

function applyLookupToForm(
  form: ItemFormState,
  lookup: FlightScheduleLookupResult,
): ItemFormState {
  const nextSimple = {
    ...form.structured.simple,
    from: lookup.fromCity ?? form.structured.simple.from,
    to: lookup.toCity ?? form.structured.simple.to,
    fromIata: lookup.fromIata ?? form.structured.simple.fromIata,
    toIata: lookup.toIata ?? form.structured.simple.toIata,
    departureTime: lookup.departureTime ?? form.structured.simple.departureTime,
    arrivalTime: lookup.arrivalTime ?? form.structured.simple.arrivalTime,
    aircraft: lookup.aircraft ?? form.structured.simple.aircraft,
    totalFlightTime: lookup.totalFlightTime ?? form.structured.simple.totalFlightTime,
    departureTerminal:
      lookup.departureTerminal ?? form.structured.simple.departureTerminal,
    departureGate: lookup.departureGate ?? form.structured.simple.departureGate,
    arrivalTerminal:
      lookup.arrivalTerminal ?? form.structured.simple.arrivalTerminal,
    arrivalGate: lookup.arrivalGate ?? form.structured.simple.arrivalGate,
    marketingFlightNumber:
      lookup.marketingFlightNumber ??
      form.structured.simple.marketingFlightNumber,
    operatingFlightNumber:
      lookup.operatingFlightNumber ??
      form.structured.simple.operatingFlightNumber,
    airlineIata: lookup.airlineIata ?? form.structured.simple.airlineIata,
    airlineName: lookup.airlineName ?? form.structured.simple.airlineName,
    operatingAirlineIata:
      lookup.operatingAirlineIata ?? form.structured.simple.operatingAirlineIata,
    operatingAirlineName:
      lookup.operatingAirlineName ?? form.structured.simple.operatingAirlineName,
  };

  return {
    ...form,
    eventDate: lookup.eventDate ?? form.eventDate,
    startDatetime: lookup.departureDatetimeLocal ?? form.startDatetime,
    endDatetime: lookup.arrivalDatetimeLocal ?? form.endDatetime,
    structured: {
      ...form.structured,
      simple: nextSimple,
      segments: lookup.segments ?? form.structured.segments,
    },
  };
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-red-600">{message}</p>;
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
  const lookupAbortRef = useRef<AbortController | null>(null);
  const autoLookupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAutoLookupKeyRef = useRef<string>("");
  const fromIataBeforeEditRef = useRef<string>("");
  const skipInitialAutoLookupRef = useRef(true);

  const setSimple = (key: string, value: string) =>
    setItemForm({
      ...itemForm,
      structured: {
        ...itemForm.structured,
        simple: { ...itemForm.structured.simple, [key]: value },
      },
    });

  const resolveIataField = (endpoint: "from" | "to") => {
    const iataKey = endpoint === "from" ? "fromIata" : "toIata";
    const cityKey = endpoint === "from" ? "from" : "to";
    const code = itemForm.structured.simple[iataKey]?.trim().toUpperCase();
    if (!code || code.length !== 3) return;

    const city = resolveAirportCitySync(code);
    if (!city) {
      setScheduleState((current) => ({
        ...current,
        fieldErrors: {
          ...current.fieldErrors,
          [iataKey]: `Unknown airport code "${code}". Enter the city manually.`,
        },
      }));
      return;
    }

    setSimple(cityKey, city);
    setScheduleState((current) => ({
      ...current,
      fieldErrors: {
        ...current.fieldErrors,
        [iataKey]: undefined,
        [cityKey]: undefined,
      },
    }));
  };

  async function lookupFlight(options?: {
    depIataOverride?: string;
    silent?: boolean;
  }) {
    const operatingFlightNumber = resolveOperatingFlightNumber({
      operatingFlightNumber: itemForm.structured.simple.operatingFlightNumber,
      marketingFlightNumber: itemForm.structured.simple.marketingFlightNumber,
      flightNumber: itemForm.structured.simple.flightNumber,
    });
    const flightDate = itemForm.eventDate?.trim() ?? "";
    const depIata =
      options?.depIataOverride ??
      itemForm.structured.simple.fromIata?.trim() ??
      "";

    if (!operatingFlightNumber || !flightDate) {
      if (!options?.silent) {
        setScheduleState({
          loading: false,
          manualRequired: true,
          message: "Enter a flight number and travel date first.",
          fieldErrors: {},
          lastLookupSucceeded: false,
        });
      }
      return;
    }

    lookupAbortRef.current?.abort();
    const controller = new AbortController();
    lookupAbortRef.current = controller;

    if (!options?.silent) {
      setScheduleState((current) => ({
        ...current,
        loading: true,
        manualRequired: false,
        message: "Looking up flight details…",
        fieldErrors: {},
      }));
    }

    try {
      const response = await fetch("/api/flights/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operatingFlightNumber,
          flightDate,
          depIata: depIata || undefined,
          arrIata: itemForm.structured.simple.toIata || undefined,
        }),
        signal: controller.signal,
      });
      const lookup = (await response.json()) as FlightScheduleLookupResult;

      if (controller.signal.aborted) return;

      if (lookup.available) {
        setItemForm((current) => applyLookupToForm(current, lookup));
        setScheduleState({
          loading: false,
          manualRequired: false,
          message: lookup.message ?? "Flight details loaded.",
          fieldErrors: {},
          lastLookupSucceeded: true,
        });
        return;
      }

      setScheduleState({
        loading: false,
        manualRequired: true,
        message:
          lookup.message ??
          "Could not load this flight automatically. Enter details manually.",
        fieldErrors: lookup.fieldErrors ?? {},
        lastLookupSucceeded: false,
      });
    } catch (error) {
      if (controller.signal.aborted) return;
      if (!options?.silent) {
        setScheduleState({
          loading: false,
          manualRequired: true,
          message:
            "Could not reach the flight schedule API. Enter details manually.",
          fieldErrors: {},
          lastLookupSucceeded: false,
        });
      }
    }
  }

  const operatingFlightNumber = resolveOperatingFlightNumber({
    operatingFlightNumber: itemForm.structured.simple.operatingFlightNumber,
    marketingFlightNumber: itemForm.structured.simple.marketingFlightNumber,
    flightNumber: itemForm.structured.simple.flightNumber,
  });
  const flightDate = itemForm.eventDate?.trim() ?? "";
  const isCodeshare = Boolean(
    itemForm.structured.simple.marketingFlightNumber &&
      itemForm.structured.simple.operatingFlightNumber &&
      itemForm.structured.simple.marketingFlightNumber.trim().toUpperCase() !==
        itemForm.structured.simple.operatingFlightNumber.trim().toUpperCase(),
  );

  useEffect(() => {
    if (!operatingFlightNumber || !flightDate) return;

    const lookupKey = `${operatingFlightNumber}|${flightDate}`;
    if (autoLookupTimerRef.current) clearTimeout(autoLookupTimerRef.current);

    if (skipInitialAutoLookupRef.current) {
      skipInitialAutoLookupRef.current = false;
      lastAutoLookupKeyRef.current = lookupKey;
      return;
    }

    autoLookupTimerRef.current = setTimeout(() => {
      if (lookupKey === lastAutoLookupKeyRef.current) return;
      lastAutoLookupKeyRef.current = lookupKey;
      void lookupFlight({ silent: false });
    }, 600);

    return () => {
      if (autoLookupTimerRef.current) clearTimeout(autoLookupTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- lookup when flight number or date changes
  }, [operatingFlightNumber, flightDate]);

  useEffect(() => {
    return () => {
      lookupAbortRef.current?.abort();
      if (autoLookupTimerRef.current) clearTimeout(autoLookupTimerRef.current);
    };
  }, []);

  const timeInputClass = scheduleState.manualRequired
    ? "w-full rounded-lg border border-red-400 bg-red-50 px-3 py-2 text-red-900 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-300"
    : "w-full rounded-lg border border-stone-200 px-3 py-2";

  const inputErrorClass =
    "w-full rounded-lg border border-red-400 bg-red-50 px-3 py-2 text-red-900";

  return (
    <>
      <label className="block text-sm sm:col-span-2">
        <span className="mb-1 block text-stone-500">Flight number *</span>
        <div className="flex gap-2">
          <input
            required
            value={
              itemForm.structured.simple.operatingFlightNumber ||
              itemForm.structured.simple.marketingFlightNumber
            }
            onChange={(e) => {
              const value = e.target.value.toUpperCase();
              const airlineFields = airlineFieldsFromFlightNumber(value);
              setItemForm({
                ...itemForm,
                structured: {
                  ...itemForm.structured,
                  simple: {
                    ...itemForm.structured.simple,
                    ...airlineFields,
                  },
                },
              });
            }}
            placeholder="e.g. SQ833"
            className="min-w-0 flex-1 rounded-lg border border-stone-200 px-3 py-2"
          />
          <button
            type="button"
            onClick={() => void lookupFlight()}
            disabled={scheduleState.loading}
            title="Look up flight details"
            className="inline-flex shrink-0 items-center justify-center rounded-lg border border-brand-deep bg-brand-deep px-3 py-2 text-white hover:bg-brand-ink disabled:opacity-50"
          >
            {scheduleState.loading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Check className="h-4 w-4" aria-hidden />
            )}
            <span className="sr-only">Look up flight</span>
          </button>
        </div>
        <p className="mt-1 text-xs text-stone-500">
          Enter the flight number and travel date to auto-fill route, times,
          aircraft, and terminals when available.
        </p>
      </label>

      <label className="block text-sm">
        <span className="mb-1 block text-stone-500">Airline code</span>
        <input
          value={itemForm.structured.simple.airlineIata}
          onChange={(e) => setSimple("airlineIata", e.target.value.toUpperCase())}
          onBlur={() => {
            const name = resolveAirlineNameSync(itemForm.structured.simple.airlineIata);
            if (name) setSimple("airlineName", name);
          }}
          maxLength={2}
          placeholder="e.g. SQ"
          className="w-full rounded-lg border border-stone-200 px-3 py-2"
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block text-stone-500">Airline name</span>
        <input
          value={itemForm.structured.simple.airlineName}
          onChange={(e) => setSimple("airlineName", e.target.value)}
          placeholder="e.g. Singapore Airlines"
          className="w-full rounded-lg border border-stone-200 px-3 py-2"
        />
      </label>

      {isCodeshare ? (
        <div className="sm:col-span-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3">
          <p className="mb-2 text-xs font-medium text-amber-900">
            Codeshare — this flight is marketed under one airline but operated by
            another
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block text-stone-600">
                Operating flight number
              </span>
              <input
                value={itemForm.structured.simple.operatingFlightNumber}
                onChange={(e) =>
                  setSimple("operatingFlightNumber", e.target.value.toUpperCase())
                }
                className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-stone-600">
                Operating airline code
              </span>
              <input
                value={itemForm.structured.simple.operatingAirlineIata}
                onChange={(e) =>
                  setSimple("operatingAirlineIata", e.target.value.toUpperCase())
                }
                onBlur={() => {
                  const name = resolveAirlineNameSync(
                    itemForm.structured.simple.operatingAirlineIata,
                  );
                  if (name) setSimple("operatingAirlineName", name);
                }}
                maxLength={2}
                className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-stone-600">
                Operating airline name
              </span>
              <input
                value={itemForm.structured.simple.operatingAirlineName}
                onChange={(e) =>
                  setSimple("operatingAirlineName", e.target.value)
                }
                className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2"
              />
            </label>
          </div>
        </div>
      ) : null}

      <label className="block text-sm sm:col-span-2">
        <span className="mb-1 block text-stone-500">Travel date *</span>
        <input
          type="date"
          required
          value={itemForm.eventDate}
          onChange={(e) => setItemForm({ ...itemForm, eventDate: e.target.value })}
          className="w-full rounded-lg border border-stone-200 px-3 py-2"
        />
      </label>

      {scheduleState.message ? (
        <p
          className={[
            "sm:col-span-2 text-xs",
            scheduleState.manualRequired ? "text-red-700" : "text-stone-500",
          ].join(" ")}
        >
          {scheduleState.message}
        </p>
      ) : null}

      <label className="block text-sm">
        <span className="mb-1 block text-stone-500">From airport (IATA)</span>
        <input
          value={itemForm.structured.simple.fromIata}
          onFocus={() => {
            fromIataBeforeEditRef.current =
              itemForm.structured.simple.fromIata?.trim().toUpperCase() ?? "";
          }}
          onChange={(e) => setSimple("fromIata", e.target.value.toUpperCase())}
          onBlur={(e) => {
            resolveIataField("from");
            const next = e.currentTarget.value.trim().toUpperCase();
            const prev = fromIataBeforeEditRef.current;
            if (
              next &&
              next !== prev &&
              scheduleState.lastLookupSucceeded &&
              operatingFlightNumber &&
              flightDate
            ) {
              void lookupFlight({ depIataOverride: next });
            }
          }}
          maxLength={3}
          className={
            scheduleState.fieldErrors.fromIata
              ? inputErrorClass
              : "w-full rounded-lg border border-stone-200 px-3 py-2"
          }
        />
        <FieldError message={scheduleState.fieldErrors.fromIata} />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block text-stone-500">From (city)</span>
        <input
          value={itemForm.structured.simple.from}
          onChange={(e) => setSimple("from", e.target.value)}
          className={
            scheduleState.fieldErrors.from
              ? inputErrorClass
              : "w-full rounded-lg border border-stone-200 px-3 py-2"
          }
        />
        <FieldError message={scheduleState.fieldErrors.from} />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block text-stone-500">To airport (IATA)</span>
        <input
          value={itemForm.structured.simple.toIata}
          onChange={(e) => setSimple("toIata", e.target.value.toUpperCase())}
          onBlur={() => resolveIataField("to")}
          maxLength={3}
          className={
            scheduleState.fieldErrors.toIata
              ? inputErrorClass
              : "w-full rounded-lg border border-stone-200 px-3 py-2"
          }
        />
        <FieldError message={scheduleState.fieldErrors.toIata} />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block text-stone-500">To (city)</span>
        <input
          value={itemForm.structured.simple.to}
          onChange={(e) => setSimple("to", e.target.value)}
          className={
            scheduleState.fieldErrors.to
              ? inputErrorClass
              : "w-full rounded-lg border border-stone-200 px-3 py-2"
          }
        />
        <FieldError message={scheduleState.fieldErrors.to} />
      </label>

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
        />
      </div>

      <label className="block text-sm">
        <span className="mb-1 block text-stone-500">Aircraft</span>
        <input
          value={itemForm.structured.simple.aircraft}
          onChange={(e) => setSimple("aircraft", e.target.value)}
          className="w-full rounded-lg border border-stone-200 px-3 py-2"
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block text-stone-500">Total flight time</span>
        <input
          value={itemForm.structured.simple.totalFlightTime}
          onChange={(e) => setSimple("totalFlightTime", e.target.value)}
          className="w-full rounded-lg border border-stone-200 px-3 py-2"
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block text-stone-500">Departure terminal</span>
        <input
          value={itemForm.structured.simple.departureTerminal}
          onChange={(e) => setSimple("departureTerminal", e.target.value)}
          className="w-full rounded-lg border border-stone-200 px-3 py-2"
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block text-stone-500">Departure gate</span>
        <input
          value={itemForm.structured.simple.departureGate}
          onChange={(e) => setSimple("departureGate", e.target.value)}
          className="w-full rounded-lg border border-stone-200 px-3 py-2"
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block text-stone-500">Arrival terminal</span>
        <input
          value={itemForm.structured.simple.arrivalTerminal}
          onChange={(e) => setSimple("arrivalTerminal", e.target.value)}
          className="w-full rounded-lg border border-stone-200 px-3 py-2"
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block text-stone-500">Arrival gate</span>
        <input
          value={itemForm.structured.simple.arrivalGate}
          onChange={(e) => setSimple("arrivalGate", e.target.value)}
          className="w-full rounded-lg border border-stone-200 px-3 py-2"
        />
      </label>
    </>
  );
}
