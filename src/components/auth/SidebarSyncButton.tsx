"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useOfflineSync } from "@/components/auth/OfflineSyncProvider";

export function SidebarSyncButton({ compact = false }: { compact?: boolean }) {
  const { syncing, isOffline, lastSyncedAt, syncNow, checkForUpdates } =
    useOfflineSync();
  const [dialog, setDialog] = useState<null | "upToDate" | "confirm">(null);

  async function handleClick() {
    if (isOffline) return;
    const status = await checkForUpdates();
    if (status === "upToDate") {
      setDialog("upToDate");
      return;
    }
    if (status === "updateAvailable") {
      setDialog("confirm");
    }
  }

  const tooltip = lastSyncedAt
    ? `Last synced ${new Date(lastSyncedAt).toLocaleString()}`
    : "Not synced yet";

  return (
    <>
      <button
        type="button"
        onClick={() => void handleClick()}
        disabled={syncing || isOffline}
        title={tooltip}
        className={[
          "flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-stone-600 hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-50",
          compact ? "justify-center px-2" : "",
        ].join(" ")}
      >
        <RefreshCw
          className={[
            "h-5 w-5 shrink-0 text-stone-400",
            syncing ? "animate-spin" : "",
          ].join(" ")}
        />
        {!compact && <span>{isOffline ? "Offline" : "Sync"}</span>}
      </button>

      {dialog === "upToDate" && (
        <Dialog
          title="Already up to date"
          message="Your device already has the latest itinerary."
          onClose={() => setDialog(null)}
        />
      )}

      {dialog === "confirm" && (
        <Dialog
          title="New updates available"
          message="A newer version of the itinerary is available. Sync now?"
          confirmLabel="Sync"
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

function Dialog({
  title,
  message,
  confirmLabel,
  onClose,
  onConfirm,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  onClose: () => void;
  onConfirm?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4">
      <div
        ref={ref}
        className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-6 shadow-xl"
      >
        <h3 className="font-serif text-xl text-[#1e3a5f]">{title}</h3>
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
              onClick={onConfirm}
              className="rounded-lg bg-[#1e3a5f] px-4 py-2 text-sm text-white"
            >
              {confirmLabel ?? "Yes"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
