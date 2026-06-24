"use client";

import { useCallback, useEffect, useState } from "react";
import { Plane } from "lucide-react";
import {
  formatFlightDuration,
  formatFlightStatusLabel,
  type FlightLiveStatus,
} from "@/lib/flight-tracking";
import { formatFlightNumberDisplay } from "@/lib/flight-numbers";
import { formatDateTime } from "@/lib/types";

function Row({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-stone-500">{label}</span>
      <span className="text-right font-medium text-stone-800">{value}</span>
    </div>
  );
}

function DepartureGateRow({
  endpoint,
  saved,
}: {
  endpoint?: { terminal?: string | null; gate?: string | null };
  saved?: { terminal?: string | null; gate?: string | null };
}) {
  const terminal = endpoint?.terminal?.trim() || saved?.terminal?.trim();
  const gate = endpoint?.gate?.trim() || saved?.gate?.trim();
  if (!terminal && !gate) return null;

  const value = [
    terminal ? `Terminal ${terminal}` : null,
    gate ? `Gate ${gate}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return <Row label="Departure" value={value} />;
}

export function FlightLiveStatusPanel({
  itemId,
  marketingFlightNumber,
  operatingFlightNumber,
  savedDeparture,
}: {
  itemId: number;
  marketingFlightNumber?: string | null;
  operatingFlightNumber?: string | null;
  savedDeparture?: { terminal?: string | null; gate?: string | null };
}) {
  const [live, setLive] = useState<FlightLiveStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/flights/${itemId}/status`);
      if (response.ok) {
        setLive(await response.json());
      } else {
        setLive({
          available: false,
          reason: "provider_error",
          message: "Unable to load live flight data.",
        });
      }
    } catch {
      setLive({
        available: false,
        reason: "provider_error",
        message: "Unable to load live flight data.",
      });
    } finally {
      setLoading(false);
    }
  }, [itemId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Refresh computed elapsed/remaining from the server cache (no provider calls unless due).
  useEffect(() => {
    if (!live?.available) return;
    const interval = window.setInterval(() => {
      void refresh();
    }, 60 * 1000);
    return () => window.clearInterval(interval);
  }, [live?.available, refresh]);

  if (loading && !live) {
    return (
      <div className="mb-4 rounded-xl border border-sky-100 bg-sky-50/60 px-4 py-3 text-sm text-stone-500">
        Checking live flight status…
      </div>
    );
  }

  if (!live) return null;

  if (!live.available) {
    if (live.reason === "outside_window") return null;
    return (
      <div className="mb-4 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-600">
        {live.message}
      </div>
    );
  }

  const displayNumber = formatFlightNumberDisplay(
    marketingFlightNumber ?? live.marketingFlightNumber,
    operatingFlightNumber ?? live.operatingFlightNumber,
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
              label="Est. arrival"
              value={
                live.arrival?.estimated
                  ? formatDateTime(live.arrival.estimated)
                  : live.arrival?.scheduled
                    ? formatDateTime(live.arrival.scheduled)
                    : null
              }
            />
            <Row
              label="Time remaining"
              value={formatFlightDuration(live.remainingMinutes)}
            />
          </>
        )}
        <DepartureGateRow endpoint={live.departure} saved={savedDeparture} />
        {live.departure?.delayMinutes ? (
          <Row
            label="Departure delay"
            value={`${live.departure.delayMinutes} min`}
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
