import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { isAuthError, requireAuth } from "@/lib/api-auth";
import { listGalleryAlbums } from "@/lib/gallery-queries";
import { db } from "@/lib/db";
import { galleryAlbums } from "@/lib/schema";

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

  const albumId = Number((await params).id);
  if (!albumId) {
    return NextResponse.json({ error: "Invalid album id." }, { status: 400 });
  }

  const body = await request.json();
  const name = String(body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "Album name is required." }, { status: 400 });
  }

  const [updated] = await db
    .update(galleryAlbums)
    .set({ name })
    .where(eq(galleryAlbums.id, albumId))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Album not found." }, { status: 404 });
  }

  revalidatePath("/gallery");
  return NextResponse.json({
    album: updated,
    albums: await listGalleryAlbums(),
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  const user = await requireGalleryAdmin();
  if (user instanceof NextResponse) return user;

  const albumId = Number((await params).id);
  if (!albumId) {
    return NextResponse.json({ error: "Invalid album id." }, { status: 400 });
  }

  const [deleted] = await db
    .delete(galleryAlbums)
    .where(eq(galleryAlbums.id, albumId))
    .returning({ id: galleryAlbums.id });

  if (!deleted) {
    return NextResponse.json({ error: "Album not found." }, { status: 404 });
  }

  revalidatePath("/gallery");
  return NextResponse.json({
    ok: true,
    albums: await listGalleryAlbums(),
  });
}
