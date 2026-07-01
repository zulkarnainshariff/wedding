import type { StructuredItemDetails } from "@/lib/admin-item-details";
import { normalizeViewerLinksPayload } from "@/lib/item-viewer-links";

export function mergeItemPrivacyFields(
  payload: Record<string, unknown>,
  structured: StructuredItemDetails,
): Record<string, unknown> {
  const privateViewers = structured.privateViewers
    .map((username) => username.trim().toLowerCase())
    .filter(Boolean);
  const viewers = structured.viewers
    .map((name) => name.trim())
    .filter(Boolean);
  const viewerLinks = normalizeViewerLinksPayload(structured.viewerLinks);

  const next: Record<string, unknown> = {
    ...payload,
    isPrivate: structured.isPrivate,
    privateViewers,
    viewers,
    viewerLinks,
  };

  delete next.extraViewers;
  return next;
}
