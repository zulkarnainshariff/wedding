"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { useItineraryUI } from "@/components/itinerary/ItineraryUIContext";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { getItemCompletion, isItemCompleted } from "@/lib/item-completion";
import type { ItineraryItem } from "@/lib/schema";

export function ItemDoneBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-emerald-800 uppercase ${className}`}
    >
      <Check className="h-3 w-3" strokeWidth={3} />
      Done
    </span>
  );
}

export function ItemCompleteToggle({
  item,
  compact = false,
}: {
  item: ItineraryItem;
  compact?: boolean;
}) {
  const router = useRouter();
  const { canEdit } = useAuth();
  const { refreshSelectedItem, selectedItemId } = useItineraryUI();
  const [busy, setBusy] = useState(false);
  const [completed, setCompleted] = useState(() => isItemCompleted(item));
  const [confirmUndoOpen, setConfirmUndoOpen] = useState(false);

  useEffect(() => {
    setCompleted(isItemCompleted(item));
  }, [item]);

  const completion = getItemCompletion(item.details);

  async function setCompletion(nextCompleted: boolean) {
    if (!canEdit || busy) return;

    setBusy(true);
    setCompleted(nextCompleted);

    try {
      const response = await fetch(`/api/items/${item.id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: nextCompleted }),
      });

      if (!response.ok) {
        setCompleted(!nextCompleted);
        return;
      }

      setConfirmUndoOpen(false);
      router.refresh();
      if (selectedItemId === item.id) {
        await refreshSelectedItem();
      }
    } catch {
      setCompleted(!nextCompleted);
    } finally {
      setBusy(false);
    }
  }

  function handleClick(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (!canEdit || busy) return;

    if (completed) {
      setConfirmUndoOpen(true);
      return;
    }

    void setCompletion(true);
  }

  if (!canEdit) {
    return completed ? <ItemDoneBadge /> : null;
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
            completed
              ? "border-emerald-500 bg-emerald-500 text-white shadow-sm shadow-emerald-500/30"
              : "border-stone-200 bg-white text-stone-300 hover:border-emerald-400 hover:text-emerald-500",
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
          completed
            ? "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
            : "border-stone-200 bg-white text-stone-600 hover:border-emerald-300 hover:text-emerald-700",
          busy ? "opacity-60" : "",
        ].join(" ")}
      >
        <span
          className={[
            "flex h-5 w-5 items-center justify-center rounded-full border-2",
            completed
              ? "border-emerald-500 bg-emerald-500 text-white"
              : "border-stone-300 bg-white text-transparent",
          ].join(" ")}
        >
          <Check className="h-3 w-3" strokeWidth={3} />
        </span>
        {completed ? "Done" : "Mark done"}
        {completion?.completedBy && completed && (
          <span className="text-xs font-normal text-emerald-700/70">
            · {completion.completedBy}
          </span>
        )}
      </button>
      {dialog}
    </>
  );
}
