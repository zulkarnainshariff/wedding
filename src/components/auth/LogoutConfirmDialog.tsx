"use client";

import { X } from "lucide-react";

export function LogoutConfirmDialog({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      onClick={onClose}
      role="presentation"
    >
      <div className="absolute inset-0 bg-stone-900/45 backdrop-blur-[2px]" />
      <div
        className="relative w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="logout-title"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="logout-title" className="font-serif text-xl text-[#1e3a5f]">
              Log out?
            </h2>
            <p className="mt-2 text-sm text-stone-500">
              You will need to sign in again to view the itinerary.
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
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-stone-200 px-4 py-2.5 text-sm text-stone-600"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-xl bg-[#1e3a5f] px-4 py-2.5 text-sm font-medium text-white"
          >
            Log out
          </button>
        </div>
      </div>
    </div>
  );
}
