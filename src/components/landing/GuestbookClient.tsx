"use client";

import { useEffect, useState } from "react";
import { Trash2, EyeOff, Eye } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { PublicHeader } from "@/components/landing/PublicHeader";
import { canModerateGuestbook } from "@/lib/permissions";

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

export function GuestbookClient({
  enabled,
  guestbookEnabled = enabled,
  photoGalleryEnabled = false,
}: {
  enabled: boolean;
  guestbookEnabled?: boolean;
  photoGalleryEnabled?: boolean;
}) {
  const { user } = useAuth();
  const [entries, setEntries] = useState<GuestbookEntry[]>([]);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [canModerate, setCanModerate] = useState(false);
  const [eventFilter, setEventFilter] = useState("");
  const [form, setForm] = useState({
    eventId: "",
    name: "",
    message: "",
    email: "",
  });
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [moderatingId, setModeratingId] = useState<number | null>(null);

  const showModeration =
    canModerate || (user ? canModerateGuestbook(user) : false);

  async function loadEntries(filter = eventFilter) {
    const params = filter ? `?eventId=${filter}` : "";
    const response = await fetch(`/api/guestbook${params}`);
    if (!response.ok) return;
    const data = await response.json();
    setEntries(data.entries ?? []);
    setEvents(data.events ?? []);
    setCanModerate(Boolean(data.canModerate));
    if (!form.eventId && data.events?.[0]) {
      setForm((current) => ({
        ...current,
        eventId: String(data.events[0].id),
      }));
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch guestbook entries
    void loadEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventFilter]);

  async function submitEntry(event: React.FormEvent) {
    event.preventDefault();
    if (!enabled) return;
    setBusy(true);
    setStatus(null);
    const response = await fetch("/api/guestbook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        eventId: Number(form.eventId),
        email: form.email || null,
      }),
    });
    setBusy(false);
    if (!response.ok) {
      setStatus("Could not submit your message.");
      return;
    }

    const created = (await response.json()) as GuestbookEntry;
    setEntries((current) => [created, ...current]);
    setForm((current) => ({
      ...current,
      message: "",
      email: "",
    }));
    setStatus("Thank you! Your message appears below.");
  }

  async function hideEntry(entry: GuestbookEntry, hidden: boolean) {
    setModeratingId(entry.id);
    try {
      const response = await fetch(`/api/guestbook/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hidden }),
      });
      if (!response.ok) return;
      const updated = (await response.json()) as GuestbookEntry;
      if (hidden && !showModeration) {
        setEntries((current) => current.filter((row) => row.id !== entry.id));
      } else {
        setEntries((current) =>
          current.map((row) => (row.id === updated.id ? updated : row)),
        );
      }
    } finally {
      setModeratingId(null);
    }
  }

  async function deleteEntry(entry: GuestbookEntry) {
    if (!confirm(`Delete the message from ${entry.name}?`)) return;
    setModeratingId(entry.id);
    try {
      const response = await fetch(`/api/guestbook/${entry.id}`, {
        method: "DELETE",
      });
      if (!response.ok) return;
      setEntries((current) => current.filter((row) => row.id !== entry.id));
    } finally {
      setModeratingId(null);
    }
  }

  if (!enabled) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <PublicHeader
          guestbookEnabled={guestbookEnabled}
          photoGalleryEnabled={photoGalleryEnabled}
        />
        <main className="mx-auto w-full max-w-3xl px-4 py-24 text-center">
          <p className="text-stone-600">The guestbook is not open right now.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PublicHeader
        guestbookEnabled={guestbookEnabled}
        photoGalleryEnabled={photoGalleryEnabled}
      />
      <main className="mx-auto w-full max-w-3xl px-4 py-24">
        <h1 className="font-serif text-3xl text-brand-deep">Guestbook</h1>
        <p className="mt-2 text-sm text-stone-500">
          Leave a note for Natalie &amp; Zulkarnain. Your email is optional and
          only used if we need to follow up — it is not shown publicly.
        </p>
        <p className="mt-2 text-sm text-stone-500">
          Made a mistake? Submit a corrected message and we will remove the
          earlier one.
        </p>

        {events.length > 1 && (
          <label className="mt-6 block text-sm">
            <span className="mb-1 block text-stone-500">Event</span>
            <select
              value={eventFilter}
              onChange={(e) => setEventFilter(e.target.value)}
              className="w-full rounded-lg border border-stone-200 px-3 py-2 sm:max-w-xs"
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

        <form
          onSubmit={submitEntry}
          className="mt-8 space-y-3 rounded-2xl border border-border/80 bg-surface p-6"
        >
          <select
            value={form.eventId}
            onChange={(e) =>
              setForm((current) => ({ ...current, eventId: e.target.value }))
            }
            className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
            required
          >
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.name}
              </option>
            ))}
          </select>
          <input
            value={form.name}
            onChange={(e) =>
              setForm((current) => ({ ...current, name: e.target.value }))
            }
            placeholder="Your name"
            className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
            required
          />
          <textarea
            value={form.message}
            onChange={(e) =>
              setForm((current) => ({ ...current, message: e.target.value }))
            }
            placeholder="Your message"
            rows={4}
            className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
            required
          />
          <input
            type="email"
            value={form.email}
            onChange={(e) =>
              setForm((current) => ({ ...current, email: e.target.value }))
            }
            placeholder="Email (optional, kept private)"
            className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={busy}
            className="cursor-pointer rounded-lg bg-brand-deep px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? "Sending…" : "Sign guestbook"}
          </button>
          {status && <p className="text-sm text-brand-deep">{status}</p>}
        </form>

        <div className="mt-10 space-y-4">
          <h2 className="font-serif text-lg text-brand-deep">Messages</h2>
          {entries.length === 0 ? (
            <p className="text-sm text-stone-500">No messages yet.</p>
          ) : (
            entries.map((entry) => (
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
                  {showModeration && (
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        disabled={moderatingId === entry.id}
                        onClick={() => void hideEntry(entry, !entry.hidden)}
                        className="cursor-pointer rounded-lg border border-stone-200 p-1.5 text-stone-600 hover:bg-stone-50"
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
                        disabled={moderatingId === entry.id}
                        onClick={() => void deleteEntry(entry)}
                        className="cursor-pointer rounded-lg border border-red-200 p-1.5 text-red-600 hover:bg-red-50"
                        aria-label="Delete message"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
                <p className="mt-2 text-sm text-stone-700">{entry.message}</p>
              </article>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
