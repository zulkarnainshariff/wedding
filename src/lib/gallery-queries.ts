import { and, asc, desc, eq, ilike, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  galleryAlbums,
  galleryPhotoGroupings,
  galleryPhotos,
  galleryPhotoTags,
  weddingEvents,
} from "@/lib/schema";
import { galleryMediaUrl } from "@/lib/gallery-storage";

export type GalleryListFilters = {
  eventId?: number;
  albumId?: number;
  grouping?: string;
  person?: string;
};

function displayUrl(photo: {
  id: number;
  url: string;
  storageKey: string | null;
}): string {
  if (photo.storageKey) return galleryMediaUrl(photo.id);
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
      .select()
      .from(galleryPhotoTags)
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
    storageKey: photo.storageKey,
    originalFilename: photo.originalFilename,
    mimeType: photo.mimeType,
    caption: photo.caption,
    createdAt: photo.createdAt,
    tags: (tagsByPhoto.get(photo.id) ?? []).map((tag) => ({
      guestName: tag.guestName,
      email: tag.email,
    })),
    groupings: groupingsByPhoto.get(photo.id) ?? [],
  }));

  if (filters.person?.trim()) {
    const needle = filters.person.trim().toLowerCase();
    result = result.filter((photo) =>
      photo.tags.some((tag) => tag.guestName.toLowerCase().includes(needle)),
    );
  }

  if (filters.grouping?.trim()) {
    const needle = filters.grouping.trim().toLowerCase();
    result = result.filter((photo) =>
      photo.groupings.some((grouping) =>
        grouping.toLowerCase().includes(needle),
      ),
    );
  }

  return result;
}

export async function listGalleryFilterOptions() {
  const [groupings, people] = await Promise.all([
    db
      .selectDistinct({ grouping: galleryPhotoGroupings.grouping })
      .from(galleryPhotoGroupings)
      .orderBy(asc(galleryPhotoGroupings.grouping)),
    db
      .selectDistinct({ guestName: galleryPhotoTags.guestName })
      .from(galleryPhotoTags)
      .orderBy(asc(galleryPhotoTags.guestName)),
  ]);

  return {
    groupings: groupings.map((row) => row.grouping),
    people: people.map((row) => row.guestName),
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
  tags: { guestName: string; email?: string | null }[],
) {
  await db.delete(galleryPhotoTags).where(eq(galleryPhotoTags.photoId, photoId));
  const rows = tags
    .filter((tag) => tag.guestName?.trim())
    .map((tag) => ({
      photoId,
      guestName: tag.guestName.trim(),
      email: tag.email?.trim() || null,
    }));
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

export async function getGalleryPhotoById(photoId: number) {
  const [photo] = await db
    .select()
    .from(galleryPhotos)
    .where(eq(galleryPhotos.id, photoId))
    .limit(1);
  return photo ?? null;
}
