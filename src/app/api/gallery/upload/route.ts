import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import AdmZip from "adm-zip";
import { isAuthError, requireAuth } from "@/lib/api-auth";
import {
  findOrCreateAlbumByName,
  listGalleryPhotos,
  replacePhotoGroupings,
  replacePhotoPeopleTags,
} from "@/lib/gallery-queries";
import { parseCommaList, parseGuestNames } from "@/lib/gallery-photo-utils";
import {
  buildGalleryStorageKey,
  galleryMediaUrl,
  isGalleryImageFileName,
  isGalleryImageMime,
  MAX_GALLERY_IMAGE_BYTES,
  MAX_GALLERY_ZIP_BYTES,
  resolveGalleryMimeType,
  sanitizeGalleryFileName,
  writeGalleryFile,
} from "@/lib/gallery-storage";
import { db } from "@/lib/db";
import { galleryPhotos } from "@/lib/schema";

type UploadedImage = {
  fileName: string;
  mimeType: string;
  buffer: Buffer;
};

function isZipFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return (
    name.endsWith(".zip") ||
    file.type === "application/zip" ||
    file.type === "application/x-zip-compressed"
  );
}

async function collectImagesFromZip(file: File): Promise<UploadedImage[]> {
  if (file.size > MAX_GALLERY_ZIP_BYTES) {
    throw new Error(
      `Zip file is too large (max ${Math.round(MAX_GALLERY_ZIP_BYTES / (1024 * 1024))}MB).`,
    );
  }

  const zip = new AdmZip(Buffer.from(await file.arrayBuffer()));
  const images: UploadedImage[] = [];

  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue;
    const fileName = entry.entryName.split("/").pop() ?? entry.entryName;
    if (fileName.startsWith(".")) continue;
    if (!isGalleryImageFileName(fileName)) continue;

    const buffer = entry.getData();
    if (!buffer.length || buffer.length > MAX_GALLERY_IMAGE_BYTES) continue;

    images.push({
      fileName: sanitizeGalleryFileName(fileName),
      mimeType: resolveGalleryMimeType(fileName, null),
      buffer,
    });
  }

  return images;
}

async function collectImagesFromFiles(files: File[]): Promise<UploadedImage[]> {
  const images: UploadedImage[] = [];

  for (const file of files) {
    if (isZipFile(file)) {
      images.push(...(await collectImagesFromZip(file)));
      continue;
    }

    if (!isGalleryImageFileName(file.name) && !isGalleryImageMime(file.type)) {
      continue;
    }
    if (file.size > MAX_GALLERY_IMAGE_BYTES) {
      throw new Error(
        `"${file.name}" is too large (max ${Math.round(MAX_GALLERY_IMAGE_BYTES / (1024 * 1024))}MB per image).`,
      );
    }

    images.push({
      fileName: sanitizeGalleryFileName(file.name),
      mimeType: resolveGalleryMimeType(file.name, file.type),
      buffer: Buffer.from(await file.arrayBuffer()),
    });
  }

  return images;
}

export async function POST(request: Request) {
  const user = await requireAuth();
  if (isAuthError(user)) return user;
  if (!user.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const eventId = Number(formData.get("eventId"));
  const albumName = String(formData.get("albumName") ?? "").trim();
  const albumIdRaw = formData.get("albumId");
  const albumIdInput =
    albumIdRaw != null && String(albumIdRaw).trim()
      ? Number(albumIdRaw)
      : null;
  const caption = String(formData.get("caption") ?? "").trim() || null;
  const guestNames = String(formData.get("guestNames") ?? "");
  const groupingsText = String(formData.get("groupings") ?? "");

  if (!eventId) {
    return NextResponse.json({ error: "Event is required." }, { status: 400 });
  }
  if (!albumName && !(albumIdInput && albumIdInput > 0)) {
    return NextResponse.json(
      { error: "Album name is required for bulk uploads." },
      { status: 400 },
    );
  }

  let albumId = albumIdInput && albumIdInput > 0 ? albumIdInput : null;
  if (albumName) {
    const album = await findOrCreateAlbumByName(albumName);
    albumId = album?.id ?? albumId;
  }
  if (!albumId) {
    return NextResponse.json(
      { error: "Could not resolve album for upload." },
      { status: 400 },
    );
  }

  const files = formData
    .getAll("files")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  if (files.length === 0) {
    const single = formData.get("file");
    if (single instanceof File && single.size > 0) files.push(single);
  }

  if (files.length === 0) {
    return NextResponse.json(
      { error: "Choose image files or a zip archive to upload." },
      { status: 400 },
    );
  }

  let images: UploadedImage[];
  try {
    images = await collectImagesFromFiles(files);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not read upload files.",
      },
      { status: 400 },
    );
  }

  if (images.length === 0) {
    return NextResponse.json(
      { error: "No supported images found in the upload." },
      { status: 400 },
    );
  }

  const tags = parseGuestNames(guestNames);
  const groupings = parseCommaList(groupingsText);
  const createdIds: number[] = [];

  for (const image of images) {
    const storageKey = buildGalleryStorageKey(image.fileName);
    await writeGalleryFile(storageKey, image.buffer);

    const [photo] = await db
      .insert(galleryPhotos)
      .values({
        eventId,
        albumId,
        url: "/api/gallery/media/0",
        storageKey,
        originalFilename: image.fileName,
        mimeType: image.mimeType,
        caption,
      })
      .returning();

    await db
      .update(galleryPhotos)
      .set({ url: galleryMediaUrl(photo.id) })
      .where(eq(galleryPhotos.id, photo.id));

    await replacePhotoPeopleTags(photo.id, tags);
    await replacePhotoGroupings(photo.id, groupings);
    createdIds.push(photo.id);
  }

  const photos = await listGalleryPhotos({ eventId, albumId });
  const created = photos.filter((photo) => createdIds.includes(photo.id));

  revalidatePath("/gallery");
  return NextResponse.json(
    {
      count: created.length,
      photos: created,
      albumId,
    },
    { status: 201 },
  );
}
