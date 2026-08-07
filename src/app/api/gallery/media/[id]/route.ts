import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getAppSettings, isPhotoGalleryEnabled } from "@/lib/app-settings";
import { getGalleryPhotoById } from "@/lib/gallery-queries";
import { readGalleryFile } from "@/lib/gallery-storage";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const settings = await getAppSettings();
  const sessionUser = await getSessionUser();
  const galleryEnabled = isPhotoGalleryEnabled(settings);
  const isAdmin = Boolean(sessionUser?.isAdmin);

  if (!galleryEnabled && !isAdmin) {
    return NextResponse.json({ error: "Photo gallery is not enabled." }, { status: 403 });
  }

  const photoId = Number((await params).id);
  if (!photoId) {
    return NextResponse.json({ error: "Invalid photo id." }, { status: 400 });
  }

  const photo = await getGalleryPhotoById(photoId);
  if (!photo?.storageKey) {
    return NextResponse.json({ error: "Photo not found." }, { status: 404 });
  }

  if (photo.isPrivate && !isAdmin) {
    return NextResponse.json({ error: "Photo not found." }, { status: 404 });
  }

  try {
    const data = await readGalleryFile(photo.storageKey);
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": photo.mimeType || "application/octet-stream",
        "Cache-Control": isAdmin
          ? "private, max-age=60"
          : "public, max-age=31536000, immutable",
        ...(photo.originalFilename
          ? {
              "Content-Disposition": `inline; filename="${photo.originalFilename.replace(/"/g, "")}"`,
            }
          : {}),
      },
    });
  } catch {
    return NextResponse.json({ error: "Photo file missing." }, { status: 404 });
  }
}
