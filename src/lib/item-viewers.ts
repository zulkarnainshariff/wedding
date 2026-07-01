import type { ItineraryItem } from "@/lib/schema";
import {
  extractItemTravellers,
  SYSTEM_ACCOUNT_USERNAMES,
  travellerMatchesUsername,
  usernameToTravellerName,
} from "@/lib/item-travellers";
import {
  extractSubItemParticipants,
  extractSubItemViewers,
  isSubItem,
  subItemPeopleForPermission,
} from "@/lib/item-subitems";
import { normalizeTravellerName } from "@/lib/travellers";
import type { Category } from "@/lib/types";

export function isParticipantPerson(
  person: string,
  participants: string[],
): boolean {
  const personKey = normalizeTravellerName(person).toLowerCase();
  return participants.some((participant) => {
    const participantKey = normalizeTravellerName(participant).toLowerCase();
    if (participantKey === personKey) return true;
    return travellerMatchesUsername(participant, person.toLowerCase());
  });
}

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
  accountUsernames: string[] = [],
): string[] {
  const eligibleAccounts = accountUsernames
    .map((username) => username.trim().toLowerCase())
    .filter(Boolean)
    .filter((username) => !SYSTEM_ACCOUNT_USERNAMES.has(username))
    .filter((username) => !isParticipantPerson(username, participants));

  const options = [
    ...new Set(eligibleAccounts.map((username) => usernameToTravellerName(username))),
  ];

  for (const name of selected) {
    const normalized = normalizeTravellerName(name);
    if (!normalized) continue;
    if (isParticipantPerson(normalized, participants)) continue;
    if (!options.includes(normalized)) {
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
