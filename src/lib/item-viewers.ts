import type { ItineraryItem } from "@/lib/schema";
import { extractItemTravellers, travellerMatchesUsername } from "@/lib/item-travellers";
import {
  extractSubItemParticipants,
  extractSubItemViewers,
  isSubItem,
  subItemPeopleForPermission,
} from "@/lib/item-subitems";
import { normalizeTravellerName, TRAVELLER_NAMES } from "@/lib/travellers";
import type { Category } from "@/lib/types";

/** Traveller names eligible as additional viewers (excludes "Everyone"). */
export const ADDITIONAL_VIEWER_NAMES: string[] = TRAVELLER_NAMES.filter(
  (name) => name !== "Everyone",
);

export function extractItemAdditionalViewers(details: unknown): string[] {
  if (!details || typeof details !== "object") return [];
  const viewers = (details as Record<string, unknown>).viewers;
  if (!Array.isArray(viewers)) return [];
  return viewers
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => normalizeTravellerName(entry))
    .filter(Boolean);
}

export function additionalViewerOptions(
  participants: string[],
  selected: string[] = [],
): string[] {
  const participantKeys = new Set(
    participants.map((name) => normalizeTravellerName(name).toLowerCase()),
  );

  const options = ADDITIONAL_VIEWER_NAMES.filter(
    (name) => !participantKeys.has(normalizeTravellerName(name).toLowerCase()),
  );

  for (const name of selected) {
    const normalized = normalizeTravellerName(name);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (!participantKeys.has(key) && !options.includes(normalized)) {
      options.push(normalized);
    }
  }

  return options.sort((a, b) => a.localeCompare(b));
}

export function itemPeopleForPermission(item: ItineraryItem): string[] {
  if (isSubItem(item)) {
    return subItemPeopleForPermission(item.details);
  }

  return [
    ...new Set([
      ...extractItemTravellers(item.details, item.category),
      ...extractItemAdditionalViewers(item.details),
    ]),
  ];
}

export function participantNamesForItemCategory(
  structured: {
    participants: string[];
    travellers: string[];
  },
  category: Category,
): string[] {
  if (category === "flight" || category === "travel_insurance") {
    return structured.travellers;
  }
  return structured.participants;
}

export {
  extractSubItemParticipants,
  extractSubItemViewers,
} from "@/lib/item-subitems";
