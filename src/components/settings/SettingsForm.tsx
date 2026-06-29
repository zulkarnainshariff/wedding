"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import type { UserPreferences } from "@/lib/user-preferences";
import { PasswordInput } from "@/components/ui/PasswordInput";

export function SettingsForm({
  initialPreferences,
}: {
  initialPreferences: UserPreferences;
}) {
  const router = useRouter();
  const { refreshUser } = useAuth();
  const [preferences, setPreferences] = useState(initialPreferences);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function savePreferences() {
    setSaving(true);
    setError(null);
    setMessage(null);
    const response = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ preferences }),
    });
    setSaving(false);
    if (!response.ok) {
      setError("Could not save preferences.");
      return;
    }
    const data = await response.json();
    setPreferences(data.preferences);
    setMessage("Preferences saved.");
    await refreshUser();
    router.refresh();
  }

  async function changePassword() {
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    const response = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    setSaving(false);
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? "Could not change password.");
      return;
    }
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setMessage("Password updated.");
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col space-y-8">
      {message && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {message}
        </p>
      )}
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm space-y-4">
        <h2 className="font-serif text-xl text-brand-deep">Display preferences</h2>
        <label className="block text-sm">
          <span className="mb-1 block text-stone-500">Units</span>
          <select
            value={preferences.units}
            onChange={(e) =>
              setPreferences({
                ...preferences,
                units: e.target.value as UserPreferences["units"],
              })
            }
            className="w-full rounded-lg border border-stone-200 px-3 py-2"
          >
            <option value="metric">Metric (kg)</option>
            <option value="imperial">Imperial (lb)</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-stone-500">Date format</span>
          <select
            value={preferences.dateFormat}
            onChange={(e) =>
              setPreferences({
                ...preferences,
                dateFormat: e.target.value as UserPreferences["dateFormat"],
              })
            }
            className="w-full rounded-lg border border-stone-200 px-3 py-2"
          >
            <option value="dmy">DD-MM-YYYY</option>
            <option value="mdy">MM-DD-YYYY</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-stone-500">Time format</span>
          <select
            value={preferences.timeFormat}
            onChange={(e) =>
              setPreferences({
                ...preferences,
                timeFormat: e.target.value as UserPreferences["timeFormat"],
              })
            }
            className="w-full rounded-lg border border-stone-200 px-3 py-2"
          >
            <option value="24h">24-hour</option>
            <option value="12h">12-hour</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-stone-700">
          <input
            type="checkbox"
            checked={preferences.hidePastDays}
            onChange={(e) =>
              setPreferences({
                ...preferences,
                hidePastDays: e.target.checked,
              })
            }
            className="h-4 w-4 rounded border-stone-300"
          />
          Hide past days in itinerary views
        </label>
        <button
          type="button"
          disabled={saving}
          onClick={() => void savePreferences()}
          className="rounded-lg bg-brand-deep px-4 py-2 text-sm font-medium text-white"
        >
          Save preferences
        </button>
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm space-y-4">
        <h2 className="font-serif text-xl text-brand-deep">Change password</h2>
        <label className="block text-sm">
          <span className="mb-1 block text-stone-500">Current password</span>
          <PasswordInput
            value={currentPassword}
            onChange={setCurrentPassword}
            className="w-full rounded-lg border border-stone-200 px-3 py-2 pr-11"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-stone-500">New password</span>
          <PasswordInput
            value={newPassword}
            onChange={setNewPassword}
            className="w-full rounded-lg border border-stone-200 px-3 py-2 pr-11"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-stone-500">Confirm new password</span>
          <PasswordInput
            value={confirmPassword}
            onChange={setConfirmPassword}
            className="w-full rounded-lg border border-stone-200 px-3 py-2 pr-11"
          />
        </label>
        <button
          type="button"
          disabled={saving || !currentPassword || !newPassword}
          onClick={() => void changePassword()}
          className="rounded-lg bg-brand-deep px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Update password
        </button>
      </section>
    </div>
  );
}
