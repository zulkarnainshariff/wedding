import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { isAuthError, requireAuth } from "@/lib/api-auth";
import {
  findOrCreateAlbumByName,
  getGalleryPhotoById,
  listGalleryPhotos,
  replacePhotoGroupings,
  replacePhotoPeopleTags,
} from "@/lib/gallery-queries";
import { parseGuestNames, parseCommaList } from "@/lib/gallery-photo-utils";
import { deleteGalleryFile, galleryMediaUrl } from "@/lib/gallery-storage";
import { db } from "@/lib/db";
import { galleryPhotos } from "@/lib/schema";

type Params = { params: Promise<{ id: string }> };

async function requireGalleryAdmin() {
  const user = await requireAuth();
  if (isAuthError(user)) return user;
  if (!user.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return user;
}

export async function PUT(request: Request, { params }: Params) {
  const user = await requireGalleryAdmin();
  if (user instanceof NextResponse) return user;

  const photoId = Number((await params).id);
  if (!photoId) {
    return NextResponse.json({ error: "Invalid photo id." }, { status: 400 });
  }

  const existing = await getGalleryPhotoById(photoId);
  if (!existing) {
    return NextResponse.json({ error: "Photo not found." }, { status: 404 });
  }

  const body = await request.json();
  const eventId = Number(body.eventId);
  const caption =
    body.caption !== undefined
      ? body.caption
        ? String(body.caption).trim()
        : null
      : existing.caption;
  const urlInput =
    body.url !== undefined ? String(body.url ?? "").trim() : existing.url;

  if (!eventId) {
    return NextResponse.json({ error: "Event is required." }, { status: 400 });
  }

  let albumId: number | null =
    body.albumId === null
      ? null
      : body.albumId !== undefined
        ? Number(body.albumId) || null
        : existing.albumId;

  if (typeof body.albumName === "string" && body.albumName.trim()) {
    const album = await findOrCreateAlbumByName(body.albumName.trim());
    albumId = album?.id ?? albumId;
  }

  const nextUrl = existing.storageKey
    ? galleryMediaUrl(photoId)
    : urlInput || existing.url;

  if (!existing.storageKey && !nextUrl) {
    return NextResponse.json(
      { error: "Photo URL is required for linked photos." },
      { status: 400 },
    );
  }

  const [updated] = await db
    .update(galleryPhotos)
    .set({
      eventId,
      albumId,
      url: nextUrl,
      caption,
    })
    .where(eq(galleryPhotos.id, photoId))
    .returning({ id: galleryPhotos.id });

  if (!updated) {
    return NextResponse.json({ error: "Photo not found." }, { status: 404 });
  }

  if (body.tags !== undefined || body.guestNames !== undefined) {
    const tags: { guestName: string; email?: string }[] = Array.isArray(body.tags)
      ? body.tags
      : parseGuestNames(String(body.guestNames ?? ""));
    await replacePhotoPeopleTags(photoId, tags);
  }

  if (body.groupings !== undefined || body.groupingsText !== undefined) {
    const groupings: string[] = Array.isArray(body.groupings)
      ? body.groupings.map(String)
      : parseCommaList(String(body.groupingsText ?? ""));
    await replacePhotoGroupings(photoId, groupings);
  }

  const photos = await listGalleryPhotos();
  const photo = photos.find((entry) => entry.id === photoId);

  revalidatePath("/gallery");
  return NextResponse.json(photo ?? updated);
}

export async function DELETE(_request: Request, { params }: Params) {
  const user = await requireGalleryAdmin();
  if (user instanceof NextResponse) return user;

  const photoId = Number((await params).id);
  if (!photoId) {
    return NextResponse.json({ error: "Invalid photo id." }, { status: 400 });
  }

  const existing = await getGalleryPhotoById(photoId);
  if (!existing) {
    return NextResponse.json({ error: "Photo not found." }, { status: 404 });
  }

  await db.delete(galleryPhotos).where(eq(galleryPhotos.id, photoId));
  await deleteGalleryFile(existing.storageKey);

  revalidatePath("/gallery");
  return NextResponse.json({ ok: true });
}
