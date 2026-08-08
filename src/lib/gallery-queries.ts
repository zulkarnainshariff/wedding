import { and, asc, desc, eq, ilike, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  galleryAlbums,
  galleryPhotoGroupings,
  galleryPhotos,
  galleryPhotoTags,
  users,
  weddingEvents,
} from "@/lib/schema";
import { galleryMediaUrl, galleryThumbUrl } from "@/lib/gallery-storage";

export type GalleryListFilters = {
  eventId?: number;
  albumId?: number;
  grouping?: string;
  groupings?: string[];
  person?: string;
  people?: string[];
  /** When false, private photos are excluded. Admins pass true. */
  includePrivate?: boolean;
};

export type GalleryPeopleTagInput = {
  guestName: string;
  email?: string | null;
  userId?: number | null;
};

function displayUrl(photo: {
  id: number;
  url: string;
  storageKey: string | null;
}): string {
  if (photo.storageKey) return galleryMediaUrl(photo.id);
  return photo.url;
}

function displayThumbUrl(photo: {
  id: number;
  url: string;
  storageKey: string | null;
}): string {
  if (photo.storageKey) return galleryThumbUrl(photo.id);
  return photo.url;
}

export async function listGalleryAlbums() {
  return db
    .select({
      id: galleryAlbums.id,
      name: galleryAlbums.name,
      sortOrder: galleryAlbums.sortOrder,
      createdAt: galleryAlbums.createdAt,
    })
    .from(galleryAlbums)
    .orderBy(asc(galleryAlbums.sortOrder), asc(galleryAlbums.name));
}

export async function findOrCreateAlbumByName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return null;

  const [existing] = await db
    .select()
    .from(galleryAlbums)
    .where(ilike(galleryAlbums.name, trimmed))
    .limit(1);

  if (existing) return existing;

  const [created] = await db
    .insert(galleryAlbums)
    .values({ name: trimmed })
    .returning();
  return created;
}

export async function listGalleryPhotos(filters: GalleryListFilters = {}) {
  const conditions = [];
  if (filters.eventId) {
    conditions.push(eq(galleryPhotos.eventId, filters.eventId));
  }
  if (filters.albumId) {
    conditions.push(eq(galleryPhotos.albumId, filters.albumId));
  }
  if (!filters.includePrivate) {
    conditions.push(eq(galleryPhotos.isPrivate, false));
  }

  const photos = await db
    .select({
      id: galleryPhotos.id,
      eventId: galleryPhotos.eventId,
      eventName: weddingEvents.name,
      albumId: galleryPhotos.albumId,
      albumName: galleryAlbums.name,
      url: galleryPhotos.url,
      storageKey: galleryPhotos.storageKey,
      originalFilename: galleryPhotos.originalFilename,
      mimeType: galleryPhotos.mimeType,
      caption: galleryPhotos.caption,
      isPrivate: galleryPhotos.isPrivate,
      createdAt: galleryPhotos.createdAt,
    })
    .from(galleryPhotos)
    .innerJoin(weddingEvents, eq(galleryPhotos.eventId, weddingEvents.id))
    .leftJoin(galleryAlbums, eq(galleryPhotos.albumId, galleryAlbums.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(galleryPhotos.createdAt));

  if (photos.length === 0) return [];

  const photoIds = photos.map((photo) => photo.id);
  const [allTags, allGroupings] = await Promise.all([
    db
      .select({
        photoId: galleryPhotoTags.photoId,
        guestName: galleryPhotoTags.guestName,
        email: galleryPhotoTags.email,
        userId: galleryPhotoTags.userId,
        username: users.username,
      })
      .from(galleryPhotoTags)
      .leftJoin(users, eq(galleryPhotoTags.userId, users.id))
      .where(inArray(galleryPhotoTags.photoId, photoIds)),
    db
      .select()
      .from(galleryPhotoGroupings)
      .where(inArray(galleryPhotoGroupings.photoId, photoIds)),
  ]);

  const tagsByPhoto = new Map<number, typeof allTags>();
  for (const tag of allTags) {
    const list = tagsByPhoto.get(tag.photoId) ?? [];
    list.push(tag);
    tagsByPhoto.set(tag.photoId, list);
  }

  const groupingsByPhoto = new Map<number, string[]>();
  for (const row of allGroupings) {
    const list = groupingsByPhoto.get(row.photoId) ?? [];
    list.push(row.grouping);
    groupingsByPhoto.set(row.photoId, list);
  }

  let result = photos.map((photo) => ({
    id: photo.id,
    eventId: photo.eventId,
    eventName: photo.eventName,
    albumId: photo.albumId,
    albumName: photo.albumName,
    url: displayUrl(photo),
    thumbUrl: displayThumbUrl(photo),
    storageKey: photo.storageKey,
    originalFilename: photo.originalFilename,
    mimeType: photo.mimeType,
    caption: photo.caption,
    isPrivate: photo.isPrivate,
    createdAt: photo.createdAt,
    tags: (tagsByPhoto.get(photo.id) ?? []).map((tag) => ({
      guestName: tag.guestName,
      email: tag.email,
      userId: tag.userId,
      username: tag.username ?? null,
    })),
    groupings: groupingsByPhoto.get(photo.id) ?? [],
  }));

  const peopleNeedles = [
    ...new Set(
      [
        ...(filters.people ?? []),
        ...(filters.person?.trim() ? [filters.person.trim()] : []),
      ]
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
  if (peopleNeedles.length > 0) {
    result = result.filter((photo) =>
      peopleNeedles.some((needle) =>
        photo.tags.some(
          (tag) =>
            tag.guestName.toLowerCase() === needle ||
            tag.guestName.toLowerCase().includes(needle) ||
            tag.username?.toLowerCase() === needle ||
            tag.email?.toLowerCase() === needle,
        ),
      ),
    );
  }

  const groupingNeedles = [
    ...new Set(
      [
        ...(filters.groupings ?? []),
        ...(filters.grouping?.trim() ? [filters.grouping.trim()] : []),
      ]
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
  if (groupingNeedles.length > 0) {
    result = result.filter((photo) =>
      groupingNeedles.some((needle) =>
        photo.groupings.some(
          (grouping) =>
            grouping.toLowerCase() === needle ||
            grouping.toLowerCase().includes(needle),
        ),
      ),
    );
  }

  return result;
}

export async function listGalleryFilterOptions() {
  const [groupings, peopleRows] = await Promise.all([
    db
      .selectDistinct({ grouping: galleryPhotoGroupings.grouping })
      .from(galleryPhotoGroupings)
      .orderBy(asc(galleryPhotoGroupings.grouping)),
    db
      .select({
        guestName: galleryPhotoTags.guestName,
        email: galleryPhotoTags.email,
        userId: galleryPhotoTags.userId,
        username: users.username,
      })
      .from(galleryPhotoTags)
      .leftJoin(users, eq(galleryPhotoTags.userId, users.id))
      .orderBy(asc(galleryPhotoTags.guestName)),
  ]);

  const peopleMap = new Map<
    string,
    {
      guestName: string;
      email: string | null;
      userId: number | null;
      username: string | null;
      label: string;
    }
  >();

  for (const row of peopleRows) {
    const key = row.guestName.toLowerCase();
    if (peopleMap.has(key)) continue;
    const parts = [row.guestName];
    if (row.username) parts.push(`@${row.username}`);
    else if (row.email) parts.push(row.email);
    peopleMap.set(key, {
      guestName: row.guestName,
      email: row.email,
      userId: row.userId,
      username: row.username ?? null,
      label: parts.join(" · "),
    });
  }

  return {
    groupings: groupings.map((row) => row.grouping),
    people: [...peopleMap.values()].sort((a, b) =>
      a.guestName.localeCompare(b.guestName),
    ),
  };
}

export async function listPublishedEventsForGallery() {
  return db
    .select({ id: weddingEvents.id, name: weddingEvents.name })
    .from(weddingEvents)
    .where(eq(weddingEvents.published, true))
    .orderBy(asc(weddingEvents.sortOrder));
}

export async function listAllEventsForGallery() {
  return db
    .select({ id: weddingEvents.id, name: weddingEvents.name })
    .from(weddingEvents)
    .orderBy(asc(weddingEvents.sortOrder));
}

export async function replacePhotoPeopleTags(
  photoId: number,
  tags: GalleryPeopleTagInput[],
) {
  await db.delete(galleryPhotoTags).where(eq(galleryPhotoTags.photoId, photoId));
  const seen = new Set<string>();
  const rows = [];
  for (const tag of tags) {
    const guestName = tag.guestName?.trim();
    if (!guestName) continue;
    const key = guestName.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({
      photoId,
      guestName,
      email: tag.email?.trim() || null,
      userId: tag.userId && tag.userId > 0 ? tag.userId : null,
    });
  }
  if (rows.length > 0) {
    await db.insert(galleryPhotoTags).values(rows);
  }
}

export async function replacePhotoGroupings(
  photoId: number,
  groupings: string[],
) {
  await db
    .delete(galleryPhotoGroupings)
    .where(eq(galleryPhotoGroupings.photoId, photoId));
  const rows = [
    ...new Set(groupings.map((entry) => entry.trim()).filter(Boolean)),
  ].map((grouping) => ({ photoId, grouping }));
  if (rows.length > 0) {
    await db.insert(galleryPhotoGroupings).values(rows);
  }
}

export async function appendPhotoGroupings(
  photoIds: number[],
  grouping: string,
) {
  const label = grouping.trim();
  if (!label || photoIds.length === 0) return;

  const existing = await db
    .select({
      photoId: galleryPhotoGroupings.photoId,
      grouping: galleryPhotoGroupings.grouping,
    })
    .from(galleryPhotoGroupings)
    .where(inArray(galleryPhotoGroupings.photoId, photoIds));

  const existingKeys = new Set(
    existing.map((row) => `${row.photoId}::${row.grouping.toLowerCase()}`),
  );

  const rows = photoIds
    .filter((photoId) => !existingKeys.has(`${photoId}::${label.toLowerCase()}`))
    .map((photoId) => ({ photoId, grouping: label }));

  if (rows.length > 0) {
    await db.insert(galleryPhotoGroupings).values(rows);
  }
}

export async function movePhotosToAlbum(options: {
  photoIds: number[];
  albumId: number | null;
  addPreviousAlbumAsTag: boolean;
}) {
  const photoIds = [...new Set(options.photoIds.filter((id) => id > 0))];
  if (photoIds.length === 0) {
    return { moved: 0, previousAlbumNames: [] as string[] };
  }

  const current = await db
    .select({
      id: galleryPhotos.id,
      albumId: galleryPhotos.albumId,
      albumName: galleryAlbums.name,
    })
    .from(galleryPhotos)
    .leftJoin(galleryAlbums, eq(galleryPhotos.albumId, galleryAlbums.id))
    .where(inArray(galleryPhotos.id, photoIds));

  const previousAlbumNames = [
    ...new Set(
      current
        .map((row) => row.albumName?.trim())
        .filter((name): name is string => Boolean(name)),
    ),
  ];

  await db
    .update(galleryPhotos)
    .set({ albumId: options.albumId })
    .where(inArray(galleryPhotos.id, photoIds));

  if (options.addPreviousAlbumAsTag) {
    const byAlbumName = new Map<string, number[]>();
    for (const row of current) {
      const name = row.albumName?.trim();
      if (!name) continue;
      const list = byAlbumName.get(name) ?? [];
      list.push(row.id);
      byAlbumName.set(name, list);
    }
    for (const [name, ids] of byAlbumName) {
      await appendPhotoGroupings(ids, name);
    }
  }

  return { moved: current.length, previousAlbumNames };
}

export async function getGalleryPhotoById(photoId: number) {
  const [photo] = await db
    .select()
    .from(galleryPhotos)
    .where(eq(galleryPhotos.id, photoId))
    .limit(1);
  return photo ?? null;
}
