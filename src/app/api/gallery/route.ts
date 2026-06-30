import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { isAuthError, requireAuth } from "@/lib/api-auth";
import { getSessionUser } from "@/lib/auth";
import { getAppSettings, isPhotoGalleryEnabled } from "@/lib/app-settings";
import {
  listAllEventsForGallery,
  listGalleryPhotos,
  listPublishedEventsForGallery,
} from "@/lib/gallery-queries";
import { db } from "@/lib/db";
import { galleryPhotos, galleryPhotoTags } from "@/lib/schema";

export async function GET(request: Request) {
  const settings = await getAppSettings();
  const sessionUser = await getSessionUser();
  const galleryEnabled = isPhotoGalleryEnabled(settings);

  if (!galleryEnabled && !sessionUser?.isAdmin) {
    return NextResponse.json({ error: "Photo gallery is not enabled." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get("eventId");
  const photos = await listGalleryPhotos(eventId ? Number(eventId) : undefined);
  const events = sessionUser?.isAdmin
    ? await listAllEventsForGallery()
    : await listPublishedEventsForGallery();
  return NextResponse.json({ photos, events });
}

export async function POST(request: Request) {
  const user = await requireAuth();
  if (isAuthError(user)) return user;
  if (!user.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const eventId = Number(body.eventId);
  const url = String(body.url ?? "").trim();
  const caption = body.caption ? String(body.caption).trim() : null;
  const tags: { guestName: string; email?: string }[] = Array.isArray(body.tags)
    ? body.tags
    : [];

  if (!eventId || !url) {
    return NextResponse.json({ error: "Event and photo URL are required." }, { status: 400 });
  }

  const [photo] = await db
    .insert(galleryPhotos)
    .values({ eventId, url, caption })
    .returning();

  if (tags.length > 0) {
    await db.insert(galleryPhotoTags).values(
      tags
        .filter((tag) => tag.guestName?.trim())
        .map((tag) => ({
          photoId: photo.id,
          guestName: tag.guestName.trim(),
          email: tag.email?.trim() || null,
        })),
    );
  }

  const photos = await listGalleryPhotos(eventId);
  const created = photos.find((entry) => entry.id === photo.id);

  revalidatePath("/gallery");
  return NextResponse.json(created ?? photo, { status: 201 });
}
