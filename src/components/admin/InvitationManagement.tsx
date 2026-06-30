"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Save, Trash2 } from "lucide-react";
import { SectionShell } from "@/components/layout/PageShell";
import type { InvitationCardFront } from "@/lib/invitation-types";
import type { PublicScheduleItemRow, WeddingEvent } from "@/lib/schema";

type EventWithSchedule = WeddingEvent & {
  schedule: PublicScheduleItemRow[];
};

const EMPTY_SCHEDULE_ITEM = {
  timeLabel: "",
  title: "",
  description: "",
  sortOrder: 0,
  published: true,
};

export function InvitationManagement({
  initialEvents,
}: {
  initialEvents: EventWithSchedule[];
}) {
  const router = useRouter();
  const [events, setEvents] = useState(initialEvents);
  const [selectedId, setSelectedId] = useState<number | null>(
    initialEvents[0]?.id ?? null,
  );
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newItem, setNewItem] = useState(EMPTY_SCHEDULE_ITEM);
  const [newEvent, setNewEvent] = useState({
    name: "",
    slug: "",
    eventDate: new Date().toISOString().slice(0, 10),
    location: "",
  });

  const selected = events.find((event) => event.id === selectedId) ?? null;
  const cardFront = (selected?.cardFront ?? {}) as InvitationCardFront;

  function updateSelected(patch: Partial<WeddingEvent>) {
    if (!selected) return;
    setEvents((current) =>
      current.map((event) =>
        event.id === selected.id ? { ...event, ...patch } : event,
      ),
    );
  }

  function updateCardFront(patch: Partial<InvitationCardFront>) {
    if (!selected) return;
    updateSelected({
      cardFront: { ...cardFront, ...patch },
    });
  }

  function updateScheduleItem(
    itemId: number,
    patch: Partial<PublicScheduleItemRow>,
  ) {
    if (!selected) return;
    setEvents((current) =>
      current.map((event) =>
        event.id === selected.id
          ? {
              ...event,
              schedule: event.schedule.map((item) =>
                item.id === itemId ? { ...item, ...patch } : item,
              ),
            }
          : event,
      ),
    );
  }

  async function deleteEvent() {
    if (!selected) return;
    if (
      !confirm(
        `Delete "${selected.name}"? Guest lists, tasks, gallery photos, and guestbook entries for this event will also be removed.`,
      )
    ) {
      return;
    }

    setBusy(true);
    setError(null);
    const response = await fetch(`/api/events/${selected.id}`, {
      method: "DELETE",
    });
    setBusy(false);

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.error ?? "Failed to delete event.");
      return;
    }

    const remaining = events.filter((event) => event.id !== selected.id);
    setEvents(remaining);
    setSelectedId(remaining[0]?.id ?? null);
    setStatus("Event deleted.");
    router.refresh();
  }

  async function createEvent() {
    if (!newEvent.name.trim()) {
      setError("Event name is required.");
      return;
    }

    setBusy(true);
    setError(null);
    setStatus(null);

    const response = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newEvent.name.trim(),
        slug: newEvent.slug.trim() || undefined,
        eventDate: newEvent.eventDate,
        location: newEvent.location.trim() || null,
      }),
    });

    setBusy(false);
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.error ?? "Failed to create event.");
      return;
    }

    const created = (await response.json()) as EventWithSchedule;
    setEvents((current) => [...current, created]);
    setSelectedId(created.id);
    setNewEvent({
      name: "",
      slug: "",
      eventDate: new Date().toISOString().slice(0, 10),
      location: "",
    });
    setStatus(`Created ${created.name}.`);
    router.refresh();
  }

  async function saveEvent() {
    if (!selected) return;
    setBusy(true);
    setError(null);
    setStatus(null);

    const response = await fetch(`/api/events/${selected.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: selected.name,
        slug: selected.slug,
        eventDate: selected.eventDate,
        location: selected.location,
        cardFront: selected.cardFront,
        sortOrder: selected.sortOrder,
        published: selected.published,
      }),
    });

    setBusy(false);
    if (!response.ok) {
      setError("Failed to save invitation.");
      return;
    }

    setStatus("Invitation saved.");
    router.refresh();
  }

  async function saveScheduleItem(item: PublicScheduleItemRow) {
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/events/schedule/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        timeLabel: item.timeLabel,
        title: item.title,
        description: item.description,
        sortOrder: item.sortOrder,
        published: item.published,
      }),
    });
    setBusy(false);
    if (!response.ok) {
      setError("Failed to save schedule item.");
      return;
    }
    setStatus("Schedule item saved.");
    router.refresh();
  }

  async function addScheduleItem() {
    if (!selected || !newItem.timeLabel.trim() || !newItem.title.trim()) {
      setError("Time and title are required for new schedule items.");
      return;
    }
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/events/${selected.id}/schedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...newItem,
        sortOrder: selected.schedule.length,
      }),
    });
    setBusy(false);
    if (!response.ok) {
      setError("Failed to add schedule item.");
      return;
    }
    const created = await response.json();
    setEvents((current) =>
      current.map((event) =>
        event.id === selected.id
          ? { ...event, schedule: [...event.schedule, created] }
          : event,
      ),
    );
    setNewItem(EMPTY_SCHEDULE_ITEM);
    setStatus("Schedule item added.");
    router.refresh();
  }

  async function deleteScheduleItem(itemId: number) {
    if (!confirm("Delete this schedule item?")) return;
    setBusy(true);
    await fetch(`/api/events/schedule/${itemId}`, { method: "DELETE" });
    setBusy(false);
    if (!selected) return;
    setEvents((current) =>
      current.map((event) =>
        event.id === selected.id
          ? {
              ...event,
              schedule: event.schedule.filter((item) => item.id !== itemId),
            }
          : event,
      ),
    );
    router.refresh();
  }

  if (!selected) {
    return (
      <SectionShell
        title={events.length > 0 ? "New invitation event" : "Invitation events"}
      >
        {events.length > 0 && (
          <button
            type="button"
            onClick={() => setSelectedId(events[0]?.id ?? null)}
            className="mb-4 text-sm text-brand-deep hover:underline"
          >
            ← Back to {events[0]?.name ?? "events"}
          </button>
        )}
        <p className="mb-4 text-sm text-stone-500">
          Create a celebration for the public landing page. Each event has its
          own flip card, schedule, guest list, and RSVP settings.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block text-stone-500">Event name</span>
            <input
              value={newEvent.name}
              onChange={(e) =>
                setNewEvent((current) => ({ ...current, name: e.target.value }))
              }
              placeholder="Philadelphia Wedding"
              className="w-full rounded-lg border border-stone-200 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-stone-500">URL slug</span>
            <input
              value={newEvent.slug}
              onChange={(e) =>
                setNewEvent((current) => ({ ...current, slug: e.target.value }))
              }
              placeholder="philadelphia"
              className="w-full rounded-lg border border-stone-200 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-stone-500">Event date</span>
            <input
              type="date"
              value={newEvent.eventDate}
              onChange={(e) =>
                setNewEvent((current) => ({
                  ...current,
                  eventDate: e.target.value,
                }))
              }
              className="w-full rounded-lg border border-stone-200 px-3 py-2"
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block text-stone-500">Location</span>
            <input
              value={newEvent.location}
              onChange={(e) =>
                setNewEvent((current) => ({
                  ...current,
                  location: e.target.value,
                }))
              }
              placeholder="Philadelphia, Pennsylvania"
              className="w-full rounded-lg border border-stone-200 px-3 py-2"
            />
          </label>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void createEvent()}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-deep px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          Create event
        </button>
        {error && (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
      </SectionShell>
    );
  }

  return (
    <SectionShell
      title="Invitation cards"
      toolbar={
        <div className="flex flex-wrap items-center gap-2">
          {events.map((event) => (
            <button
              key={event.id}
              type="button"
              onClick={() => setSelectedId(event.id)}
              className={[
                "rounded-full px-4 py-1.5 text-sm font-medium",
                event.id === selectedId
                  ? "bg-brand-deep text-white"
                  : "border border-stone-200 text-stone-600",
              ].join(" ")}
            >
              {event.name}
            </button>
          ))}
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setSelectedId(null);
              setError(null);
              setStatus(null);
            }}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-stone-300 px-4 py-1.5 text-sm font-medium text-stone-600 hover:border-brand/40 hover:text-brand-deep"
          >
            <Plus className="h-4 w-4" />
            New event
          </button>
        </div>
      }
    >
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void deleteEvent()}
          className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" />
          Delete event
        </button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block text-stone-500">Event name</span>
          <input
            value={selected.name}
            onChange={(e) => updateSelected({ name: e.target.value })}
            className="w-full rounded-lg border border-stone-200 px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-stone-500">URL slug</span>
          <input
            value={selected.slug}
            onChange={(e) => updateSelected({ slug: e.target.value })}
            className="w-full rounded-lg border border-stone-200 px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-stone-500">Event date</span>
          <input
            type="date"
            value={selected.eventDate}
            onChange={(e) => updateSelected({ eventDate: e.target.value })}
            className="w-full rounded-lg border border-stone-200 px-3 py-2"
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block text-stone-500">Location</span>
          <input
            value={selected.location ?? ""}
            onChange={(e) => updateSelected({ location: e.target.value })}
            className="w-full rounded-lg border border-stone-200 px-3 py-2"
          />
        </label>
        <label className="flex items-center gap-2 text-sm sm:col-span-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
          <input
            type="checkbox"
            checked={selected.published}
            onChange={(e) => updateSelected({ published: e.target.checked })}
          />
          <span>
            <span className="font-medium text-stone-700">Show on public landing</span>
            <span className="mt-0.5 block text-xs text-stone-500">
              When off, this event is hidden from the public home page.
            </span>
          </span>
        </label>
      </div>

      <h3 className="mt-6 text-sm font-semibold tracking-wide text-stone-600 uppercase">
        Card front
      </h3>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block text-stone-500">Headline</span>
          <input
            value={cardFront.headline ?? ""}
            onChange={(e) => updateCardFront({ headline: e.target.value })}
            className="w-full rounded-lg border border-stone-200 px-3 py-2"
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block text-stone-500">Couple names</span>
          <input
            value={cardFront.coupleNames ?? ""}
            onChange={(e) => updateCardFront({ coupleNames: e.target.value })}
            className="w-full rounded-lg border border-stone-200 px-3 py-2"
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block text-stone-500">Date line</span>
          <input
            value={cardFront.dateLine ?? ""}
            onChange={(e) => updateCardFront({ dateLine: e.target.value })}
            className="w-full rounded-lg border border-stone-200 px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-stone-500">Venue</span>
          <input
            value={cardFront.venue ?? ""}
            onChange={(e) => updateCardFront({ venue: e.target.value })}
            className="w-full rounded-lg border border-stone-200 px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-stone-500">Location line</span>
          <input
            value={cardFront.location ?? ""}
            onChange={(e) => updateCardFront({ location: e.target.value })}
            className="w-full rounded-lg border border-stone-200 px-3 py-2"
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block text-stone-500">Google Maps link</span>
          <input
            value={cardFront.mapsUrl ?? ""}
            onChange={(e) => updateCardFront({ mapsUrl: e.target.value })}
            placeholder="https://www.google.com/maps/place/..."
            className="w-full rounded-lg border border-stone-200 px-3 py-2"
          />
          <span className="mt-1 block text-xs text-stone-400">
            When set, guests can tap the venue name on the card to open directions.
          </span>
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block text-stone-500">Tagline</span>
          <input
            value={cardFront.tagline ?? ""}
            onChange={(e) => updateCardFront({ tagline: e.target.value })}
            className="w-full rounded-lg border border-stone-200 px-3 py-2"
          />
        </label>
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={() => void saveEvent()}
        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-deep px-4 py-2 text-sm font-medium text-white"
      >
        <Save className="h-4 w-4" />
        Save invitation
      </button>

      <h3 className="mt-8 text-sm font-semibold tracking-wide text-stone-600 uppercase">
        Card back — day schedule
      </h3>
      <p className="mt-1 text-sm text-stone-500">
        These items appear when guests flip the invitation card.
      </p>

      <div className="mt-4 space-y-4">
        {selected.schedule.map((item) => (
          <div
            key={item.id}
            className="rounded-xl border border-stone-200 bg-surface-soft p-4"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block text-stone-500">Time</span>
                <input
                  value={item.timeLabel}
                  onChange={(e) =>
                    updateScheduleItem(item.id, { timeLabel: e.target.value })
                  }
                  className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-stone-500">Title</span>
                <input
                  value={item.title}
                  onChange={(e) =>
                    updateScheduleItem(item.id, { title: e.target.value })
                  }
                  className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2"
                />
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1 block text-stone-500">Description (optional)</span>
                <input
                  value={item.description ?? ""}
                  onChange={(e) =>
                    updateScheduleItem(item.id, {
                      description: e.target.value || null,
                    })
                  }
                  className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2"
                />
              </label>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void saveScheduleItem(item)}
                className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => void deleteScheduleItem(item.id)}
                className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-xl border border-dashed border-stone-300 p-4">
        <p className="text-sm font-medium text-stone-600">Add schedule item</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-stone-500">Time</span>
            <input
              value={newItem.timeLabel}
              onChange={(e) =>
                setNewItem((current) => ({ ...current, timeLabel: e.target.value }))
              }
              placeholder="6:00 PM"
              className="w-full rounded-lg border border-stone-200 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-stone-500">Title</span>
            <input
              value={newItem.title}
              onChange={(e) =>
                setNewItem((current) => ({ ...current, title: e.target.value }))
              }
              placeholder="Wedding ceremony"
              className="w-full rounded-lg border border-stone-200 px-3 py-2"
            />
          </label>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void addScheduleItem()}
          className="mt-3 inline-flex items-center gap-2 rounded-lg bg-brand-deep px-4 py-2 text-sm font-medium text-white"
        >
          <Plus className="h-4 w-4" />
          Add item
        </button>
      </div>

      {status && (
        <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {status}
        </p>
      )}
      {error && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </SectionShell>
  );
}
