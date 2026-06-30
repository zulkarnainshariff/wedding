"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { useToast } from "@/components/ui/ToastProvider";
import { GalleryEditablePhotoGrid } from "@/components/gallery/GalleryPhotoGrid";
import { parseGuestNames } from "@/lib/gallery-photo-utils";

export type GalleryEvent = { id: number; name: string };

export type GalleryPhoto = {
  id: number;
  eventId: number;
  eventName: string;
  url: string;
  caption: string | null;
  tags: { guestName: string; email: string | null }[];
};

const EMPTY_FORM = {
  eventId: "",
  url: "",
  caption: "",
  guestNames: "",
};

export function GalleryManagementPanel({
  events,
  photoGalleryEnabled = true,
  compact = false,
  onPhotoAdded,
  onPhotoUpdated,
  onPhotoRemoved,
}: {
  events: GalleryEvent[];
  photoGalleryEnabled?: boolean;
  /** On the public gallery page: show only the add form. */
  compact?: boolean;
  onPhotoAdded?: (photo: GalleryPhoto) => void;
  onPhotoUpdated?: (photo: GalleryPhoto) => void;
  onPhotoRemoved?: (photoId: number) => void;
}) {
  const toast = useToast();
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [galleryEvents, setGalleryEvents] = useState<GalleryEvent[]>(events);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(!compact);
  const [busy, setBusy] = useState(false);

  const loadPhotos = useCallback(async () => {
    if (compact) return;
    setLoading(true);
    try {
      const response = await fetch("/api/gallery");
      if (!response.ok) {
        toast.error("Could not load gallery photos.");
        return;
      }
      const data = (await response.json()) as {
        photos: GalleryPhoto[];
        events: GalleryEvent[];
      };
      setPhotos(data.photos ?? []);
      if (data.events?.length) {
        setGalleryEvents(data.events);
      }
    } catch {
      toast.error("Could not load gallery photos.");
    } finally {
      setLoading(false);
    }
  }, [compact, toast]);

  useEffect(() => {
    void loadPhotos();
  }, [loadPhotos]);

  useEffect(() => {
    if (events.length > 0) {
      setGalleryEvents(events);
    }
  }, [events]);

  useEffect(() => {
    if (!form.eventId && galleryEvents[0]) {
      setForm((current) => ({
        ...current,
        eventId: String(galleryEvents[0].id),
      }));
    }
  }, [form.eventId, galleryEvents]);

  async function addPhoto() {
    const eventId = Number(form.eventId);
    const url = form.url.trim();
    if (!eventId || !url) {
      toast.error("Choose an event and enter a photo URL.");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/gallery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          url,
          caption: form.caption.trim() || null,
          tags: parseGuestNames(form.guestNames),
        }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        toast.error(body.error ?? "Could not add photo.");
        return;
      }

      const created = (await response.json()) as GalleryPhoto;
      if (!compact) {
        setPhotos((current) => [created, ...current]);
      }
      setForm((current) => ({
        ...EMPTY_FORM,
        eventId: current.eventId,
      }));
      onPhotoAdded?.(created);
      toast.success("Photo added.");
    } catch {
      toast.error("Could not add photo.");
    } finally {
      setBusy(false);
    }
  }

  function handlePhotoUpdated(photo: GalleryPhoto) {
    setPhotos((current) =>
      current.map((entry) => (entry.id === photo.id ? photo : entry)),
    );
    onPhotoUpdated?.(photo);
  }

  function handlePhotoRemoved(photoId: number) {
    setPhotos((current) => current.filter((photo) => photo.id !== photoId));
    onPhotoRemoved?.(photoId);
  }

  const addForm = (
    <div
      className={[
        "grid gap-4 sm:grid-cols-2",
        compact
          ? "rounded-xl border border-brand-deep/20 bg-brand-deep/5 p-4"
          : "mb-8 rounded-xl border border-stone-200 bg-stone-50/80 p-4",
      ].join(" ")}
    >
      {compact && (
        <p className="text-sm font-medium text-brand-deep sm:col-span-2">
          Add a photo
        </p>
      )}
      <label className="block text-sm sm:col-span-2">
        <span className="mb-1 block text-stone-500">Event</span>
        <select
          value={form.eventId}
          onChange={(e) =>
            setForm((current) => ({ ...current, eventId: e.target.value }))
          }
          className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2"
        >
          {galleryEvents.map((event) => (
            <option key={event.id} value={event.id}>
              {event.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm sm:col-span-2">
        <span className="mb-1 block text-stone-500">Photo URL</span>
        <input
          type="url"
          value={form.url}
          onChange={(e) =>
            setForm((current) => ({ ...current, url: e.target.value }))
          }
          placeholder="https://…"
          className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2"
        />
      </label>
      <label className="block text-sm sm:col-span-2">
        <span className="mb-1 block text-stone-500">Caption (optional)</span>
        <input
          value={form.caption}
          onChange={(e) =>
            setForm((current) => ({ ...current, caption: e.target.value }))
          }
          className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2"
        />
      </label>
      <label className="block text-sm sm:col-span-2">
        <span className="mb-1 block text-stone-500">Tag guests (optional)</span>
        <input
          value={form.guestNames}
          onChange={(e) =>
            setForm((current) => ({
              ...current,
              guestNames: e.target.value,
            }))
          }
          placeholder="Nat, Zulkarnain"
          className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2"
        />
        <span className="mt-1 block text-xs text-stone-400">
          Comma-separated names
        </span>
      </label>
      <div className="sm:col-span-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void addPhoto()}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-deep px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          {busy ? "Adding…" : "Add photo"}
        </button>
      </div>
    </div>
  );

  if (compact) {
    if (galleryEvents.length === 0) {
      return (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Create a wedding event under Admin → Invitations before adding photos.
        </p>
      );
    }
    return addForm;
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-serif text-lg text-brand-deep">Photo gallery</h3>
        <p className="mt-1 text-sm text-stone-500">
          Paste image URLs to show photos on{" "}
          <code className="text-xs">/gallery</code>
          {!photoGalleryEnabled
            ? ". Enable the gallery under Public features when you are ready to go live."
            : ". Hover a photo to edit or delete."}
        </p>
      </div>

      {galleryEvents.length === 0 ? (
        <p className="text-sm text-stone-500">
          Create a wedding event under Invitations before adding photos.
        </p>
      ) : (
        addForm
      )}

      {loading ? (
        <p className="text-sm text-stone-500">Loading photos…</p>
      ) : photos.length === 0 ? (
        <p className="text-sm text-stone-500">No photos yet.</p>
      ) : (
        <GalleryEditablePhotoGrid
          photos={photos}
          events={galleryEvents}
          onPhotoUpdated={handlePhotoUpdated}
          onPhotoRemoved={handlePhotoRemoved}
        />
      )}
    </div>
  );
}
