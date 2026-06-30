import { asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { galleryPhotos, galleryPhotoTags, weddingEvents } from "@/lib/schema";

export async function listGalleryPhotos(eventId?: number) {
  const photos = await db
    .select({
      id: galleryPhotos.id,
      eventId: galleryPhotos.eventId,
      eventName: weddingEvents.name,
      url: galleryPhotos.url,
      caption: galleryPhotos.caption,
      createdAt: galleryPhotos.createdAt,
    })
    .from(galleryPhotos)
    .innerJoin(weddingEvents, eq(galleryPhotos.eventId, weddingEvents.id))
    .where(eventId ? eq(galleryPhotos.eventId, eventId) : undefined)
    .orderBy(desc(galleryPhotos.createdAt));

  if (photos.length === 0) return [];

  const photoIds = photos.map((photo) => photo.id);
  const allTags = await db
    .select()
    .from(galleryPhotoTags)
    .where(inArray(galleryPhotoTags.photoId, photoIds));

  const tagsByPhoto = new Map<number, typeof allTags>();
  for (const tag of allTags) {
    const list = tagsByPhoto.get(tag.photoId) ?? [];
    list.push(tag);
    tagsByPhoto.set(tag.photoId, list);
  }

  return photos.map((photo) => ({
    ...photo,
    tags: (tagsByPhoto.get(photo.id) ?? []).map((tag) => ({
      guestName: tag.guestName,
      email: tag.email,
    })),
  }));
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
