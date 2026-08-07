import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { isAuthError, requireAuth } from "@/lib/api-auth";
import {
  findOrCreateAlbumByName,
  listGalleryPhotos,
  movePhotosToAlbum,
} from "@/lib/gallery-queries";

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
  const albumName =
    typeof body.albumName === "string" ? body.albumName.trim() : "";
  const albumIdRaw =
    body.albumId === null || body.albumId === ""
      ? null
      : Number(body.albumId);
  const addPreviousAlbumAsTag = Boolean(body.addPreviousAlbumAsTag);

  if (photoIds.length === 0) {
    return NextResponse.json(
      { error: "Select at least one photo to move." },
      { status: 400 },
    );
  }

  let albumId: number | null =
    albumIdRaw != null && Number.isFinite(albumIdRaw) && albumIdRaw > 0
      ? albumIdRaw
      : null;

  if (albumName) {
    const album = await findOrCreateAlbumByName(albumName);
    albumId = album?.id ?? albumId;
  }

  const result = await movePhotosToAlbum({
    photoIds,
    albumId,
    addPreviousAlbumAsTag,
  });

  const photos = await listGalleryPhotos({ includePrivate: true });
  const movedPhotos = photos.filter((photo) => photoIds.includes(photo.id));

  revalidatePath("/gallery");
  return NextResponse.json({
    ...result,
    albumId,
    photos: movedPhotos,
  });
}
