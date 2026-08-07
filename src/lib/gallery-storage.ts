import { access, mkdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import sharp from "sharp";

export const GALLERY_UPLOAD_ROOT = path.join(
  process.cwd(),
  "data",
  "uploads",
  "gallery",
);

export const MAX_GALLERY_IMAGE_BYTES = 50 * 1024 * 1024;
export const MAX_GALLERY_ZIP_BYTES = 512 * 1024 * 1024;
export const GALLERY_THUMB_MAX_EDGE = 640;
export const GALLERY_THUMB_WEBP_QUALITY = 72;

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

/** Thumbnail key derived from the original storage key (WebP under thumbs/). */
export function galleryThumbKey(storageKey: string): string {
  const base = path.basename(storageKey);
  return path.posix.join("thumbs", `${base}.webp`);
}

export function galleryFilePath(storageKey: string): string {
  const normalized = storageKey.replace(/\\/g, "/");
  if (!normalized || normalized.includes("..")) {
    throw new Error("Invalid gallery storage key.");
  }
  const parts = normalized.split("/").filter(Boolean);
  return path.join(GALLERY_UPLOAD_ROOT, ...parts);
}

export async function writeGalleryFile(
  storageKey: string,
  data: Buffer,
): Promise<void> {
  const filePath = galleryFilePath(storageKey);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, data);
}

export async function readGalleryFile(storageKey: string): Promise<Buffer> {
  return readFile(galleryFilePath(storageKey));
}

async function fileExists(storageKey: string): Promise<boolean> {
  try {
    await access(galleryFilePath(storageKey));
    return true;
  } catch {
    return false;
  }
}

export async function writeGalleryThumbnail(
  storageKey: string,
  originalData?: Buffer,
): Promise<Buffer> {
  const source = originalData ?? (await readGalleryFile(storageKey));
  const thumb = await sharp(source)
    .rotate()
    .resize({
      width: GALLERY_THUMB_MAX_EDGE,
      height: GALLERY_THUMB_MAX_EDGE,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: GALLERY_THUMB_WEBP_QUALITY })
    .toBuffer();
  await writeGalleryFile(galleryThumbKey(storageKey), thumb);
  return thumb;
}

/** Return cached thumbnail bytes, generating on first request if needed. */
export async function readOrCreateGalleryThumbnail(
  storageKey: string,
): Promise<Buffer> {
  const thumbKey = galleryThumbKey(storageKey);
  if (await fileExists(thumbKey)) {
    return readGalleryFile(thumbKey);
  }
  return writeGalleryThumbnail(storageKey);
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
  try {
    await unlink(galleryFilePath(galleryThumbKey(storageKey)));
  } catch {
    /* missing thumb is fine */
  }
}

export function galleryMediaUrl(photoId: number): string {
  return `/api/gallery/media/${photoId}`;
}

export function galleryThumbUrl(photoId: number): string {
  return `/api/gallery/media/${photoId}?size=thumb`;
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
