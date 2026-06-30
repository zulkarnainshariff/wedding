import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import {
  extractItemTravellers,
  travellerMatchesUsername,
} from "@/lib/item-travellers";
import {
  parseCoveredTravellers,
  parseExtraViewers,
} from "@/lib/item-document-utils";
import type { ItemDocument, ItineraryItem } from "@/lib/schema";
import type { SessionUser } from "@/lib/permissions";
import { normalizeTravellerName } from "@/lib/travellers";

export { parseExtraViewers, parseCoveredTravellers } from "@/lib/item-document-utils";

export const UPLOAD_ROOT = path.join(process.cwd(), "data", "uploads");
export const MAX_DOCUMENT_BYTES = 12 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/x-pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const ALLOWED_EXTENSIONS = new Set([
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
]);

export function travellerInParty(
  travellerName: string,
  party: string[],
): boolean {
  const normalized = normalizeTravellerName(travellerName).toLowerCase();
  return party.some(
    (member) => normalizeTravellerName(member).toLowerCase() === normalized,
  );
}

export function userInTravellingParty(
  item: ItineraryItem,
  user: SessionUser,
): boolean {
  const party = extractItemTravellers(item.details, item.category);
  return party.some((member) => travellerMatchesUsername(member, user.username));
}

export function canViewDocument(
  doc: ItemDocument,
  item: ItineraryItem,
  user: SessionUser,
): boolean {
  if (user.isAdmin) return true;
  if (doc.uploadedByUserId === user.id) return true;

  const party = extractItemTravellers(item.details, item.category);
  const coveredTravellers = parseCoveredTravellers(doc);
  const docOwnerInParty = coveredTravellers.some((name) =>
    travellerInParty(name, party),
  );
  const userInParty = party.some((member) =>
    travellerMatchesUsername(member, user.username),
  );

  if (
    coveredTravellers.some((name) =>
      travellerMatchesUsername(name, user.username),
    )
  ) {
    return true;
  }

  if (userInParty && docOwnerInParty) {
    return true;
  }

  const extraViewers = parseExtraViewers(doc.extraViewers);
  return extraViewers.includes(user.username.toLowerCase());
}

export function filterVisibleDocuments(
  docs: ItemDocument[],
  item: ItineraryItem,
  user: SessionUser,
): ItemDocument[] {
  return docs.filter((doc) => canViewDocument(doc, item, user));
}

export function sanitizeFileName(fileName: string): string {
  const base = path.basename(fileName).replace(/[^\w.\-()+\s]/g, "_");
  return base.slice(0, 180) || "document";
}

export function isAllowedDocumentMime(mimeType: string | null): boolean {
  if (!mimeType) return false;
  return ALLOWED_MIME_TYPES.has(mimeType);
}

function extensionOf(fileName: string): string {
  return path.extname(fileName).toLowerCase();
}

export function isAllowedDocumentUpload(
  fileName: string,
  mimeType: string | null,
): boolean {
  if (mimeType && ALLOWED_MIME_TYPES.has(mimeType)) return true;
  return ALLOWED_EXTENSIONS.has(extensionOf(fileName));
}

export function resolveDocumentMimeType(
  fileName: string,
  mimeType: string | null,
): string {
  if (mimeType && ALLOWED_MIME_TYPES.has(mimeType)) return mimeType;

  switch (extensionOf(fileName)) {
    case ".pdf":
      return "application/pdf";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    default:
      return mimeType?.trim() || "application/octet-stream";
  }
}

export async function ensureUploadDir(): Promise<void> {
  await mkdir(UPLOAD_ROOT, { recursive: true });
}

export function buildStorageKey(itemId: number, fileName: string): string {
  return `${itemId}/${randomUUID()}-${sanitizeFileName(fileName)}`;
}

export function resolveStoragePath(storageKey: string): string {
  const resolved = path.resolve(UPLOAD_ROOT, storageKey);
  if (!resolved.startsWith(path.resolve(UPLOAD_ROOT))) {
    throw new Error("Invalid storage path");
  }
  return resolved;
}

export async function writeDocumentFile(
  storageKey: string,
  bytes: Uint8Array,
): Promise<void> {
  const filePath = resolveStoragePath(storageKey);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, bytes);
}

export async function readDocumentFile(storageKey: string): Promise<Buffer> {
  return readFile(resolveStoragePath(storageKey));
}

export async function deleteDocumentFile(storageKey: string): Promise<void> {
  try {
    await unlink(resolveStoragePath(storageKey));
  } catch {
    // File may already be gone.
  }
}
