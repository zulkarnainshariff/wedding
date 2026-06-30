import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { isAuthError, requireAuth } from "@/lib/api-auth";
import { listGalleryPhotos } from "@/lib/gallery-queries";
import { db } from "@/lib/db";
import { galleryPhotos, galleryPhotoTags } from "@/lib/schema";

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

  const [updated] = await db
    .update(galleryPhotos)
    .set({ eventId, url, caption })
    .where(eq(galleryPhotos.id, photoId))
    .returning({ id: galleryPhotos.id });

  if (!updated) {
    return NextResponse.json({ error: "Photo not found." }, { status: 404 });
  }

  await db.delete(galleryPhotoTags).where(eq(galleryPhotoTags.photoId, photoId));

  if (tags.length > 0) {
    await db.insert(galleryPhotoTags).values(
      tags
        .filter((tag) => tag.guestName?.trim())
        .map((tag) => ({
          photoId,
          guestName: tag.guestName.trim(),
          email: tag.email?.trim() || null,
        })),
    );
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

  const [deleted] = await db
    .delete(galleryPhotos)
    .where(eq(galleryPhotos.id, photoId))
    .returning({ id: galleryPhotos.id });

  if (!deleted) {
    return NextResponse.json({ error: "Photo not found." }, { status: 404 });
  }

  revalidatePath("/gallery");
  return NextResponse.json({ ok: true });
}
