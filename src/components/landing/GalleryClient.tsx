"use client";

import { useEffect, useState } from "react";
import { PublicHeader } from "@/components/landing/PublicHeader";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  GalleryManagementPanel,
  type GalleryPhoto,
} from "@/components/admin/GalleryManagementPanel";
import {
  GalleryEditablePhotoGrid,
  GalleryPhotoCard,
} from "@/components/gallery/GalleryPhotoGrid";

type GalleryPhotoView = GalleryPhoto;

export function GalleryClient({
  enabled,
  guestbookEnabled = false,
  photoGalleryEnabled = enabled,
}: {
  enabled: boolean;
  guestbookEnabled?: boolean;
  photoGalleryEnabled?: boolean;
}) {
  const { user } = useAuth();
  const [photos, setPhotos] = useState<GalleryPhotoView[]>([]);
  const [eventFilter, setEventFilter] = useState("");
  const [events, setEvents] = useState<{ id: number; name: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = Boolean(user?.isAdmin);
  const galleryVisible = enabled || isAdmin;

  useEffect(() => {
    if (!galleryVisible) return;
    const params = eventFilter ? `?eventId=${eventFilter}` : "";
    void (async () => {
      const response = await fetch(`/api/gallery${params}`);
      if (!response.ok) {
        setError("Gallery is unavailable.");
        return;
      }
      const data = await response.json();
      setPhotos(data.photos ?? []);
      setEvents(data.events ?? []);
      setError(null);
    })();
  }, [galleryVisible, eventFilter]);

  if (!galleryVisible) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <PublicHeader />
        <main className="mx-auto w-full max-w-5xl px-4 py-6 text-center">
          <p className="text-stone-600">The photo gallery is not open right now.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PublicHeader />
      <main className="mx-auto w-full max-w-5xl px-4 py-6">
        <h1 className="font-serif text-3xl text-brand-deep">Photo gallery</h1>
        <p className="mt-2 text-sm text-stone-500">
          Shared moments from our celebrations.
        </p>

        {isAdmin && (
          <div className="mt-6">
            <GalleryManagementPanel
              compact
              events={events}
              photoGalleryEnabled={enabled}
              onPhotoAdded={(photo) => setPhotos((current) => [photo, ...current])}
            />
          </div>
        )}

        {!enabled && isAdmin && (
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            The gallery is off for guests. Enable it under Admin → Public
            features when you are ready.
          </p>
        )}

        {events.length > 1 && (
          <select
            value={eventFilter}
            onChange={(e) => setEventFilter(e.target.value)}
            className="mt-6 rounded-lg border border-stone-200 px-3 py-2 text-sm"
          >
            <option value="">All events</option>
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.name}
              </option>
            ))}
          </select>
        )}

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        <div className="mt-8">
          {photos.length === 0 ? (
            <p className="text-sm text-stone-500">No photos yet.</p>
          ) : isAdmin ? (
            <GalleryEditablePhotoGrid
              photos={photos}
              events={events}
              onPhotoUpdated={(photo) =>
                setPhotos((current) =>
                  current.map((entry) => (entry.id === photo.id ? photo : entry)),
                )
              }
              onPhotoRemoved={(photoId) =>
                setPhotos((current) => current.filter((photo) => photo.id !== photoId))
              }
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {photos.map((photo) => (
                <GalleryPhotoCard key={photo.id} photo={photo} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
