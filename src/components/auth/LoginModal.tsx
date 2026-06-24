"use client";

import { Suspense } from "react";
import { X } from "lucide-react";
import { LoginForm } from "./LoginForm";

export function LoginModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
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
        className="relative w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-modal-title"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 rounded-lg p-2 text-stone-400 hover:bg-stone-100"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
        <Suspense fallback={<p className="py-8 text-center text-sm text-stone-500">Loading…</p>}>
          <LoginForm variant="modal" onSuccess={onClose} />
        </Suspense>
      </div>
    </div>
  );
}
