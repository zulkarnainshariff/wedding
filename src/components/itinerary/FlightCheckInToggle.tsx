"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Check, Ticket } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { useOfflineSync } from "@/components/auth/OfflineSyncProvider";
import { FlightCheckInDialog } from "@/components/itinerary/FlightCheckInDialog";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useItineraryUI } from "@/components/itinerary/ItineraryUIContext";
import {
  getFlightPassengers,
  isFlightCheckInReminderDue,
  isFlightFullyCheckedIn,
  isFlightPartiallyCheckedIn,
} from "@/lib/flight-check-in";
import {
  initialSegmentSeatDraft,
  segmentRouteLabel,
  usesPerSegmentSeats,
  type SegmentSeatDraft,
} from "@/lib/flight-seats";
import type { ItineraryItem } from "@/lib/schema";
import { getFlightDetails } from "@/lib/types";
import { flightSegmentsFromDetails } from "@/lib/flight-segment-timing";

function initialSeatDraft(
  passengers: string[],
  seats?: Record<string, string | null>,
): Record<string, string> {
  return Object.fromEntries(
    passengers.map((name) => [name, seats?.[name]?.trim() ?? ""]),
  );
}

export function FlightCheckInBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-sky-800 uppercase ${className}`}
    >
      <Check className="h-3 w-3" strokeWidth={3} />
      Checked in
    </span>
  );
}

export function FlightCheckInReminderPill({
  item,
  className = "",
}: {
  item: ItineraryItem;
  className?: string;
}) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (item.category !== "flight") return;

    const tick = () => setShow(isFlightCheckInReminderDue(item));
    tick();
    const interval = window.setInterval(tick, 60_000);
    return () => window.clearInterval(interval);
  }, [item]);

  if (!show) return null;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-amber-900 uppercase ${className}`}
    >
      <Ticket className="h-3 w-3" strokeWidth={2.5} />
      Check in
    </span>
  );
}

export function FlightCheckInToggle({
  item,
  compact = false,
}: {
  item: ItineraryItem;
  compact?: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const { canEdit } = useAuth();
  const { refreshSelectedItem, selectedItemId } = useItineraryUI();
  const { syncNow } = useOfflineSync();
  const [busy, setBusy] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

  const flightDetails = getFlightDetails(item.details);
  const passengers = useMemo(
    () => getFlightPassengers(getFlightDetails(item.details)),
    [item.details],
  );
  const fullyCheckedIn = isFlightFullyCheckedIn(flightDetails);
  const partiallyCheckedIn = isFlightPartiallyCheckedIn(flightDetails);

  const [seatDraft, setSeatDraft] = useState<Record<string, string>>({});
  const [segmentSeatDraft, setSegmentSeatDraft] = useState<SegmentSeatDraft>({});
  const perSegmentSeats = usesPerSegmentSeats(flightDetails);
  const segmentLegs = perSegmentSeats
    ? flightSegmentsFromDetails(flightDetails).map((segment, index) => ({
        index,
        label: segmentRouteLabel(segment),
      }))
    : [];

  if (item.category !== "flight" || passengers.length === 0) {
    return null;
  }

  async function saveCheckIn(checkedIn: boolean) {
    if (!canEdit || busy) return;

    setBusy(true);
    try {
      const response = await fetch(`/api/items/${item.id}/check-in`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkedIn,
          seats: seatDraft,
          segmentSeats: perSegmentSeats ? segmentSeatDraft : undefined,
        }),
      });

      if (!response.ok) return;

      setDialogOpen(false);
      setConfirmClearOpen(false);

      if (selectedItemId === item.id) {
        await refreshSelectedItem({ silent: true });
      }

      await syncNow();

      startTransition(() => {
        router.refresh();
      });
    } finally {
      setBusy(false);
    }
  }

  function handleClick(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (!canEdit || busy) return;
    setSeatDraft(initialSeatDraft(passengers, flightDetails?.seats));
    setSegmentSeatDraft(initialSegmentSeatDraft(flightDetails, passengers));
    setDialogOpen(true);
  }

  if (!canEdit) {
    return fullyCheckedIn || partiallyCheckedIn ? <FlightCheckInBadge /> : null;
  }

  const dialog = (
    <>
      <FlightCheckInDialog
        open={dialogOpen}
        title={fullyCheckedIn ? "Update check-in reference" : "Record check-in"}
        passengers={passengers}
        seatDraft={seatDraft}
        onSeatDraftChange={setSeatDraft}
        segmentSeatDraft={segmentSeatDraft}
        onSegmentSeatDraftChange={setSegmentSeatDraft}
        segmentLegs={segmentLegs}
        checkedIn={fullyCheckedIn}
        busy={busy}
        onClose={() => {
          if (!busy) setDialogOpen(false);
        }}
        onConfirm={() => void saveCheckIn(true)}
        onClear={
          fullyCheckedIn
            ? () => {
                setConfirmClearOpen(true);
              }
            : undefined
        }
      />
      <ConfirmDialog
        open={confirmClearOpen}
        title="Clear check-in reference?"
        message="This removes the checked-in status for everyone on this flight. Seat numbers will stay as they are."
        confirmLabel="Clear check-in"
        destructive
        busy={busy}
        onClose={() => {
          if (!busy) setConfirmClearOpen(false);
        }}
        onConfirm={() => void saveCheckIn(false)}
      />
    </>
  );

  if (compact) {
    return (
      <>
        <button
          type="button"
          onClick={handleClick}
          disabled={busy}
          aria-label={
            fullyCheckedIn ? "Update check-in reference" : "Record check-in"
          }
          title={fullyCheckedIn ? "Checked in" : "Record check-in"}
          className={[
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-all",
            fullyCheckedIn
              ? "border-sky-500 bg-sky-500 text-white shadow-sm shadow-sky-500/30"
              : partiallyCheckedIn
                ? "border-sky-300 bg-sky-50 text-sky-700"
                : "border-stone-200 bg-white text-stone-400 hover:border-sky-400 hover:text-sky-600",
            busy ? "opacity-60" : "",
          ].join(" ")}
        >
          {fullyCheckedIn ? (
            <Check className="h-4 w-4" strokeWidth={3} />
          ) : (
            <Ticket className="h-4 w-4" strokeWidth={2} />
          )}
        </button>
        {dialog}
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        aria-label={
          fullyCheckedIn ? "Update check-in reference" : "Record check-in"
        }
        className={[
          "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-all",
          fullyCheckedIn
            ? "border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100"
            : partiallyCheckedIn
              ? "border-sky-200 bg-sky-50/70 text-sky-700 hover:bg-sky-100"
              : "border-stone-200 bg-white text-stone-600 hover:border-sky-300 hover:text-sky-700",
          busy ? "opacity-60" : "",
        ].join(" ")}
      >
        <span
          className={[
            "flex h-5 w-5 items-center justify-center rounded-full border-2",
            fullyCheckedIn
              ? "border-sky-500 bg-sky-500 text-white"
              : partiallyCheckedIn
                ? "border-sky-400 bg-sky-100 text-sky-700"
                : "border-stone-300 bg-white text-stone-400",
          ].join(" ")}
        >
          {fullyCheckedIn ? (
            <Check className="h-3 w-3" strokeWidth={3} />
          ) : (
            <Ticket className="h-3 w-3" strokeWidth={2} />
          )}
        </span>
        {fullyCheckedIn ? "Checked in" : "Check in"}
      </button>
      {dialog}
    </>
  );
}
