"use client";

import { X } from "lucide-react";
import { useTripTime } from "@/components/itinerary/TripTimeContext";
import { useDisplayFormat } from "@/hooks/useDisplayFormat";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function DevModeModal({ open, onClose }: Props) {
  const {
    devMode,
    setDevMode,
    simulatedDate,
    setSimulatedDate,
    resetSimulatedDate,
    effectiveDateString,
  } = useTripTime();
  const { formatDateOnly } = useDisplayFormat();

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
      role="presentation"
    >
      <div className="absolute inset-0 bg-stone-900/45 backdrop-blur-[2px]" />

      <div
        className="relative w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dev-mode-title"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              id="dev-mode-title"
              className="font-serif text-xl text-brand-deep"
            >
              Dev mode
            </h2>
            <p className="mt-1 text-sm text-stone-500">
              Simulate a different &ldquo;today&rdquo; for trip progress and
              filtering while developing.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-stone-400 hover:bg-stone-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-xl border border-stone-200 px-4 py-3 hover:bg-stone-50">
          <input
            type="checkbox"
            checked={devMode}
            onChange={(event) => setDevMode(event.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-stone-300"
          />
          <span>
            <span className="block text-sm font-medium text-stone-800">
              Enable dev mode
            </span>
            <span className="mt-0.5 block text-xs text-stone-500">
              When off, the app uses the real system date.
            </span>
          </span>
        </label>

        {devMode && (
          <div className="mt-4 space-y-4 rounded-xl border border-amber-200 bg-amber-50/60 p-4">
            <label className="block text-sm">
              <span className="mb-1.5 block font-medium text-stone-700">
                Simulated date
              </span>
              <input
                type="date"
                value={simulatedDate}
                onChange={(event) => setSimulatedDate(event.target.value)}
                className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2"
              />
            </label>

            <p className="text-sm text-stone-600">
              App is treating today as{" "}
              <span className="font-medium text-brand-deep">
                {formatDateOnly(effectiveDateString)}
              </span>
              .
            </p>

            <button
              type="button"
              onClick={resetSimulatedDate}
              className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-600 hover:bg-stone-50"
            >
              Reset to real today
            </button>
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-brand-deep px-4 py-2.5 text-sm font-medium text-white"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
