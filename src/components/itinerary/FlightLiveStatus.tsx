"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plane } from "lucide-react";
import { useTripTime } from "@/components/itinerary/TripTimeContext";
import { useDisplayFormat } from "@/hooks/useDisplayFormat";
import { getAirportTimezone } from "@/lib/airport-timezones";
import {
  shouldFetchFlightLiveStatus,
  shouldShowSavedFlightGateInfo,
} from "@/lib/flight-live-eligibility";
import {
  formatFlightDuration,
  formatFlightStatusLabel,
  type FlightLiveEndpoint,
} from "@/lib/flight-tracking";
import { formatFlightNumberDisplay, formatJourneyFlightLabel } from "@/lib/flight-numbers";
import {
  flightSegmentsFromDetails,
  resolveTrackingLegEndpoints,
} from "@/lib/flight-segment-timing";
import { getFlightDetails } from "@/lib/types";
import type { ItineraryItem } from "@/lib/schema";
import {
  fetchFlightStatus,
  pollIntervalForStatus,
  type FlightStatusResponse,
} from "@/lib/flight-status-client";

function Row({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-stone-500">{label}</span>
      <span className="text-right font-medium text-stone-800">{value}</span>
    </div>
  );
}

function GateRow({
  label,
  endpoint,
  saved,
}: {
  label: string;
  endpoint?: {
    terminal?: string | null;
    gate?: string | null;
    baggageCarousel?: string | null;
  };
  saved?: { terminal?: string | null; gate?: string | null };
}) {
  const terminal = endpoint?.terminal?.trim() || saved?.terminal?.trim();
  const gate = endpoint?.gate?.trim() || saved?.gate?.trim();
  const baggage = endpoint?.baggageCarousel?.trim();
  if (!terminal && !gate && !baggage) return null;

  const value = [
    terminal ? `Terminal ${terminal}` : null,
    gate ? `Gate ${gate}` : null,
    baggage ? `Baggage ${baggage}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return <Row label={label} value={value} />;
}

function pickEndpointInstant(
  endpoint?: FlightLiveEndpoint,
  preferActual = false,
): string | null {
  if (!endpoint) return null;
  if (preferActual && endpoint.actual) return endpoint.actual;
  return endpoint.actual ?? endpoint.estimated ?? endpoint.scheduled ?? null;
}

function SavedFlightGatePanel({
  marketingFlightNumber,
  operatingFlightNumber,
  savedDeparture,
  savedArrival,
}: {
  marketingFlightNumber?: string | null;
  operatingFlightNumber?: string | null;
  savedDeparture?: { terminal?: string | null; gate?: string | null };
  savedArrival?: { terminal?: string | null; gate?: string | null };
}) {
  const displayNumber = formatFlightNumberDisplay(
    marketingFlightNumber,
    operatingFlightNumber,
  );

  return (
    <div className="mb-4 overflow-hidden rounded-xl border border-stone-200 bg-stone-50">
      <div className="flex items-center gap-2 border-b border-stone-200 px-4 py-3">
        <Plane className="h-4 w-4 text-stone-600" />
        <div>
          <p className="text-xs font-semibold tracking-wide text-stone-600 uppercase">
            Saved gate info
          </p>
          {displayNumber ? (
            <p className="text-sm text-stone-600">{displayNumber}</p>
          ) : null}
        </div>
      </div>
      <div className="space-y-2 px-4 py-3">
        <GateRow label="Departure" saved={savedDeparture} />
        <GateRow label="Arrival" saved={savedArrival} />
        <p className="text-xs text-stone-500">
          Early morning flight — showing saved gate details from the itinerary.
          Live updates appear on the day of travel.
        </p>
      </div>
    </div>
  );
}

export function FlightLiveStatusPanel({
  item,
  itemId,
  marketingFlightNumber,
  operatingFlightNumber,
  savedDeparture,
  savedArrival,
}: {
  item: ItineraryItem;
  itemId: number;
  marketingFlightNumber?: string | null;
  operatingFlightNumber?: string | null;
  savedDeparture?: { terminal?: string | null; gate?: string | null };
  savedArrival?: { terminal?: string | null; gate?: string | null };
}) {
  const { effectiveDate, effectiveDateString } = useTripTime();
  const { formatDateTime, formatInstant } = useDisplayFormat();
  const [live, setLive] = useState<FlightStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchLive = useMemo(
    () => shouldFetchFlightLiveStatus(item, effectiveDate),
    [item, effectiveDate],
  );
  const showSavedOnly = useMemo(
    () => !fetchLive && shouldShowSavedFlightGateInfo(item, effectiveDate),
    [fetchLive, item, effectiveDate],
  );
  const liveFlightLabel = useMemo(() => {
    const details = getFlightDetails(item.details);
    if (!details) return null;
    const segments = flightSegmentsFromDetails(details);
    if (segments.length >= 2) {
      const activeLeg = resolveTrackingLegEndpoints(item, effectiveDate);
      if (activeLeg) {
        const segment = segments[activeLeg.segmentIndex];
        return (
          formatFlightNumberDisplay(
            segment.marketingFlightNumber,
            segment.operatingFlightNumber,
          ) || segment.flightNumber
        );
      }
    }
    return formatJourneyFlightLabel(details);
  }, [item, effectiveDate]);

  const refresh = useCallback(
    async (options?: { force?: boolean; includeSchedule?: boolean }) => {
      if (!fetchLive) return;
      setLoading(true);
      try {
        const data = await fetchFlightStatus(itemId, effectiveDateString, options);
        setLive(data);
      } catch {
        setLive({
          available: false,
          reason: "provider_error",
          message: "Unable to load live flight data.",
        });
      } finally {
        setLoading(false);
      }
    },
    [fetchLive, itemId, effectiveDateString],
  );

  useEffect(() => {
    if (!fetchLive) {
      setLoading(false);
      setLive(null);
      return;
    }
    void refresh({ includeSchedule: true });
  }, [fetchLive, refresh]);

  useEffect(() => {
    if (!fetchLive || !live?.available) return;

    const delayMs = pollIntervalForStatus(live);
    if (!delayMs) return;

    const timer = window.setTimeout(() => {
      void refresh();
    }, delayMs);

    return () => window.clearTimeout(timer);
  }, [fetchLive, live, refresh]);

  if (showSavedOnly) {
    return (
      <SavedFlightGatePanel
        marketingFlightNumber={marketingFlightNumber}
        operatingFlightNumber={operatingFlightNumber}
        savedDeparture={savedDeparture}
        savedArrival={savedArrival}
      />
    );
  }

  if (!fetchLive) return null;

  if (loading && !live) {
    return (
      <div className="mb-4 rounded-xl border border-sky-100 bg-sky-50/60 px-4 py-3 text-sm text-stone-500">
        Checking live flight status…
      </div>
    );
  }

  if (!live) return null;

  if (!live.available) {
    return (
      <div className="mb-4 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-600">
        {live.message}
      </div>
    );
  }

  const displayNumber =
    liveFlightLabel ||
    formatFlightNumberDisplay(
      marketingFlightNumber ?? live.marketingFlightNumber,
      operatingFlightNumber ?? live.operatingFlightNumber,
    );

  const formatLiveTime = (
    iso: string | null | undefined,
    airportIata?: string | null,
  ) =>
    formatInstant(iso, getAirportTimezone(airportIata), {
      airportCode: airportIata,
    });

  const departureTimeLabel =
    live.flightStatus === "scheduled" ? "Scheduled departure" : "Departed";

  const departureTimeValue = formatLiveTime(
    pickEndpointInstant(
      live.departure,
      live.flightStatus === "landed" || live.flightStatus === "active",
    ),
    live.depIata,
  );

  const arrivalTimeLabel =
    live.flightStatus === "landed"
      ? "Arrived"
      : live.flightStatus === "scheduled"
        ? "Scheduled arrival"
        : "Est. arrival";

  const arrivalTimeValue = formatLiveTime(
    pickEndpointInstant(live.arrival, live.flightStatus === "landed"),
    live.arrIata,
  );

  return (
    <div className="mb-4 overflow-hidden rounded-xl border border-sky-200 bg-gradient-to-r from-sky-50 to-white">
      <div className="flex items-center gap-2 border-b border-sky-100 px-4 py-3">
        <Plane className="h-4 w-4 text-sky-700" />
        <div>
          <p className="text-xs font-semibold tracking-wide text-sky-800 uppercase">
            Live flight
          </p>
          <p className="text-sm text-stone-600">
            {displayNumber}
            {live.cached ? " · cached" : ""}
            {live.computedOnly ? " · estimated" : ""}
          </p>
        </div>
      </div>

      <div className="space-y-2 px-4 py-3">
        <Row
          label="Status"
          value={formatFlightStatusLabel(live.flightStatus)}
        />

        {live.flightStatus === "landed" && (
          <Row
            label="Flight time"
            value={formatFlightDuration(live.elapsedMinutes)}
          />
        )}

        {live.flightStatus === "active" && (
          <>
            <Row
              label="Time in air"
              value={formatFlightDuration(live.elapsedMinutes)}
            />
            <Row
              label="Time remaining"
              value={formatFlightDuration(live.remainingMinutes, {
                zeroLabel: "Arriving soon",
              })}
            />
          </>
        )}

        <Row label={departureTimeLabel} value={departureTimeValue} />
        <GateRow
          label="Departure"
          endpoint={live.departure}
          saved={savedDeparture}
        />

        <Row label={arrivalTimeLabel} value={arrivalTimeValue} />
        <GateRow
          label="Arrival"
          endpoint={live.arrival}
          saved={savedArrival}
        />

        {live.departure?.delayMinutes ? (
          <Row
            label="Departure delay"
            value={`${live.departure.delayMinutes} min`}
          />
        ) : null}
        {live.arrival?.delayMinutes ? (
          <Row
            label="Arrival delay"
            value={`${live.arrival.delayMinutes} min`}
          />
        ) : null}

        {live.message && live.computedOnly && (
          <p className="text-xs text-stone-500">{live.message}</p>
        )}
        {live.lastUpdated && (
          <p className="pt-1 text-xs text-stone-400">
            Updated {formatDateTime(live.lastUpdated)}
            {live.detailsUpdated ? " · gate/terminal saved" : ""}
          </p>
        )}
      </div>
    </div>
  );
}
