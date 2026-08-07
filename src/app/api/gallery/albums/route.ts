import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { isAuthError, requireAuth } from "@/lib/api-auth";
import {
  findOrCreateAlbumByName,
  listGalleryAlbums,
} from "@/lib/gallery-queries";

async function requireGalleryAdmin() {
  const user = await requireAuth();
  if (isAuthError(user)) return user;
  if (!user.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return user;
}

export async function GET() {
  const albums = await listGalleryAlbums();
  return NextResponse.json({ albums });
}

export async function POST(request: Request) {
  const user = await requireGalleryAdmin();
  if (user instanceof NextResponse) return user;

  const body = await request.json();
  const name = String(body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "Album name is required." }, { status: 400 });
  }

  const album = await findOrCreateAlbumByName(name);
  if (!album) {
    return NextResponse.json({ error: "Could not create album." }, { status: 400 });
  }

  revalidatePath("/gallery");
  const albums = await listGalleryAlbums();
  return NextResponse.json(
    { album: albums.find((entry) => entry.id === album.id) ?? album, albums },
    { status: 201 },
  );
}
