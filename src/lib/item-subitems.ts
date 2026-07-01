import { combineActivityDatetime } from "@/lib/activity-utils";
import { buildLocationPayload } from "@/lib/item-location";
import { getItemCompletion, withItemCompletion } from "@/lib/item-completion";
import { extractViewerLinks, normalizeViewerLinksPayload } from "@/lib/item-viewer-links";
import { normalizeTravellerName } from "@/lib/travellers";
import type { ItineraryItem } from "@/lib/schema";

export type SubItemFormState = {
  title: string;
  time: string;
  locationName: string;
  locationMapUrl: string;
  summary: string;
  participants: string[];
  viewers: string[];
  viewerLinks: Record<string, string[]>;
};

export function extractSubItemParticipants(details: unknown): string[] {
  if (!details || typeof details !== "object") return [];
  const participants = (details as Record<string, unknown>).participants;
  if (!Array.isArray(participants)) return [];
  return participants
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => normalizeTravellerName(entry))
    .filter(Boolean);
}

export function extractSubItemViewers(details: unknown): string[] {
  if (!details || typeof details !== "object") return [];
  const viewers = (details as Record<string, unknown>).viewers;
  if (!Array.isArray(viewers)) return [];
  return viewers
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => normalizeTravellerName(entry))
    .filter(Boolean);
}

export function subItemPeopleForPermission(details: unknown): string[] {
  return [
    ...new Set([
      ...extractSubItemParticipants(details),
      ...extractSubItemViewers(details),
    ]),
  ];
}

export function isSubItem(item: Pick<ItineraryItem, "parentItemId" | "details">): boolean {
  if (item.parentItemId == null) return false;
  const details =
    item.details && typeof item.details === "object"
      ? (item.details as Record<string, unknown>)
      : {};
  return details.activityType === "sub_item";
}

export function subItemToFormState(item: ItineraryItem): SubItemFormState {
  const details =
    item.details && typeof item.details === "object"
      ? (item.details as Record<string, unknown>)
      : {};
  const location =
    details.location && typeof details.location === "object"
      ? (details.location as { name?: string; mapLink?: string })
      : null;

  let time = "";
  if (typeof details.time === "string" && /^\d{2}:\d{2}$/.test(details.time)) {
    time = details.time;
  } else if (item.startDatetime) {
    const date = new Date(item.startDatetime);
    time = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  }

  const description =
    item.summary ||
    (typeof details.description === "string" ? details.description : "");

  const participants = extractSubItemParticipants(details);
  const viewers = extractSubItemViewers(details);
  const viewerLinks = extractViewerLinks(details);

  return {
    title: item.title,
    time,
    locationName: location?.name ?? "",
    locationMapUrl: location?.mapLink ?? "",
    summary: description,
    participants,
    viewers,
    viewerLinks,
  };
}

export function buildSubItemDetails(
  form: SubItemFormState,
  existingDetails?: Record<string, unknown> | null,
): Record<string, unknown> {
  const existing =
    existingDetails && typeof existingDetails === "object" ? existingDetails : {};
  const location = buildLocationPayload(
    form.locationName.trim() || undefined,
    form.locationMapUrl.trim() || undefined,
  );
  const clockTime = /^\d{2}:\d{2}$/.test(form.time.trim())
    ? form.time.trim()
    : null;

  const base: Record<string, unknown> = {
    activityType: "sub_item",
    slug:
      typeof existing.slug === "string" && existing.slug.trim()
        ? existing.slug
        : `sub-${Date.now()}`,
    time: clockTime,
    description: form.summary.trim() || undefined,
    participants: form.participants,
    viewers: form.viewers,
    viewerLinks: normalizeViewerLinksPayload(form.viewerLinks),
    ...(location ? { location } : {}),
  };

  return withItemCompletion(base, getItemCompletion(existing));
}

export function resolveSubItemStartDatetime(
  parent: Pick<ItineraryItem, "eventDate">,
  time: string,
): Date | null {
  const clockTime = time.trim();
  if (!/^\d{2}:\d{2}$/.test(clockTime)) return null;
  if (!parent.eventDate) return null;
  return combineActivityDatetime(parent.eventDate, clockTime);
}
