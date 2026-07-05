"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { PasswordInput } from "@/components/ui/PasswordInput";

export function AdminElevateDialog({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (password: string) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await onConfirm(password);
    setSubmitting(false);
    if (result.ok) {
      setPassword("");
      setError(null);
      onClose();
      return;
    }
    setError(result.error ?? "Invalid admin password");
  }

  function handleClose() {
    setPassword("");
    setError(null);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      onClick={handleClose}
      role="presentation"
    >
      <div className="absolute inset-0 bg-stone-900/45 backdrop-blur-[2px]" />
      <div
        className="relative w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-elevate-title"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="admin-elevate-title" className="font-serif text-xl text-brand-deep">
              Admin access
            </h2>
            <p className="mt-2 text-sm text-stone-500">
              Enter an admin account password to temporarily gain manage access.
              Your session stays signed in as you.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-2 text-stone-400 hover:bg-stone-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={(event) => void handleSubmit(event)} className="mt-5 space-y-4">
          {error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}
          <div>
            <label
              htmlFor="admin-elevate-password"
              className="mb-1.5 block text-sm font-medium text-stone-700"
            >
              Admin password
            </label>
            <PasswordInput
              value={password}
              onChange={setPassword}
              autoComplete="current-password"
              placeholder="Admin password"
              required
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-xl border border-stone-200 px-4 py-2.5 text-sm text-stone-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !password}
              className="rounded-xl bg-brand-deep px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
            >
              {submitting ? "Verifying…" : "Gain access"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
