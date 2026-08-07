"use client";

import { useEffect, useState } from "react";
import { Maximize2, Pencil, Trash2, X } from "lucide-react";
import { useToast } from "@/components/ui/ToastProvider";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  formatCommaList,
  formatGuestNames,
  parseGuestNames,
} from "@/lib/gallery-photo-utils";
import type {
  GalleryAlbum,
  GalleryEvent,
  GalleryPhoto,
} from "@/components/admin/GalleryManagementPanel";

type PhotoFormState = {
  eventId: string;
  albumId: string;
  albumName: string;
  url: string;
  caption: string;
  guestNames: string;
  groupings: string;
};

function photoToForm(photo: GalleryPhoto): PhotoFormState {
  return {
    eventId: String(photo.eventId),
    albumId: photo.albumId ? String(photo.albumId) : "",
    albumName: "",
    url: photo.url,
    caption: photo.caption ?? "",
    guestNames: formatGuestNames(photo.tags),
    groupings: formatCommaList(photo.groupings ?? []),
  };
}

function GalleryPhotoEditDialog({
  photo,
  events,
  albums,
  busy,
  onClose,
  onSave,
}: {
  photo: GalleryPhoto;
  events: GalleryEvent[];
  albums: GalleryAlbum[];
  busy: boolean;
  onClose: () => void;
  onSave: (form: PhotoFormState) => void;
}) {
  const [form, setForm] = useState(() => photoToForm(photo));
  const isUploaded = photo.url.startsWith("/api/gallery/media/");

  useEffect(() => {
    setForm(photoToForm(photo));
  }, [photo]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
      role="presentation"
    >
      <div className="absolute inset-0 bg-stone-900/45 backdrop-blur-[2px]" />
      <div
        className="relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-stone-200 bg-white p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="gallery-edit-title"
      >
        <h2 id="gallery-edit-title" className="font-serif text-xl text-brand-deep">
          Edit photo
        </h2>
        <div className="mt-4 grid gap-4">
          <label className="block text-sm">
            <span className="mb-1 block text-stone-500">Event</span>
            <select
              value={form.eventId}
              onChange={(e) =>
                setForm((current) => ({ ...current, eventId: e.target.value }))
              }
              className="w-full rounded-lg border border-stone-200 px-3 py-2"
            >
              {events.map((event) => (
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
              className="w-full rounded-lg border border-stone-200 px-3 py-2"
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
            <label className="block text-sm">
              <span className="mb-1 block text-stone-500">
                Or create album
              </span>
              <input
                value={form.albumName}
                onChange={(e) =>
                  setForm((current) => ({
                    ...current,
                    albumName: e.target.value,
                  }))
                }
                placeholder="New album name"
                className="w-full rounded-lg border border-stone-200 px-3 py-2"
              />
            </label>
          ) : null}
          {!isUploaded ? (
            <label className="block text-sm">
              <span className="mb-1 block text-stone-500">Photo URL</span>
              <input
                type="url"
                value={form.url}
                onChange={(e) =>
                  setForm((current) => ({ ...current, url: e.target.value }))
                }
                className="w-full rounded-lg border border-stone-200 px-3 py-2"
              />
            </label>
          ) : (
            <p className="rounded-lg border border-stone-100 bg-stone-50 px-3 py-2 text-xs text-stone-500">
              Uploaded file — URL cannot be changed. Reassign the album or tags
              below.
            </p>
          )}
          <label className="block text-sm">
            <span className="mb-1 block text-stone-500">Caption (optional)</span>
            <input
              value={form.caption}
              onChange={(e) =>
                setForm((current) => ({ ...current, caption: e.target.value }))
              }
              className="w-full rounded-lg border border-stone-200 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-stone-500">Tag people</span>
            <input
              value={form.guestNames}
              onChange={(e) =>
                setForm((current) => ({
                  ...current,
                  guestNames: e.target.value,
                }))
              }
              placeholder="Nat, Zulkarnain"
              className="w-full rounded-lg border border-stone-200 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-stone-500">Groupings</span>
            <input
              value={form.groupings}
              onChange={(e) =>
                setForm((current) => ({
                  ...current,
                  groupings: e.target.value,
                }))
              }
              placeholder="Family, Bridal party"
              className="w-full rounded-lg border border-stone-200 px-3 py-2"
            />
          </label>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-xl border border-stone-200 px-4 py-2.5 text-sm text-stone-600 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onSave(form)}
            className="rounded-xl bg-brand-deep px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

function GalleryPhotoLightbox({
  photo,
  onClose,
}: {
  photo: GalleryPhoto;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div className="absolute inset-0 bg-stone-950/80 backdrop-blur-sm" />
      <div
        className="relative flex max-h-[92vh] w-full max-w-5xl flex-col"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={photo.caption ?? photo.eventName}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-2 right-2 z-10 rounded-full bg-stone-900/70 p-2 text-white shadow-sm transition hover:bg-stone-900"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.url}
          alt={photo.caption ?? photo.eventName}
          className="max-h-[78vh] w-full rounded-2xl bg-stone-900 object-contain shadow-2xl"
        />
        <div className="mt-3 rounded-xl bg-white/95 px-4 py-3 text-sm shadow-lg">
          {photo.caption ? (
            <p className="font-medium text-stone-800">{photo.caption}</p>
          ) : null}
          <p className="text-stone-500">
            {photo.albumName ? `${photo.albumName} · ` : ""}
            {photo.eventName}
          </p>
          {photo.tags.length > 0 ? (
            <p className="mt-1 text-stone-500">
              People: {photo.tags.map((tag) => tag.guestName).join(", ")}
            </p>
          ) : null}
          {(photo.groupings?.length ?? 0) > 0 ? (
            <p className="mt-1 text-stone-500">
              Groupings: {photo.groupings.join(", ")}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function GalleryPhotoCard({
  photo,
  editable = false,
  busy = false,
  onEdit,
  onDelete,
}: {
  photo: GalleryPhoto;
  editable?: boolean;
  busy?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <figure className="group overflow-hidden rounded-xl border border-stone-200 bg-white">
        <div className="relative aspect-[4/3] overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.url}
            alt={photo.caption ?? photo.eventName}
            className="h-full w-full object-cover"
          />
          <div className="pointer-events-none absolute inset-0 bg-stone-900/0 opacity-0 transition group-hover:bg-stone-900/35 group-hover:opacity-100 group-focus-within:bg-stone-900/35 group-focus-within:opacity-100">
            <button
              type="button"
              disabled={busy}
              onClick={() => setExpanded(true)}
              className="pointer-events-auto absolute top-2 right-2 rounded-lg bg-white/95 p-2 text-stone-700 shadow-sm transition hover:bg-white disabled:opacity-50"
              aria-label="View larger"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
            {editable ? (
              <div className="absolute top-2 left-2 flex gap-1">
                <button
                  type="button"
                  disabled={busy}
                  onClick={onEdit}
                  className="pointer-events-auto rounded-lg bg-white/95 p-2 text-stone-700 shadow-sm hover:bg-white disabled:opacity-50"
                  aria-label="Edit photo"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={onDelete}
                  className="pointer-events-auto rounded-lg bg-white/95 p-2 text-red-600 shadow-sm hover:bg-white disabled:opacity-50"
                  aria-label="Delete photo"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ) : null}
          </div>
        </div>
        <figcaption className="px-3 py-2 text-sm">
          {photo.caption && (
            <p className="font-medium text-stone-800">{photo.caption}</p>
          )}
          <p className="text-xs text-stone-400">
            {photo.albumName ? `${photo.albumName} · ` : ""}
            {photo.eventName}
          </p>
          {photo.tags.length > 0 && (
            <p className="mt-1 text-xs text-stone-500">
              {photo.tags.map((tag) => tag.guestName).join(", ")}
            </p>
          )}
          {(photo.groupings?.length ?? 0) > 0 && (
            <p className="mt-1 text-xs text-brand-deep/80">
              {photo.groupings.join(" · ")}
            </p>
          )}
        </figcaption>
      </figure>

      {expanded ? (
        <GalleryPhotoLightbox photo={photo} onClose={() => setExpanded(false)} />
      ) : null}
    </>
  );
}

export function GalleryEditablePhotoGrid({
  photos,
  events,
  albums = [],
  onPhotoUpdated,
  onPhotoRemoved,
}: {
  photos: GalleryPhoto[];
  events: GalleryEvent[];
  albums?: GalleryAlbum[];
  onPhotoUpdated?: (photo: GalleryPhoto) => void;
  onPhotoRemoved?: (photoId: number) => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [editingPhoto, setEditingPhoto] = useState<GalleryPhoto | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

  async function savePhoto(form: PhotoFormState) {
    if (!editingPhoto) return;

    const eventId = Number(form.eventId);
    if (!eventId) {
      toast.error("Event is required.");
      return;
    }

    const isUploaded = editingPhoto.url.startsWith("/api/gallery/media/");
    const url = form.url.trim();
    if (!isUploaded && !url) {
      toast.error("Photo URL is required.");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch(`/api/gallery/${editingPhoto.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          albumId: form.albumId ? Number(form.albumId) : null,
          albumName: form.albumName.trim() || undefined,
          url: isUploaded ? editingPhoto.url : url,
          caption: form.caption.trim() || null,
          tags: parseGuestNames(form.guestNames),
          groupingsText: form.groupings,
        }),
      });

      if (!response.ok) {
        toast.error("Could not update photo.");
        return;
      }

      const updated = (await response.json()) as GalleryPhoto;
      onPhotoUpdated?.(updated);
      setEditingPhoto(null);
      toast.success("Photo updated.");
    } catch {
      toast.error("Could not update photo.");
    } finally {
      setBusy(false);
    }
  }

  async function deletePhoto(photoId: number) {
    setBusy(true);
    try {
      const response = await fetch(`/api/gallery/${photoId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        toast.error("Could not remove photo.");
        return;
      }
      onPhotoRemoved?.(photoId);
      toast.success("Photo removed.");
    } catch {
      toast.error("Could not remove photo.");
    } finally {
      setBusy(false);
      setPendingDeleteId(null);
    }
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {photos.map((photo) => (
          <GalleryPhotoCard
            key={photo.id}
            photo={photo}
            editable
            busy={busy}
            onEdit={() => setEditingPhoto(photo)}
            onDelete={() => setPendingDeleteId(photo.id)}
          />
        ))}
      </div>

      {editingPhoto && (
        <GalleryPhotoEditDialog
          photo={editingPhoto}
          events={events}
          albums={albums}
          busy={busy}
          onClose={() => {
            if (!busy) setEditingPhoto(null);
          }}
          onSave={(form) => void savePhoto(form)}
        />
      )}

      <ConfirmDialog
        open={pendingDeleteId != null}
        title="Remove photo?"
        message="This permanently removes the photo from the public gallery."
        confirmLabel="Remove"
        destructive
        busy={busy}
        onConfirm={() => {
          if (pendingDeleteId != null) void deletePhoto(pendingDeleteId);
        }}
        onClose={() => {
          if (!busy) setPendingDeleteId(null);
        }}
      />
    </>
  );
}
