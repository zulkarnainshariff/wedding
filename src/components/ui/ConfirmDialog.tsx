"use client";

import { X } from "lucide-react";

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  busy = false,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      onClick={onClose}
      role="presentation"
    >
      <div className="absolute inset-0 bg-stone-900/45 backdrop-blur-[2px]" />
      <div
        className="relative w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              id="confirm-dialog-title"
              className="font-serif text-xl text-[#1e3a5f]"
            >
              {title}
            </h2>
            <p
              id="confirm-dialog-message"
              className="mt-2 text-sm text-stone-500"
            >
              {message}
            </p>
          </div>
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
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-xl border border-stone-200 px-4 py-2.5 text-sm text-stone-600 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`rounded-xl px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50 ${
              destructive ? "bg-red-600 hover:bg-red-700" : "bg-[#1e3a5f]"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
