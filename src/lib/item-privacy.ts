import {
  extractItemTravellers,
  travellerMatchesUsername,
} from "@/lib/item-travellers";
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
  const travellers = extractItemTravellers(item.details, item.category);
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

export function canViewPrivateItem(
  item: ItineraryItem,
  user: SessionUser,
): boolean {
  if (isAdminSession(user.roleLevel)) return true;
  if (userIsItemParticipant(item, user)) return true;
  return userIsPrivateViewer(item, user);
}
