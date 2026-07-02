"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, Eye, EyeOff, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/ToastProvider";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useAuth } from "@/components/auth/AuthProvider";

type GuestbookEntry = {
  id: number;
  eventId: number;
  eventName: string;
  name: string;
  message: string;
  hidden?: boolean;
  createdAt: string;
};

type EventOption = { id: number; name: string; slug: string };

export function GuestbookManagementPanel({
  guestbookEnabled,
}: {
  guestbookEnabled: boolean;
}) {
  const { user, guestListAccess } = useAuth();
  const toast = useToast();
  const [entries, setEntries] = useState<GuestbookEntry[]>([]);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [canModerateAny, setCanModerateAny] = useState(false);
  const [moderatableEventIds, setModeratableEventIds] = useState<number[]>([]);
  const [eventFilter, setEventFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<GuestbookEntry | null>(null);
  const hasAnyModerationAccess = Boolean(
    user?.isAdmin ||
      guestListAccess.some((entry) => entry.canModerateGuestbook),
  );

  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      const params = eventFilter ? `?eventId=${eventFilter}` : "";
      const response = await fetch(`/api/guestbook${params}`);
      if (!response.ok) {
        toast.error("Could not load guestbook messages.");
        return;
      }
      const data = (await response.json()) as {
        entries: GuestbookEntry[];
        events: EventOption[];
        canModerateAny?: boolean;
        moderatableEventIds?: number[];
      };
      if (!data.canModerateAny) {
        toast.error("You do not have permission to moderate the guestbook.");
        return;
      }
      setEntries(data.entries ?? []);
      setEvents(data.events ?? []);
      setCanModerateAny(Boolean(data.canModerateAny));
      setModeratableEventIds(
        Array.isArray(data.moderatableEventIds) ? data.moderatableEventIds : [],
      );
    } catch {
      toast.error("Could not load guestbook messages.");
    } finally {
      setLoading(false);
    }
  }, [eventFilter, toast]);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  async function hideEntry(entry: GuestbookEntry, hidden: boolean) {
    setBusyId(entry.id);
    try {
      const response = await fetch(`/api/guestbook/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hidden }),
      });
      if (!response.ok) {
        toast.error("Could not update message.");
        return;
      }
      const updated = (await response.json()) as GuestbookEntry;
      setEntries((current) =>
        current.map((row) => (row.id === updated.id ? updated : row)),
      );
      toast.success(hidden ? "Message hidden from public." : "Message visible again.");
    } catch {
      toast.error("Could not update message.");
    } finally {
      setBusyId(null);
    }
  }

  async function deleteEntry(entry: GuestbookEntry) {
    setBusyId(entry.id);
    try {
      const response = await fetch(`/api/guestbook/${entry.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        toast.error("Could not delete message.");
        return;
      }
      setEntries((current) => current.filter((row) => row.id !== entry.id));
      toast.success("Message deleted.");
    } catch {
      toast.error("Could not delete message.");
    } finally {
      setBusyId(null);
      setPendingDelete(null);
    }
  }

  function canModerateEntry(entryEventId: number): boolean {
    return canModerateAny || moderatableEventIds.includes(entryEventId);
  }

  if (!hasAnyModerationAccess) {
    return (
      <p className="text-sm text-stone-500">
        You can moderate guestbook entries once an event grants you Guestbook
        moderator access.
      </p>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="font-serif text-lg text-brand-deep">Guestbook</h3>
            <p className="mt-1 max-w-2xl text-sm text-stone-500">
              Review and moderate signed messages on{" "}
              <code className="text-xs">/guestbook</code>
              {!guestbookEnabled
                ? ". Enable the guestbook under Public features when you are ready to go live."
                : ". Hidden messages stay here but are not shown to guests."}
            </p>
          </div>
          <Link
            href="/guestbook"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-medium text-brand-deep hover:bg-stone-50"
          >
            <ExternalLink className="h-4 w-4" aria-hidden />
            Open public page
          </Link>
        </div>

        {events.length > 1 && (
          <label className="block text-sm sm:max-w-xs">
            <span className="mb-1 block text-stone-500">Filter by event</span>
            <select
              value={eventFilter}
              onChange={(e) => setEventFilter(e.target.value)}
              className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2"
            >
              <option value="">All events</option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {loading ? (
          <p className="text-sm text-stone-500">Loading messages…</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-stone-500">No messages yet.</p>
        ) : (
          <div className="space-y-3">
            {entries.map((entry) => (
              <article
                key={entry.id}
                className={[
                  "rounded-xl border px-4 py-3",
                  entry.hidden
                    ? "border-amber-200 bg-amber-50/50"
                    : "border-stone-200 bg-white",
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-stone-800">{entry.name}</p>
                    <p className="mt-1 text-xs text-stone-400">
                      {entry.eventName} ·{" "}
                      {new Date(entry.createdAt).toLocaleString()}
                      {entry.hidden ? " · Hidden from public" : ""}
                    </p>
                  </div>
                  {canModerateEntry(entry.eventId) ? (
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      disabled={busyId === entry.id}
                      onClick={() => void hideEntry(entry, !entry.hidden)}
                      className="rounded-lg border border-stone-200 p-1.5 text-stone-600 hover:bg-stone-50 disabled:opacity-50"
                      aria-label={entry.hidden ? "Unhide message" : "Hide message"}
                      title={entry.hidden ? "Unhide" : "Hide"}
                    >
                      {entry.hidden ? (
                        <Eye className="h-4 w-4" />
                      ) : (
                        <EyeOff className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      type="button"
                      disabled={busyId === entry.id}
                      onClick={() => setPendingDelete(entry)}
                      className="rounded-lg border border-red-200 p-1.5 text-red-600 hover:bg-red-50 disabled:opacity-50"
                      aria-label="Delete message"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  ) : null}
                </div>
                <p className="mt-2 text-sm text-stone-700">{entry.message}</p>
              </article>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={pendingDelete != null}
        title="Delete message?"
        message={
          pendingDelete
            ? `Permanently delete the message from ${pendingDelete.name}?`
            : ""
        }
        confirmLabel="Delete"
        destructive
        busy={busyId != null}
        onConfirm={() => {
          if (pendingDelete) void deleteEntry(pendingDelete);
        }}
        onClose={() => {
          if (busyId == null) setPendingDelete(null);
        }}
      />
    </>
  );
}
