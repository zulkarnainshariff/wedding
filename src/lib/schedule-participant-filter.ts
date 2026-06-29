import type { ItineraryItem } from "@/lib/schema";
import {
  extractItemTravellers,
  itemIncludesEveryone,
  travellerMatchesUsername,
} from "@/lib/item-travellers";
import { normalizeTravellerName } from "@/lib/travellers";
import type { SessionUser } from "@/lib/permissions";

function participantNamesMatch(a: string, b: string): boolean {
  return (
    normalizeTravellerName(a).toLowerCase() ===
      normalizeTravellerName(b).toLowerCase() ||
    travellerMatchesUsername(a, b) ||
    travellerMatchesUsername(b, a)
  );
}

export function itemMatchesParticipantFilter(
  item: ItineraryItem,
  selectedParticipants: string[],
): boolean {
  if (!selectedParticipants.length) return true;

  const travellers = extractItemTravellers(item.details, item.category);
  if (!travellers.length) return true;
  if (itemIncludesEveryone(travellers)) return true;

  return selectedParticipants.some((selected) =>
    travellers.some((traveller) => participantNamesMatch(traveller, selected)),
  );
}

export function collectScheduleParticipantOptions(
  items: ItineraryItem[],
  user: SessionUser | null,
): string[] {
  const names = new Set<string>();

  for (const item of items) {
    for (const traveller of extractItemTravellers(item.details, item.category)) {
      const normalized = traveller.trim();
      if (!normalized) continue;
      if (normalized === "Everyone") continue;
      if (normalized.toLowerCase() === "all") continue;
      names.add(traveller);
    }
  }

  const sorted = [...names].sort((a, b) => a.localeCompare(b));

  if (!user?.isAdmin && user?.permissions.viewTravellers !== "all") {
    const viewable = user?.permissions.viewTravellers ?? [];
    return sorted.filter((name) =>
      viewable.some((username) => travellerMatchesUsername(name, username)),
    );
  }

  return sorted;
}

export function filterScheduleItemsByParticipants(
  items: ItineraryItem[],
  selectedParticipants: string[],
): ItineraryItem[] {
  if (!selectedParticipants.length) return items;
  return items.filter((item) =>
    itemMatchesParticipantFilter(item, selectedParticipants),
  );
}
