import type { StructuredItemDetails } from "@/lib/admin-item-details";

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

  const next: Record<string, unknown> = {
    ...payload,
    isPrivate: structured.isPrivate,
    privateViewers,
    viewers,
  };

  delete next.extraViewers;
  return next;
}
