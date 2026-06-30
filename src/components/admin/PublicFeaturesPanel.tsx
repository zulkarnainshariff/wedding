"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ToastProvider";

type FeatureFlags = {
  guestbookEnabled: boolean;
  photoGalleryEnabled: boolean;
};

export function PublicFeaturesPanel({
  initialFeatures,
}: {
  initialFeatures: FeatureFlags;
}) {
  const router = useRouter();
  const toast = useToast();
  const [features, setFeatures] = useState(initialFeatures);
  const [saved, setSaved] = useState(initialFeatures);
  const [busy, setBusy] = useState(false);

  async function saveFeatures() {
    setBusy(true);
    try {
      const response = await fetch("/api/system/app-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ features }),
      });
      if (!response.ok) {
        toast.error("Could not save public features.");
        return;
      }
      const data = (await response.json()) as { features: FeatureFlags };
      setSaved(data.features);
      setFeatures(data.features);
      toast.success("Public features saved.");
      router.refresh();
    } catch {
      toast.error("Could not save public features.");
    } finally {
      setBusy(false);
    }
  }

  const dirty =
    features.guestbookEnabled !== saved.guestbookEnabled ||
    features.photoGalleryEnabled !== saved.photoGalleryEnabled;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-serif text-lg text-brand-deep">Public features</h3>
        <p className="mt-1 text-sm text-stone-500">
          Enable optional guest-facing pages. Manage content in Admin after
          enabling.
        </p>
      </div>

      <label className="flex items-start gap-3 rounded-xl border border-stone-200 bg-white p-4 text-sm">
        <input
          type="checkbox"
          className="mt-1"
          checked={features.guestbookEnabled}
          onChange={(e) =>
            setFeatures((current) => ({
              ...current,
              guestbookEnabled: e.target.checked,
            }))
          }
        />
        <span>
          <span className="font-medium text-stone-800">Guestbook</span>
          <span className="mt-1 block text-stone-500">
            Public page at <code className="text-xs">/guestbook</code> for
            signed messages. Moderate entries in Admin → Guestbook.
          </span>
        </span>
      </label>

      <label className="flex items-start gap-3 rounded-xl border border-stone-200 bg-white p-4 text-sm">
        <input
          type="checkbox"
          className="mt-1"
          checked={features.photoGalleryEnabled}
          onChange={(e) =>
            setFeatures((current) => ({
              ...current,
              photoGalleryEnabled: e.target.checked,
            }))
          }
        />
        <span>
          <span className="font-medium text-stone-800">Photo gallery</span>
          <span className="mt-1 block text-stone-500">
            Public gallery at <code className="text-xs">/gallery</code>. Add
            photos in Admin → Gallery (or on the gallery page when logged in).
          </span>
        </span>
      </label>

      <button
        type="button"
        disabled={busy || !dirty}
        onClick={() => void saveFeatures()}
        className="rounded-xl bg-brand-deep px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {busy ? "Saving…" : "Save public features"}
      </button>
    </div>
  );
}
