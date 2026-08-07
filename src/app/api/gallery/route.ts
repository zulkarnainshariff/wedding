import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { isAuthError, requireAuth } from "@/lib/api-auth";
import { getSessionUser } from "@/lib/auth";
import { getAppSettings, isPhotoGalleryEnabled } from "@/lib/app-settings";
import {
  findOrCreateAlbumByName,
  listAllEventsForGallery,
  listGalleryAlbums,
  listGalleryFilterOptions,
  listGalleryPhotos,
  listPublishedEventsForGallery,
  replacePhotoGroupings,
  replacePhotoPeopleTags,
} from "@/lib/gallery-queries";
import { parseGuestNames, parseCommaList } from "@/lib/gallery-photo-utils";
import { db } from "@/lib/db";
import { galleryPhotos } from "@/lib/schema";

export async function GET(request: Request) {
  const settings = await getAppSettings();
  const sessionUser = await getSessionUser();
  const galleryEnabled = isPhotoGalleryEnabled(settings);

  if (!galleryEnabled && !sessionUser?.isAdmin) {
    return NextResponse.json({ error: "Photo gallery is not enabled." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get("eventId");
  const albumId = searchParams.get("albumId");
  const grouping = searchParams.get("grouping");
  const person = searchParams.get("person");

  const [photos, albums, filterOptions] = await Promise.all([
    listGalleryPhotos({
      eventId: eventId ? Number(eventId) : undefined,
      albumId: albumId ? Number(albumId) : undefined,
      grouping: grouping ?? undefined,
      person: person ?? undefined,
    }),
    listGalleryAlbums(),
    listGalleryFilterOptions(),
  ]);

  const events = sessionUser?.isAdmin
    ? await listAllEventsForGallery()
    : await listPublishedEventsForGallery();

  return NextResponse.json({
    photos,
    events,
    albums,
    groupings: filterOptions.groupings,
    people: filterOptions.people,
  });
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
  const albumName =
    typeof body.albumName === "string" ? body.albumName.trim() : "";
  const albumIdRaw = body.albumId != null ? Number(body.albumId) : null;
  const tags: { guestName: string; email?: string }[] = Array.isArray(body.tags)
    ? body.tags
    : parseGuestNames(String(body.guestNames ?? ""));
  const groupings: string[] = Array.isArray(body.groupings)
    ? body.groupings.map(String)
    : parseCommaList(String(body.groupingsText ?? ""));

  if (!eventId || !url) {
    return NextResponse.json(
      { error: "Event and photo URL are required." },
      { status: 400 },
    );
  }

  let albumId: number | null = albumIdRaw && albumIdRaw > 0 ? albumIdRaw : null;
  if (!albumId && albumName) {
    const album = await findOrCreateAlbumByName(albumName);
    albumId = album?.id ?? null;
  }

  const [photo] = await db
    .insert(galleryPhotos)
    .values({ eventId, albumId, url, caption })
    .returning();

  await replacePhotoPeopleTags(photo.id, tags);
  await replacePhotoGroupings(photo.id, groupings);

  const photos = await listGalleryPhotos({ eventId });
  const created = photos.find((entry) => entry.id === photo.id);

  revalidatePath("/gallery");
  return NextResponse.json(created ?? photo, { status: 201 });
}
