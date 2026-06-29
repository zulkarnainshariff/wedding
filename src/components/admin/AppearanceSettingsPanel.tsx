"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { applyAppThemeToDocument } from "@/lib/apply-app-theme";
import { APP_THEMES, type AppThemeId } from "@/lib/app-theme";

export function AppearanceSettingsPanel({
  initialThemeId,
}: {
  initialThemeId: AppThemeId;
}) {
  const router = useRouter();
  const [themeId, setThemeId] = useState<AppThemeId>(initialThemeId);
  const [savedThemeId, setSavedThemeId] = useState<AppThemeId>(initialThemeId);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    return () => {
      applyAppThemeToDocument(savedThemeId);
    };
  }, [savedThemeId]);

  function selectTheme(nextThemeId: AppThemeId) {
    setThemeId(nextThemeId);
    applyAppThemeToDocument(nextThemeId);
  }

  async function saveTheme() {
    setBusy(true);
    setStatus(null);

    try {
      const response = await fetch("/api/system/app-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ themeId }),
      });

      if (!response.ok) {
        setStatus("Could not save theme.");
        return;
      }

      const data = (await response.json()) as { themeId: AppThemeId };
      setSavedThemeId(data.themeId);
      setThemeId(data.themeId);
      applyAppThemeToDocument(data.themeId);
      setStatus(`Saved ${APP_THEMES[data.themeId].name} for everyone.`);
      router.refresh();
    } catch {
      setStatus("Could not save theme.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-xl text-brand-deep">Appearance</h2>
        <p className="mt-1 text-sm text-stone-500">
          Choose the colour theme used across the itinerary, invitations, and
          sign-in pages for all guests and family members.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Object.values(APP_THEMES).map((theme) => {
          const selected = themeId === theme.id;
          return (
            <button
              key={theme.id}
              type="button"
              onClick={() => selectTheme(theme.id)}
              className={[
                "rounded-2xl border p-4 text-left transition",
                selected
                  ? "border-brand-deep bg-surface-soft ring-2 ring-brand-deep/20"
                  : "border-stone-200 bg-white hover:border-brand/30",
              ].join(" ")}
            >
              <div className="flex items-center gap-2">
                {theme.swatches.map((color) => (
                  <span
                    key={color}
                    className="h-8 w-8 rounded-full border border-black/5 shadow-sm"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <p className="mt-3 font-medium text-stone-900">{theme.name}</p>
              <p className="mt-1 text-sm text-stone-500">{theme.description}</p>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void saveTheme()}
          disabled={busy || themeId === savedThemeId}
          className="rounded-xl bg-brand-deep px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-ink disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save theme"}
        </button>
        {themeId !== savedThemeId ? (
          <p className="text-sm text-stone-500">Unsaved changes</p>
        ) : null}
        {status ? <p className="text-sm text-brand-deep">{status}</p> : null}
      </div>
    </div>
  );
}
