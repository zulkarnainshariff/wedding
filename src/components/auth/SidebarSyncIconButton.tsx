"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useOfflineSync } from "@/components/auth/OfflineSyncProvider";
import { IconTooltip } from "@/components/ui/IconTooltip";

export function SidebarSyncIconButton() {
  const { syncing, isOffline, lastSyncedAt, syncNow, checkForUpdates } =
    useOfflineSync();
  const [dialog, setDialog] = useState<null | "upToDate" | "confirm">(null);
  const [checking, setChecking] = useState(false);

  const busy = syncing || checking;

  const tooltip = busy
    ? "Syncing…"
    : lastSyncedAt
      ? `Last synced ${new Date(lastSyncedAt).toLocaleString()}`
      : "Sync itinerary";

  const handleClick = useCallback(async () => {
    if (isOffline || busy) return;
    setChecking(true);
    try {
      const status = await checkForUpdates();
      if (status === "upToDate") {
        setDialog("upToDate");
        return;
      }
      if (status === "updateAvailable") {
        setDialog("confirm");
      }
    } finally {
      setChecking(false);
    }
  }, [busy, checkForUpdates, isOffline]);

  return (
    <>
      <IconTooltip label={tooltip}>
        <button
          type="button"
          onClick={() => void handleClick()}
          disabled={busy || isOffline}
          aria-label={isOffline ? "Offline" : busy ? "Syncing" : "Sync itinerary"}
          className="shrink-0 rounded-lg p-1.5 text-stone-500 hover:bg-stone-200/80 hover:text-stone-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw
            className={["h-4 w-4", busy ? "animate-spin text-sky-600" : ""].join(" ")}
          />
        </button>
      </IconTooltip>

      {dialog === "upToDate" && (
        <SyncDialog
          title="Already up to date"
          message="Your device already has the latest itinerary."
          onClose={() => setDialog(null)}
        />
      )}

      {dialog === "confirm" && (
        <SyncDialog
          title="New updates available"
          message="A newer version of the itinerary is available. Sync now?"
          confirmLabel={syncing ? "Syncing…" : "Sync"}
          confirmDisabled={syncing}
          onClose={() => setDialog(null)}
          onConfirm={async () => {
            await syncNow();
            setDialog(null);
          }}
        />
      )}
    </>
  );
}

function SyncDialog({
  title,
  message,
  confirmLabel,
  confirmDisabled = false,
  onClose,
  onConfirm,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  confirmDisabled?: boolean;
  onClose: () => void;
  onConfirm?: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-6 shadow-xl">
        <h3 className="font-serif text-xl text-brand-deep">{title}</h3>
        <p className="mt-2 text-sm text-stone-600">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-stone-200 px-4 py-2 text-sm"
          >
            {onConfirm ? "No" : "OK"}
          </button>
          {onConfirm && (
            <button
              type="button"
              disabled={confirmDisabled}
              onClick={onConfirm}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-deep px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {confirmDisabled && (
                <RefreshCw className="h-4 w-4 animate-spin" aria-hidden />
              )}
              {confirmLabel ?? "Yes"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
