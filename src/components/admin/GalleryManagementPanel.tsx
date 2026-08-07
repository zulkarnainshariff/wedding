"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Images, Plus, Upload } from "lucide-react";
import { useToast } from "@/components/ui/ToastProvider";
import { GalleryEditablePhotoGrid } from "@/components/gallery/GalleryPhotoGrid";
import { PortaledFileInput } from "@/components/ui/PortaledFileInput";
import { parseGuestNames } from "@/lib/gallery-photo-utils";

export type GalleryEvent = { id: number; name: string };
export type GalleryAlbum = { id: number; name: string };

export type GalleryPhoto = {
  id: number;
  eventId: number;
  eventName: string;
  albumId: number | null;
  albumName: string | null;
  url: string;
  caption: string | null;
  tags: { guestName: string; email: string | null }[];
  groupings: string[];
};

const EMPTY_FORM = {
  eventId: "",
  albumId: "",
  albumName: "",
  url: "",
  caption: "",
  guestNames: "",
  groupings: "",
};

const EMPTY_BULK = {
  eventId: "",
  albumName: "",
  caption: "",
  guestNames: "",
  groupings: "",
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [galleryEvents, setGalleryEvents] = useState<GalleryEvent[]>(events);
  const [albums, setAlbums] = useState<GalleryAlbum[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [bulk, setBulk] = useState(EMPTY_BULK);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(!compact);
  const [busy, setBusy] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);

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
        albums: GalleryAlbum[];
      };
      setPhotos(data.photos ?? []);
      if (data.events?.length) setGalleryEvents(data.events);
      setAlbums(data.albums ?? []);
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
    if (events.length > 0) setGalleryEvents(events);
  }, [events]);

  useEffect(() => {
    if (!form.eventId && galleryEvents[0]) {
      setForm((current) => ({
        ...current,
        eventId: String(galleryEvents[0].id),
      }));
    }
    if (!bulk.eventId && galleryEvents[0]) {
      setBulk((current) => ({
        ...current,
        eventId: String(galleryEvents[0].id),
      }));
    }
  }, [form.eventId, bulk.eventId, galleryEvents]);

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
          albumId: form.albumId ? Number(form.albumId) : null,
          albumName: form.albumName.trim() || undefined,
          tags: parseGuestNames(form.guestNames),
          groupingsText: form.groupings,
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
        if (created.albumId && created.albumName) {
          setAlbums((current) =>
            current.some((album) => album.id === created.albumId)
              ? current
              : [...current, { id: created.albumId!, name: created.albumName! }],
          );
        }
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

  async function uploadBulk() {
    const eventId = Number(bulk.eventId);
    const albumName = bulk.albumName.trim();
    if (!eventId) {
      toast.error("Choose an event for the upload.");
      return;
    }
    if (!albumName) {
      toast.error("Enter an album name for bulk uploads.");
      return;
    }
    if (selectedFiles.length === 0) {
      toast.error("Choose image files or a zip archive.");
      return;
    }

    setBulkBusy(true);
    try {
      const formData = new FormData();
      formData.set("eventId", String(eventId));
      formData.set("albumName", albumName);
      if (bulk.caption.trim()) formData.set("caption", bulk.caption.trim());
      if (bulk.guestNames.trim()) formData.set("guestNames", bulk.guestNames);
      if (bulk.groupings.trim()) formData.set("groupings", bulk.groupings);
      for (const file of selectedFiles) {
        formData.append("files", file);
      }

      const response = await fetch("/api/gallery/upload", {
        method: "POST",
        body: formData,
      });
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
        count?: number;
        photos?: GalleryPhoto[];
        albumId?: number;
      };

      if (!response.ok) {
        toast.error(body.error ?? "Could not upload photos.");
        return;
      }

      const created = body.photos ?? [];
      if (!compact && created.length > 0) {
        setPhotos((current) => [...created, ...current]);
      }
      for (const photo of created) {
        onPhotoAdded?.(photo);
      }
      if (body.albumId && albumName) {
        setAlbums((current) =>
          current.some((album) => album.id === body.albumId)
            ? current
            : [...current, { id: body.albumId!, name: albumName }],
        );
      }

      setBulk((current) => ({
        ...EMPTY_BULK,
        eventId: current.eventId,
      }));
      setSelectedFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      toast.success(
        `Uploaded ${body.count ?? created.length} photo${
          (body.count ?? created.length) === 1 ? "" : "s"
        }.`,
      );
      if (!compact) void loadPhotos();
    } catch {
      toast.error("Could not upload photos.");
    } finally {
      setBulkBusy(false);
    }
  }

  function handlePhotoUpdated(photo: GalleryPhoto) {
    setPhotos((current) =>
      current.map((entry) => (entry.id === photo.id ? photo : entry)),
    );
    if (photo.albumId && photo.albumName) {
      setAlbums((current) =>
        current.some((album) => album.id === photo.albumId)
          ? current
          : [...current, { id: photo.albumId!, name: photo.albumName! }],
      );
    }
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
          : "rounded-xl border border-stone-200 bg-stone-50/80 p-4",
      ].join(" ")}
    >
      {compact && (
        <p className="text-sm font-medium text-brand-deep sm:col-span-2">
          Add a photo by URL
        </p>
      )}
      {!compact && (
        <p className="text-sm font-medium text-stone-700 sm:col-span-2">
          Add by URL
        </p>
      )}
      <label className="block text-sm">
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
      <label className="block text-sm">
        <span className="mb-1 block text-stone-500">Album</span>
        <select
          value={form.albumId}
          onChange={(e) =>
            setForm((current) => ({
              ...current,
              albumId: e.target.value,
              albumName: "",
            }))
          }
          className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2"
        >
          <option value="">No album</option>
          {albums.map((album) => (
            <option key={album.id} value={album.id}>
              {album.name}
            </option>
          ))}
        </select>
      </label>
      {!form.albumId ? (
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block text-stone-500">
            Or create album (optional)
          </span>
          <input
            value={form.albumName}
            onChange={(e) =>
              setForm((current) => ({ ...current, albumName: e.target.value }))
            }
            placeholder="Reception highlights"
            className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2"
          />
        </label>
      ) : null}
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
      <label className="block text-sm">
        <span className="mb-1 block text-stone-500">Tag people (optional)</span>
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
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-stone-500">Groupings (optional)</span>
        <input
          value={form.groupings}
          onChange={(e) =>
            setForm((current) => ({
              ...current,
              groupings: e.target.value,
            }))
          }
          placeholder="Family, Bridal party"
          className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2"
        />
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

  const bulkForm = (
    <div className="grid gap-4 rounded-xl border border-stone-200 bg-white p-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <p className="inline-flex items-center gap-2 text-sm font-medium text-stone-700">
          <Images className="h-4 w-4 text-brand-deep" />
          Bulk upload
        </p>
        <p className="mt-1 text-xs text-stone-500">
          Upload multiple images or a zip archive. You will be asked for an album
          name; photos can be reassigned to other albums later.
        </p>
      </div>
      <label className="block text-sm">
        <span className="mb-1 block text-stone-500">Event</span>
        <select
          value={bulk.eventId}
          onChange={(e) =>
            setBulk((current) => ({ ...current, eventId: e.target.value }))
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
      <label className="block text-sm">
        <span className="mb-1 block text-stone-500">Album name</span>
        <input
          value={bulk.albumName}
          onChange={(e) =>
            setBulk((current) => ({ ...current, albumName: e.target.value }))
          }
          list="gallery-album-suggestions"
          placeholder="Required for bulk upload"
          className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2"
        />
        <datalist id="gallery-album-suggestions">
          {albums.map((album) => (
            <option key={album.id} value={album.name} />
          ))}
        </datalist>
      </label>
      <label className="block text-sm sm:col-span-2">
        <span className="mb-1 block text-stone-500">Files or zip</span>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={bulkBusy}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
          >
            <Upload className="h-4 w-4" />
            Choose files
          </button>
          <span className="text-sm text-stone-500">
            {selectedFiles.length === 0
              ? "No files selected"
              : `${selectedFiles.length} file${selectedFiles.length === 1 ? "" : "s"} selected`}
          </span>
        </div>
        <PortaledFileInput
          inputRef={fileInputRef}
          id="gallery-bulk-upload"
          accept="image/*,.zip,application/zip"
          multiple
          onChange={(event) => {
            setSelectedFiles(Array.from(event.target.files ?? []));
          }}
        />
      </label>
      <label className="block text-sm sm:col-span-2">
        <span className="mb-1 block text-stone-500">
          Caption for all (optional)
        </span>
        <input
          value={bulk.caption}
          onChange={(e) =>
            setBulk((current) => ({ ...current, caption: e.target.value }))
          }
          className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-stone-500">Tag people (optional)</span>
        <input
          value={bulk.guestNames}
          onChange={(e) =>
            setBulk((current) => ({ ...current, guestNames: e.target.value }))
          }
          placeholder="Applies to every uploaded photo"
          className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-stone-500">Groupings (optional)</span>
        <input
          value={bulk.groupings}
          onChange={(e) =>
            setBulk((current) => ({ ...current, groupings: e.target.value }))
          }
          placeholder="Family, Bridal party"
          className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2"
        />
      </label>
      <div className="sm:col-span-2">
        <button
          type="button"
          disabled={bulkBusy}
          onClick={() => void uploadBulk()}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-deep px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          <Upload className="h-4 w-4" />
          {bulkBusy ? "Uploading…" : "Upload to album"}
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
    return (
      <div className="space-y-4">
        {addForm}
        {bulkForm}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-serif text-lg text-brand-deep">Photo gallery</h3>
        <p className="mt-1 text-sm text-stone-500">
          Upload photos in bulk (including zip files), organise them into albums,
          and tag people or groupings. Photos appear on{" "}
          <code className="text-xs">/gallery</code>
          {!photoGalleryEnabled
            ? ". Enable the gallery under Public features when you are ready to go live."
            : "."}
        </p>
      </div>

      {galleryEvents.length === 0 ? (
        <p className="text-sm text-stone-500">
          Create a wedding event under Invitations before adding photos.
        </p>
      ) : (
        <div className="space-y-4">
          {bulkForm}
          {addForm}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-stone-500">Loading photos…</p>
      ) : photos.length === 0 ? (
        <p className="text-sm text-stone-500">No photos yet.</p>
      ) : (
        <GalleryEditablePhotoGrid
          photos={photos}
          events={galleryEvents}
          albums={albums}
          onPhotoUpdated={handlePhotoUpdated}
          onPhotoRemoved={handlePhotoRemoved}
        />
      )}
    </div>
  );
}
