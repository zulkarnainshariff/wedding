import type { ItineraryItem } from "./schema";
import {
  extractItemTravellers,
  itemIncludesEveryone,
  travellerMatchesUsername,
} from "./item-travellers";
import { CATEGORIES, type Category } from "./types";

import type { UserPreferences } from "./user-preferences";

export type UserPermissions = {
  viewCategories: Category[] | "all";
  viewTravellers: string[] | "all";
  canEdit: boolean;
  canManageUsers?: boolean;
};

export type SessionUser = {
  id: number;
  username: string;
  isAdmin: boolean;
  permissions: UserPermissions;
  preferences: UserPreferences;
};

export const DEFAULT_PERMISSIONS: UserPermissions = {
  viewCategories: "all",
  viewTravellers: [],
  canEdit: false,
  canManageUsers: false,
};

export const ADMIN_PERMISSIONS: UserPermissions = {
  viewCategories: "all",
  viewTravellers: "all",
  canEdit: true,
  canManageUsers: true,
};

export function normalizeViewTravellers(
  raw: unknown,
  username: string,
): string[] | "all" {
  if (raw === "all") return "all";
  if (!Array.isArray(raw)) return [username];

  const values = raw
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

  const unique = [...new Set([username.toLowerCase(), ...values])];
  return unique;
}

export function normalizePermissions(
  raw: unknown,
  isAdmin: boolean,
  username = "",
): UserPermissions {
  if (isAdmin) return ADMIN_PERMISSIONS;

  if (!raw || typeof raw !== "object") {
    return {
      ...DEFAULT_PERMISSIONS,
      viewTravellers: username ? [username.toLowerCase()] : [],
    };
  }

  const value = raw as Partial<UserPermissions>;
  const viewCategories =
    value.viewCategories === "all"
      ? "all"
      : Array.isArray(value.viewCategories)
        ? value.viewCategories.filter((c): c is Category =>
            CATEGORIES.includes(c as Category),
          )
        : DEFAULT_PERMISSIONS.viewCategories;

  return {
    viewCategories,
    viewTravellers: normalizeViewTravellers(value.viewTravellers, username),
    canEdit: Boolean(value.canEdit),
    canManageUsers: Boolean(value.canManageUsers),
  };
}

export function canViewCategory(
  user: SessionUser,
  category: Category,
): boolean {
  if (user.isAdmin) return true;
  const { viewCategories } = user.permissions;
  return viewCategories === "all" || viewCategories.includes(category);
}

export function canEditItinerary(user: SessionUser): boolean {
  return user.isAdmin || user.permissions.canEdit;
}

export function canManageUsers(user: SessionUser): boolean {
  return user.isAdmin || Boolean(user.permissions.canManageUsers);
}

export function canViewItemTravellers(
  item: ItineraryItem,
  user: SessionUser,
): boolean {
  if (user.isAdmin || user.permissions.viewTravellers === "all") {
    return true;
  }

  const allowed = user.permissions.viewTravellers;
  const travellers = extractItemTravellers(item.details, item.category);

  if (travellers.length === 0) {
    return item.category === "travel_insurance";
  }

  if (itemIncludesEveryone(travellers)) {
    return true;
  }

  return travellers.some((traveller) =>
    allowed.some((username) => travellerMatchesUsername(traveller, username)),
  );
}

export function filterItemsByPermission(
  items: ItineraryItem[],
  user: SessionUser,
): ItineraryItem[] {
  return items.filter((item) => {
    if (!canViewCategory(user, item.category as Category)) {
      return false;
    }
    return canViewItemTravellers(item, user);
  });
}

export function visibleCategories(user: SessionUser): Category[] | "all" {
  if (user.isAdmin || user.permissions.viewCategories === "all") {
    return "all";
  }
  return user.permissions.viewCategories;
}
