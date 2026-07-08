import {
  extractItemTravellers,
  itemIncludesBroadGuestList,
  travellerMatchesUsername,
} from "@/lib/item-travellers";
import { extractItemAdditionalViewers } from "@/lib/item-viewers";
import {
  extractSubItemParticipants,
  isSubItem,
} from "@/lib/item-subitems";
import type { SessionUser } from "@/lib/permissions";
import type { ItineraryItem } from "@/lib/schema";
import { isAdminSession } from "@/lib/role-levels";

export function parsePrivateViewers(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return [
    ...new Set(
      raw
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
}

export function isItemPrivate(details: unknown): boolean {
  if (!details || typeof details !== "object") return false;
  return Boolean((details as Record<string, unknown>).isPrivate);
}

export function getItemPrivateViewers(details: unknown): string[] {
  if (!details || typeof details !== "object") return [];
  const record = details as Record<string, unknown>;
  return parsePrivateViewers(record.privateViewers ?? record.extraViewers);
}

export function userIsItemParticipant(
  item: ItineraryItem,
  user: SessionUser,
): boolean {
  const travellers = isSubItem(item)
    ? extractSubItemParticipants(item.details)
    : extractItemTravellers(item.details, item.category);
  return travellers.some((traveller) =>
    travellerMatchesUsername(traveller, user.username),
  );
}

export function userIsPrivateViewer(
  item: ItineraryItem,
  user: SessionUser,
): boolean {
  const privateViewers = getItemPrivateViewers(item.details);
  return privateViewers.includes(user.username.toLowerCase());
}

export function userIsAdditionalViewer(
  item: ItineraryItem,
  user: SessionUser,
): boolean {
  const viewers = extractItemAdditionalViewers(item.details);
  return viewers.some((viewer) =>
    travellerMatchesUsername(viewer, user.username),
  );
}

export function canViewPrivateItem(
  item: ItineraryItem,
  user: SessionUser,
): boolean {
  if (isAdminSession(user.roleLevel)) return true;
  if (userIsPrivateViewer(item, user)) return true;
  if (userIsAdditionalViewer(item, user)) return true;

  const travellers = isSubItem(item)
    ? extractSubItemParticipants(item.details)
    : extractItemTravellers(item.details, item.category);

  if (itemIncludesBroadGuestList(travellers)) {
    return false;
  }

  return travellers.some((traveller) =>
    travellerMatchesUsername(traveller, user.username),
  );
}
