"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, X } from "lucide-react";
import { formatTravellerLabel } from "@/lib/types";

export function FlightCheckInDialog({
  open,
  title,
  passengers,
  seatDraft,
  onSeatDraftChange,
  checkedIn,
  busy = false,
  onClose,
  onConfirm,
  onClear,
}: {
  open: boolean;
  title: string;
  passengers: string[];
  seatDraft: Record<string, string>;
  onSeatDraftChange: (next: Record<string, string>) => void;
  checkedIn: boolean;
  busy?: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onClear?: () => void;
}) {
  const openedAtRef = useRef(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) {
      openedAtRef.current = Date.now();
    }
  }, [open]);

  if (!open || !mounted) return null;

  function handleBackdropClose() {
    if (Date.now() - openedAtRef.current < 200) return;
    if (!busy) onClose();
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          handleBackdropClose();
        }
      }}
      role="presentation"
    >
      <div className="absolute inset-0 bg-stone-900/45 backdrop-blur-[2px]" />
      <div
        className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-stone-200 bg-white p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="flight-check-in-title"
      >
        <div className="flex items-start justify-between gap-4">
          <h2
            id="flight-check-in-title"
            className="font-serif text-xl text-brand-deep"
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg p-2 text-stone-400 hover:bg-stone-100 disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
            <p className="text-sm text-amber-950">
              {"This does "}
              <strong>not check you in</strong>
              {" with the airline. You still need to complete check-in on the airline's website or app. Use this only as a group reference to note that check-in is done and to record seat numbers."}
            </p>
          </div>
        </div>

        {passengers.length === 0 ? (
          <p className="mt-4 text-sm text-stone-500">
            No passengers are listed on this flight yet.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            <p className="text-sm font-medium text-stone-700">Seat numbers</p>
            {passengers.map((name) => (
              <label key={name} className="block text-sm">
                <span className="mb-1 block text-stone-500">
                  {formatTravellerLabel(name)}
                </span>
                <input
                  value={seatDraft[name] ?? ""}
                  onChange={(event) =>
                    onSeatDraftChange({
                      ...seatDraft,
                      [name]: event.target.value.toUpperCase(),
                    })
                  }
                  placeholder="e.g. 24A"
                  disabled={busy}
                  className="w-full rounded-lg border border-stone-200 px-3 py-2"
                />
              </label>
            ))}
          </div>
        )}

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          {checkedIn && onClear ? (
            <button
              type="button"
              onClick={onClear}
              disabled={busy}
              className="mr-auto rounded-xl border border-red-200 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              Clear check-in
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-xl border border-stone-200 px-4 py-2.5 text-sm text-stone-600 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy || passengers.length === 0}
            className="rounded-xl bg-brand-deep px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy
              ? "Saving…"
              : checkedIn
                ? "Save seats"
                : "Save check-in"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
