"use client";

import { useEffect, useState, useTransition } from "react";
import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { useOfflineSync } from "@/components/auth/OfflineSyncProvider";
import { useItineraryUI } from "@/components/itinerary/ItineraryUIContext";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { getItemCompletion, isItemCompleted } from "@/lib/item-completion";
import type { ItineraryItem } from "@/lib/schema";

export type ItemDoneAccent = "emerald" | "amber";

const ACCENT = {
  emerald: {
    badge: "bg-emerald-100 text-emerald-800",
    compactDone:
      "border-emerald-500 bg-emerald-500 text-white shadow-sm shadow-emerald-500/30",
    compactIdle:
      "border-stone-200 bg-white text-stone-300 hover:border-emerald-400 hover:text-emerald-500",
    fullDone: "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100",
    fullIdle:
      "border-stone-200 bg-white text-stone-600 hover:border-emerald-300 hover:text-emerald-700",
    fullCheckDone: "border-emerald-500 bg-emerald-500 text-white",
    fullCheckIdle: "border-stone-300 bg-white text-transparent",
    meta: "text-emerald-700/70",
  },
  amber: {
    badge: "bg-amber-100 text-amber-800",
    compactDone:
      "border-amber-500 bg-amber-500 text-white shadow-sm shadow-amber-500/30",
    compactIdle:
      "border-amber-400 bg-amber-50 text-amber-600 hover:border-amber-500 hover:bg-amber-100",
    fullDone: "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100",
    fullIdle:
      "border-amber-200 bg-amber-50/50 text-stone-600 hover:border-amber-400 hover:text-amber-700",
    fullCheckDone: "border-amber-500 bg-amber-500 text-white",
    fullCheckIdle: "border-amber-300 bg-white text-amber-400",
    meta: "text-amber-700/70",
  },
} as const;

export function ItemDoneBadge({
  className = "",
  accent = "emerald",
}: {
  className?: string;
  accent?: ItemDoneAccent;
}) {
  const styles = ACCENT[accent];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${styles.badge} ${className}`}
    >
      <Check className="h-3 w-3" strokeWidth={3} />
      Done
    </span>
  );
}

export function ItemCompleteToggle({
  item,
  compact = false,
  accent = "emerald",
}: {
  item: ItineraryItem;
  compact?: boolean;
  accent?: ItemDoneAccent;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const { canEdit } = useAuth();
  const { refreshSelectedItem, selectedItemId } = useItineraryUI();
  const { syncNow } = useOfflineSync();
  const [busy, setBusy] = useState(false);
  const [completed, setCompleted] = useState(() => isItemCompleted(item));
  const [confirmUndoOpen, setConfirmUndoOpen] = useState(false);
  const styles = ACCENT[accent];

  useEffect(() => {
    if (confirmUndoOpen || busy) return;
    setCompleted(isItemCompleted(item));
  }, [item.id, item.details, confirmUndoOpen, busy]);

  const completion = getItemCompletion(item.details);

  async function setCompletion(nextCompleted: boolean) {
    if (!canEdit || busy) return;

    setBusy(true);
    if (nextCompleted) {
      setCompleted(true);
    }

    try {
      const response = await fetch(`/api/items/${item.id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: nextCompleted }),
      });

      if (!response.ok) {
        setCompleted(isItemCompleted(item));
        return;
      }

      setCompleted(nextCompleted);
      setConfirmUndoOpen(false);

      if (selectedItemId === item.id) {
        await refreshSelectedItem({ silent: true });
      }

      await syncNow();

      startTransition(() => {
        router.refresh();
      });
    } catch {
      setCompleted(isItemCompleted(item));
    } finally {
      setBusy(false);
    }
  }

  function handleClick(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (!canEdit || busy) return;

    if (completed) {
      queueMicrotask(() => setConfirmUndoOpen(true));
      return;
    }

    void setCompletion(true);
  }

  if (!canEdit) {
    return completed ? <ItemDoneBadge accent={accent} /> : null;
  }

  const dialog = (
    <ConfirmDialog
      open={confirmUndoOpen}
      title="Mark as not done?"
      message={`This will remove the done status from “${item.title}” for everyone viewing the itinerary.`}
      confirmLabel="Mark not done"
      destructive
      busy={busy}
      onClose={() => {
        if (!busy) setConfirmUndoOpen(false);
      }}
      onConfirm={() => void setCompletion(false)}
    />
  );

  if (compact) {
    return (
      <>
        <button
          type="button"
          onClick={handleClick}
          disabled={busy}
          aria-label={completed ? "Mark as not done" : "Mark as done"}
          title={completed ? "Mark as not done" : "Mark as done"}
          className={[
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-all",
            completed ? styles.compactDone : styles.compactIdle,
            busy ? "opacity-60" : "",
          ].join(" ")}
        >
          <Check className="h-4 w-4" strokeWidth={completed ? 3 : 2} />
        </button>
        {dialog}
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        aria-label={completed ? "Mark as not done" : "Mark as done"}
        className={[
          "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-all",
          completed ? styles.fullDone : styles.fullIdle,
          busy ? "opacity-60" : "",
        ].join(" ")}
      >
        <span
          className={[
            "flex h-5 w-5 items-center justify-center rounded-full border-2",
            completed ? styles.fullCheckDone : styles.fullCheckIdle,
          ].join(" ")}
        >
          <Check className="h-3 w-3" strokeWidth={3} />
        </span>
        {completed ? "Done" : "Mark done"}
        {completion?.completedBy && completed && (
          <span className={`text-xs font-normal ${styles.meta}`}>
            · {completion.completedBy}
          </span>
        )}
      </button>
      {dialog}
    </>
  );
}
