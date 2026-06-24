"use client";

import { useOfflineSync } from "@/components/auth/OfflineSyncProvider";

export function SyncStatusBar() {
  const { isOffline, syncing, lastSyncedAt } = useOfflineSync();

  if (!isOffline && !syncing && !lastSyncedAt) return null;

  return (
    <div
      className={[
        "border-b px-4 py-2 text-center text-xs md:px-8",
        isOffline
          ? "border-amber-200 bg-amber-50 text-amber-900"
          : "border-stone-200 bg-stone-50 text-stone-600",
      ].join(" ")}
    >
      {syncing
        ? "Syncing latest itinerary…"
        : isOffline
          ? "Offline — showing the last saved copy from this device."
          : lastSyncedAt
            ? `Saved offline · last synced ${new Date(lastSyncedAt).toLocaleString()}`
            : null}
    </div>
  );
}
