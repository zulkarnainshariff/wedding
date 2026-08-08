import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { isAuthError, requireAuth } from "@/lib/api-auth";
import {
  bulkUpdateGalleryPhotos,
  listGalleryPhotos,
} from "@/lib/gallery-queries";
import { parseCommaList, parseGuestNames } from "@/lib/gallery-photo-utils";

export async function POST(request: Request) {
  const user = await requireAuth();
  if (isAuthError(user)) return user;
  if (!user.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const photoIds = Array.isArray(body.photoIds)
    ? body.photoIds.map(Number).filter((id: number) => id > 0)
    : [];

  if (photoIds.length === 0) {
    return NextResponse.json(
      { error: "Select at least one photo." },
      { status: 400 },
    );
  }

  const eventId =
    body.eventId === undefined || body.eventId === "" || body.eventId === null
      ? undefined
      : Number(body.eventId);
  const albumProvided =
    body.albumId !== undefined ||
    (typeof body.albumName === "string" && body.albumName.trim());
  const albumId =
    body.albumId === undefined
      ? undefined
      : body.albumId === null || body.albumId === ""
        ? null
        : Number(body.albumId);
  const isPrivate =
    body.isPrivate === undefined ? undefined : Boolean(body.isPrivate);

  const addPeople = Array.isArray(body.addPeople)
    ? body.addPeople
    : typeof body.guestNames === "string"
      ? parseGuestNames(body.guestNames)
      : [];
  const addGroupings = Array.isArray(body.addGroupings)
    ? body.addGroupings.map(String)
    : typeof body.groupingsText === "string"
      ? parseCommaList(body.groupingsText)
      : [];

  const hasPeople = addPeople.length > 0;
  const hasGroupings = addGroupings.length > 0;
  const hasEvent = eventId != null && Number.isFinite(eventId) && eventId > 0;
  const hasPrivate = isPrivate !== undefined;
  const hasAlbum = Boolean(albumProvided);

  if (!hasPeople && !hasGroupings && !hasEvent && !hasPrivate && !hasAlbum) {
    return NextResponse.json(
      { error: "Choose at least one change to apply." },
      { status: 400 },
    );
  }

  const result = await bulkUpdateGalleryPhotos({
    photoIds,
    eventId: hasEvent ? eventId : undefined,
    albumId: hasAlbum ? (albumId ?? null) : undefined,
    albumName:
      typeof body.albumName === "string" ? body.albumName.trim() : undefined,
    addPreviousAlbumAsTag: Boolean(body.addPreviousAlbumAsTag),
    isPrivate,
    addPeople: hasPeople ? addPeople : undefined,
    addGroupings: hasGroupings ? addGroupings : undefined,
  });

  const photos = await listGalleryPhotos({ includePrivate: true });
  const updatedPhotos = photos.filter((photo) => photoIds.includes(photo.id));

  revalidatePath("/gallery");
  return NextResponse.json({
    ...result,
    photos: updatedPhotos,
  });
}
