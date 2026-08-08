"use client";

import { useEffect, useMemo, useState } from "react";
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
import { MultiSelectFilter } from "@/components/gallery/MultiSelectFilter";

type GalleryPhotoView = GalleryPhoto;
type GalleryTab = "photos" | "manage";

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
  const [tagFilters, setTagFilters] = useState<string[]>([]);
  const [peopleFilters, setPeopleFilters] = useState<string[]>([]);
  /** "" = any-of selected, "untagged" = no grouping tags */
  const [tagsMode, setTagsMode] = useState<"" | "untagged">("");
  /** "" = any-of selected, "exact" = only those people, "untagged" = no people tags */
  const [peopleMode, setPeopleMode] = useState<"" | "exact" | "untagged">("");
  const [events, setEvents] = useState<{ id: number; name: string }[]>([]);
  const [albums, setAlbums] = useState<GalleryAlbum[]>([]);
  const [groupings, setGroupings] = useState<string[]>([]);
  const [people, setPeople] = useState<GalleryPersonFilterOption[]>([]);
  const [albumMoveTagMode, setAlbumMoveTagMode] =
    useState<GalleryAlbumMoveTagMode>(initialAlbumMoveTagMode);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<GalleryTab>("photos");

  const isAdmin = Boolean(user?.isAdmin);
  const galleryVisible = enabled || isAdmin;
  const untaggedTagsOnly = tagsMode === "untagged";
  const untaggedPeopleOnly = peopleMode === "untagged";
  const peopleExact = peopleMode === "exact";
  const filterKey = `${eventFilter}|${albumFilter}|${tagFilters.join(",")}|${peopleFilters.join(",")}|${tagsMode}|${peopleMode}`;

  const peopleOptions = useMemo(
    () =>
      people.map((person) => ({
        value: person.guestName,
        label: person.label,
      })),
    [people],
  );
  const knownPeopleNames = useMemo(
    () => people.map((person) => person.guestName),
    [people],
  );
  const tagOptions = useMemo(
    () => groupings.map((tag) => ({ value: tag, label: tag })),
    [groupings],
  );

  useEffect(() => {
    if (!galleryVisible) return;
    const params = new URLSearchParams();
    if (eventFilter) params.set("eventId", eventFilter);
    if (albumFilter) params.set("albumId", albumFilter);
    if (untaggedTagsOnly) {
      params.set("untaggedGroupings", "1");
    } else if (tagFilters.length > 0) {
      params.set("tags", tagFilters.join(","));
    }
    if (untaggedPeopleOnly) {
      params.set("untaggedPeople", "1");
    } else if (peopleFilters.length > 0) {
      params.set("people", peopleFilters.join(","));
      if (peopleExact) params.set("peopleExact", "1");
    }
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
  }, [
    galleryVisible,
    eventFilter,
    albumFilter,
    tagFilters,
    peopleFilters,
    tagsMode,
    peopleMode,
    untaggedTagsOnly,
    untaggedPeopleOnly,
    peopleExact,
  ]);

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
          <div className="mt-6 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setTab("photos")}
              className={[
                "rounded-xl px-4 py-2 text-sm font-medium",
                tab === "photos"
                  ? "bg-brand-deep text-white"
                  : "border border-stone-200 bg-white text-stone-600",
              ].join(" ")}
            >
              Photos
            </button>
            <button
              type="button"
              onClick={() => setTab("manage")}
              className={[
                "rounded-xl px-4 py-2 text-sm font-medium",
                tab === "manage"
                  ? "bg-brand-deep text-white"
                  : "border border-stone-200 bg-white text-stone-600",
              ].join(" ")}
            >
              Manage
            </button>
          </div>
        )}

        {isAdmin && tab === "manage" && (
          <div className="mt-6">
            <GalleryManagementPanel
              compact
              events={events}
              photoGalleryEnabled={enabled}
              albumMoveTagMode={albumMoveTagMode}
              onAlbumMoveTagModeChange={setAlbumMoveTagMode}
              onAlbumsChange={setAlbums}
              onGroupingsChange={setGroupings}
              onPeopleChange={setPeople}
              onTagRenamed={(from, to) => {
                setPhotos((current) =>
                  current.map((photo) => ({
                    ...photo,
                    groupings: [
                      ...new Set(
                        (photo.groupings ?? []).map((tag) =>
                          tag === from ? to : tag,
                        ),
                      ),
                    ],
                  })),
                );
                setTagFilters((current) => [
                  ...new Set(
                    current.map((tag) => (tag === from ? to : tag)),
                  ),
                ]);
              }}
              onPersonRenamed={(from, to) => {
                setPhotos((current) =>
                  current.map((photo) => ({
                    ...photo,
                    tags: (() => {
                      const renamed = photo.tags.map((tag) =>
                        tag.guestName === from
                          ? { ...tag, guestName: to }
                          : tag,
                      );
                      const seen = new Set<string>();
                      return renamed.filter((tag) => {
                        const key = tag.guestName.toLowerCase();
                        if (seen.has(key)) return false;
                        seen.add(key);
                        return true;
                      });
                    })(),
                  })),
                );
                setPeopleFilters((current) => [
                  ...new Set(
                    current.map((name) => (name === from ? to : name)),
                  ),
                ]);
              }}
              onPhotoAdded={(photo) => {
                setPhotos((current) => [photo, ...current]);
                setTab("photos");
              }}
            />
          </div>
        )}

        {!enabled && isAdmin && (
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            The gallery is off for guests. Enable it under Admin → Public
            features when you are ready.
          </p>
        )}

        {(!isAdmin || tab === "photos") && (
          <>
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
              <select
                value={tagsMode}
                onChange={(e) => {
                  const next = e.target.value as "" | "untagged";
                  setTagsMode(next);
                  if (next === "untagged") setTagFilters([]);
                }}
                className="rounded-lg border border-stone-200 px-3 py-2 text-sm"
              >
                <option value="">Select tags</option>
                <option value="untagged">No tags</option>
              </select>
              {!untaggedTagsOnly && tagOptions.length > 0 && (
                <MultiSelectFilter
                  label="Tags"
                  emptyLabel="All tags"
                  options={tagOptions}
                  selected={tagFilters}
                  onChange={setTagFilters}
                />
              )}
              <select
                value={peopleMode}
                onChange={(e) => {
                  const next = e.target.value as "" | "exact" | "untagged";
                  setPeopleMode(next);
                  if (next === "untagged") setPeopleFilters([]);
                }}
                className="rounded-lg border border-stone-200 px-3 py-2 text-sm"
              >
                <option value="">Select people</option>
                <option value="exact">Only selected people</option>
                <option value="untagged">Untagged photos</option>
              </select>
              {!untaggedPeopleOnly && peopleOptions.length > 0 && (
                <MultiSelectFilter
                  label="People"
                  emptyLabel="Everyone"
                  options={peopleOptions}
                  selected={peopleFilters}
                  onChange={setPeopleFilters}
                />
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
                  knownPeopleNames={knownPeopleNames}
                  knownTags={groupings}
                  albumMoveTagMode={albumMoveTagMode}
                  onAlbumMoveTagModeChange={setAlbumMoveTagMode}
                  onAlbumsChange={setAlbums}
                  onPhotoUpdated={(photo) =>
                    setPhotos((current) =>
                      current.map((entry) =>
                        entry.id === photo.id ? photo : entry,
                      ),
                    )
                  }
                  onPhotoRemoved={(photoId) =>
                    setPhotos((current) =>
                      current.filter((photo) => photo.id !== photoId),
                    )
                  }
                  onPhotosMoved={(moved) => {
                    const byId = new Map(
                      moved.map((photo) => [photo.id, photo]),
                    );
                    setPhotos((current) =>
                      current.map((photo) => byId.get(photo.id) ?? photo),
                    );
                  }}
                />
              ) : (
                <GalleryPublicPhotoGrid
                  photos={photos}
                  paginationKey={filterKey}
                />
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
