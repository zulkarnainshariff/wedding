"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  busy = false,
  confirmPhrase,
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
  /** When set, user must type this phrase to enable confirm. */
  confirmPhrase?: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const openedAtRef = useRef(0);
  const [typedPhrase, setTypedPhrase] = useState("");

  useEffect(() => {
    if (open) {
      openedAtRef.current = Date.now();
      setTypedPhrase("");
    }
  }, [open]);

  const phraseMatches =
    !confirmPhrase || typedPhrase.trim() === confirmPhrase.trim();

  if (!open) return null;

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
              className="mt-2 whitespace-pre-wrap text-sm text-stone-500"
            >
              {message}
            </p>
            {confirmPhrase ? (
              <label className="mt-4 block text-sm">
                <span className="mb-1 block font-medium text-stone-700">
                  Type <span className="font-mono">{confirmPhrase}</span> to confirm
                </span>
                <input
                  value={typedPhrase}
                  onChange={(e) => setTypedPhrase(e.target.value)}
                  className="w-full rounded-lg border border-stone-200 px-3 py-2 font-mono text-sm"
                  autoComplete="off"
                  disabled={busy}
                />
              </label>
            ) : null}
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
            disabled={busy || !phraseMatches}
            className={`rounded-xl px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50 ${
              destructive ? "bg-red-600 hover:bg-red-700" : "bg-[#1e3a5f]"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
