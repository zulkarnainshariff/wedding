import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

export const GALLERY_UPLOAD_ROOT = path.join(
  process.cwd(),
  "data",
  "uploads",
  "gallery",
);

export const MAX_GALLERY_IMAGE_BYTES = 20 * 1024 * 1024;
export const MAX_GALLERY_ZIP_BYTES = 120 * 1024 * 1024;

const IMAGE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".heic",
  ".heif",
]);

const IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
]);

export function sanitizeGalleryFileName(fileName: string): string {
  const base = path.basename(fileName).replace(/[^\w.\-()+\s]/g, "_");
  return base.slice(0, 180) || "photo";
}

export function extensionOf(fileName: string): string {
  return path.extname(fileName).toLowerCase();
}

export function isGalleryImageFileName(fileName: string): boolean {
  return IMAGE_EXTENSIONS.has(extensionOf(fileName));
}

export function isGalleryImageMime(mimeType: string | null | undefined): boolean {
  if (!mimeType) return false;
  return IMAGE_MIME_TYPES.has(mimeType.toLowerCase()) || mimeType.startsWith("image/");
}

export function resolveGalleryMimeType(
  fileName: string,
  mimeType: string | null | undefined,
): string {
  if (mimeType && IMAGE_MIME_TYPES.has(mimeType.toLowerCase())) {
    return mimeType.toLowerCase();
  }
  switch (extensionOf(fileName)) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    case ".heic":
      return "image/heic";
    case ".heif":
      return "image/heif";
    default:
      return mimeType?.trim() || "application/octet-stream";
  }
}

export async function ensureGalleryUploadDir(): Promise<void> {
  await mkdir(GALLERY_UPLOAD_ROOT, { recursive: true });
}

export function buildGalleryStorageKey(fileName: string): string {
  const safe = sanitizeGalleryFileName(fileName);
  return `${randomUUID()}-${safe}`;
}

export function galleryFilePath(storageKey: string): string {
  return path.join(GALLERY_UPLOAD_ROOT, path.basename(storageKey));
}

export async function writeGalleryFile(
  storageKey: string,
  data: Buffer,
): Promise<void> {
  await ensureGalleryUploadDir();
  await writeFile(galleryFilePath(storageKey), data);
}

export async function readGalleryFile(storageKey: string): Promise<Buffer> {
  return readFile(galleryFilePath(storageKey));
}

export async function deleteGalleryFile(
  storageKey: string | null | undefined,
): Promise<void> {
  if (!storageKey) return;
  try {
    await unlink(galleryFilePath(storageKey));
  } catch {
    /* missing file is fine */
  }
}

export function galleryMediaUrl(photoId: number): string {
  return `/api/gallery/media/${photoId}`;
}

export function parseTagList(input: string): string[] {
  return [
    ...new Set(
      input
        .split(/[,\n]/)
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  ];
}
