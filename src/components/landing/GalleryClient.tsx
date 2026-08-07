"use client";

import { useEffect, useState } from "react";
import { PublicHeader } from "@/components/landing/PublicHeader";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  GalleryManagementPanel,
  type GalleryAlbum,
  type GalleryPersonFilterOption,
  type GalleryPhoto,
} from "@/components/admin/GalleryManagementPanel";
import type { GalleryAlbumMoveTagMode } from "@/components/admin/PublicFeaturesPanel";
import {
  GalleryEditablePhotoGrid,
  GalleryPublicPhotoGrid,
} from "@/components/gallery/GalleryPhotoGrid";

type GalleryPhotoView = GalleryPhoto;

function normalizePeople(
  people: unknown,
): GalleryPersonFilterOption[] {
  if (!Array.isArray(people)) return [];
  return people
    .map((entry) => {
      if (typeof entry === "string") {
        return {
          guestName: entry,
          email: null,
          userId: null,
          username: null,
          label: entry,
        };
      }
      if (entry && typeof entry === "object" && "guestName" in entry) {
        const row = entry as GalleryPersonFilterOption;
        return {
          guestName: row.guestName,
          email: row.email ?? null,
          userId: row.userId ?? null,
          username: row.username ?? null,
          label: row.label || row.guestName,
        };
      }
      return null;
    })
    .filter((entry): entry is GalleryPersonFilterOption => Boolean(entry));
}

export function GalleryClient({
  enabled,
  guestbookEnabled = false,
  photoGalleryEnabled = enabled,
  initialAlbumMoveTagMode = "ask",
}: {
  enabled: boolean;
  guestbookEnabled?: boolean;
  photoGalleryEnabled?: boolean;
  initialAlbumMoveTagMode?: GalleryAlbumMoveTagMode;
}) {
  const { user } = useAuth();
  const [photos, setPhotos] = useState<GalleryPhotoView[]>([]);
  const [eventFilter, setEventFilter] = useState("");
  const [albumFilter, setAlbumFilter] = useState("");
  const [groupingFilter, setGroupingFilter] = useState("");
  const [personFilter, setPersonFilter] = useState("");
  const [events, setEvents] = useState<{ id: number; name: string }[]>([]);
  const [albums, setAlbums] = useState<GalleryAlbum[]>([]);
  const [groupings, setGroupings] = useState<string[]>([]);
  const [people, setPeople] = useState<GalleryPersonFilterOption[]>([]);
  const [albumMoveTagMode, setAlbumMoveTagMode] =
    useState<GalleryAlbumMoveTagMode>(initialAlbumMoveTagMode);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = Boolean(user?.isAdmin);
  const galleryVisible = enabled || isAdmin;
  const filterKey = `${eventFilter}|${albumFilter}|${groupingFilter}|${personFilter}`;

  useEffect(() => {
    if (!galleryVisible) return;
    const params = new URLSearchParams();
    if (eventFilter) params.set("eventId", eventFilter);
    if (albumFilter) params.set("albumId", albumFilter);
    if (groupingFilter) params.set("grouping", groupingFilter);
    if (personFilter) params.set("person", personFilter);
    const query = params.toString() ? `?${params.toString()}` : "";

    void (async () => {
      const response = await fetch(`/api/gallery${query}`);
      if (!response.ok) {
        setError("Gallery is unavailable.");
        return;
      }
      const data = await response.json();
      setPhotos(data.photos ?? []);
      setEvents(data.events ?? []);
      setAlbums(data.albums ?? []);
      setGroupings(data.groupings ?? []);
      setPeople(normalizePeople(data.people));
      if (data.albumMoveTagMode) {
        setAlbumMoveTagMode(data.albumMoveTagMode);
      }
      setError(null);
    })();
  }, [galleryVisible, eventFilter, albumFilter, groupingFilter, personFilter]);

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
              albumMoveTagMode={albumMoveTagMode}
              onAlbumMoveTagModeChange={setAlbumMoveTagMode}
              onAlbumsChange={setAlbums}
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

        <div className="mt-6 flex flex-wrap gap-3">
          {events.length > 1 && (
            <select
              value={eventFilter}
              onChange={(e) => setEventFilter(e.target.value)}
              className="rounded-lg border border-stone-200 px-3 py-2 text-sm"
            >
              <option value="">All events</option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.name}
                </option>
              ))}
            </select>
          )}
          {albums.length > 0 && (
            <select
              value={albumFilter}
              onChange={(e) => setAlbumFilter(e.target.value)}
              className="rounded-lg border border-stone-200 px-3 py-2 text-sm"
            >
              <option value="">All albums</option>
              {albums.map((album) => (
                <option key={album.id} value={album.id}>
                  {album.name}
                </option>
              ))}
            </select>
          )}
          {groupings.length > 0 && (
            <select
              value={groupingFilter}
              onChange={(e) => setGroupingFilter(e.target.value)}
              className="rounded-lg border border-stone-200 px-3 py-2 text-sm"
            >
              <option value="">All groupings</option>
              {groupings.map((grouping) => (
                <option key={grouping} value={grouping}>
                  {grouping}
                </option>
              ))}
            </select>
          )}
          {people.length > 0 && (
            <select
              value={personFilter}
              onChange={(e) => setPersonFilter(e.target.value)}
              className="rounded-lg border border-stone-200 px-3 py-2 text-sm"
            >
              <option value="">All people</option>
              {people.map((person) => (
                <option key={person.guestName} value={person.guestName}>
                  {person.label}
                </option>
              ))}
            </select>
          )}
        </div>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        <div className="mt-8">
          {photos.length === 0 ? (
            <p className="text-sm text-stone-500">No photos yet.</p>
          ) : isAdmin ? (
            <GalleryEditablePhotoGrid
              photos={photos}
              events={events}
              albums={albums}
              paginationKey={filterKey}
              albumMoveTagMode={albumMoveTagMode}
              onAlbumMoveTagModeChange={setAlbumMoveTagMode}
              onAlbumsChange={setAlbums}
              onPhotoUpdated={(photo) =>
                setPhotos((current) =>
                  current.map((entry) => (entry.id === photo.id ? photo : entry)),
                )
              }
              onPhotoRemoved={(photoId) =>
                setPhotos((current) => current.filter((photo) => photo.id !== photoId))
              }
              onPhotosMoved={(moved) => {
                const byId = new Map(moved.map((photo) => [photo.id, photo]));
                setPhotos((current) =>
                  current.map((photo) => byId.get(photo.id) ?? photo),
                );
              }}
            />
          ) : (
            <GalleryPublicPhotoGrid photos={photos} paginationKey={filterKey} />
          )}
        </div>
      </main>
    </div>
  );
}
