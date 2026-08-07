import { unzipSync } from "fflate";

/** Keep each request under common reverse-proxy defaults (often 10MB). */
export const GALLERY_UPLOAD_BATCH_MAX_BYTES = 8 * 1024 * 1024;
export const GALLERY_UPLOAD_BATCH_MAX_FILES = 8;

const IMAGE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".heic",
  ".heif",
]);

function extensionOf(fileName: string): string {
  const idx = fileName.lastIndexOf(".");
  return idx >= 0 ? fileName.slice(idx).toLowerCase() : "";
}

function isZipFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return (
    name.endsWith(".zip") ||
    file.type === "application/zip" ||
    file.type === "application/x-zip-compressed"
  );
}

function isImageFile(file: File): boolean {
  if (file.type.startsWith("image/")) return true;
  return IMAGE_EXTENSIONS.has(extensionOf(file.name));
}

function mimeForFileName(fileName: string): string {
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
      return "application/octet-stream";
  }
}

function basename(path: string): string {
  const parts = path.replace(/\\/g, "/").split("/");
  return parts[parts.length - 1] || path;
}

async function expandZipToImages(file: File): Promise<File[]> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes);
  } catch {
    throw new Error(`Could not read zip archive “${file.name}".`);
  }

  const images: File[] = [];
  for (const [entryPath, data] of Object.entries(entries)) {
    const name = basename(entryPath);
    if (!name || name.startsWith(".") || entryPath.includes("__MACOSX/")) {
      continue;
    }
    if (!IMAGE_EXTENSIONS.has(extensionOf(name))) continue;
    if (!data.length) continue;

    images.push(
      new File([data.slice()], name, {
        type: mimeForFileName(name),
        lastModified: Date.now(),
      }),
    );
  }

  return images;
}

/** Expand selected files (including zips) into individual image Files. */
export async function expandGalleryUploadFiles(files: File[]): Promise<File[]> {
  const images: File[] = [];

  for (const file of files) {
    if (isZipFile(file)) {
      images.push(...(await expandZipToImages(file)));
      continue;
    }
    if (isImageFile(file)) {
      images.push(file);
    }
  }

  return images;
}

/** Pack images into batches that stay under proxy-friendly size limits. */
export function batchGalleryUploadFiles(files: File[]): File[][] {
  const batches: File[][] = [];
  let current: File[] = [];
  let currentBytes = 0;

  for (const file of files) {
    const nextBytes = currentBytes + file.size;
    const wouldExceed =
      current.length > 0 &&
      (current.length >= GALLERY_UPLOAD_BATCH_MAX_FILES ||
        nextBytes > GALLERY_UPLOAD_BATCH_MAX_BYTES);

    if (wouldExceed) {
      batches.push(current);
      current = [];
      currentBytes = 0;
    }

    // Oversized single files still get their own request (server validates).
    current.push(file);
    currentBytes += file.size;

    if (
      current.length >= GALLERY_UPLOAD_BATCH_MAX_FILES ||
      currentBytes >= GALLERY_UPLOAD_BATCH_MAX_BYTES
    ) {
      batches.push(current);
      current = [];
      currentBytes = 0;
    }
  }

  if (current.length > 0) batches.push(current);
  return batches;
}

export function describeGalleryUploadHttpError(
  status: number,
  serverError?: string,
): string {
  if (serverError?.trim()) return serverError.trim();
  if (status === 413) {
    return (
      "Upload rejected by the reverse proxy (HTTP 413). " +
      "OpenResty/nginx needs client_max_body_size raised (see README), " +
      "then retry — large zips are now split into smaller image batches automatically."
    );
  }
  if (status === 502 || status === 504) {
    return `Upload timed out or the proxy dropped the connection (${status}). Try a smaller batch.`;
  }
  return `Upload failed (${status}).`;
}
