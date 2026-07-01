import type { ItineraryItem } from "./schema";
import {
  extractItemTravellers,
  itemIncludesEveryone,
  travellerMatchesUsername,
} from "./item-travellers";
import { isItemPrivate, canViewPrivateItem } from "./item-privacy";
import { CATEGORIES, type Category } from "./types";

import type { UserPreferences } from "./user-preferences";

import {
  isAdminSession,
  isSuperuserRole,
  roleLevelFromDb,
  ROLE_ADMIN,
  ROLE_USER,
} from "./role-levels";

export type UserPermissions = {
  viewCategories: Category[] | "all";
  viewTravellers: string[] | "all";
  canEdit: boolean;
  canManageUsers?: boolean;
  canViewAllGuestLists?: boolean;
  canEditAllGuestLists?: boolean;
  isWeddingCoordinator?: boolean;
  canModerateGuestbook?: boolean;
};

export type SessionUser = {
  id: number;
  username: string;
  roleLevel: number;
  isAdmin: boolean;
  permissions: UserPermissions;
  preferences: UserPreferences;
};

export const DEFAULT_PERMISSIONS: UserPermissions = {
  viewCategories: "all",
  viewTravellers: [],
  canEdit: false,
  canManageUsers: false,
  canViewAllGuestLists: false,
  canEditAllGuestLists: false,
};

export const ADMIN_PERMISSIONS: UserPermissions = {
  viewCategories: "all",
  viewTravellers: "all",
  canEdit: true,
  canManageUsers: true,
  canViewAllGuestLists: true,
  canEditAllGuestLists: true,
  isWeddingCoordinator: true,
  canModerateGuestbook: true,
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

export function isSuperuser(user: SessionUser): boolean {
  return isSuperuserRole(user.roleLevel);
}

export function canManageAdmins(user: SessionUser): boolean {
  return isSuperuser(user);
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
    canViewAllGuestLists: Boolean(
      value.canViewAllGuestLists || value.canEditAllGuestLists,
    ),
    canEditAllGuestLists: Boolean(value.canEditAllGuestLists),
    isWeddingCoordinator: Boolean(value.isWeddingCoordinator),
    canModerateGuestbook: Boolean(value.canModerateGuestbook),
  };
}

export function canModerateGuestbook(user: SessionUser): boolean {
  return (
    isAdminSession(user.roleLevel) ||
    Boolean(user.permissions.canModerateGuestbook)
  );
}

export function canViewCategory(
  user: SessionUser,
  category: Category,
): boolean {
  if (isAdminSession(user.roleLevel)) return true;
  const { viewCategories } = user.permissions;
  return viewCategories === "all" || viewCategories.includes(category);
}

export function canEditItinerary(user: SessionUser): boolean {
  return isAdminSession(user.roleLevel) || user.permissions.canEdit;
}

export function canManageUsers(user: SessionUser): boolean {
  return (
    isAdminSession(user.roleLevel) || Boolean(user.permissions.canManageUsers)
  );
}

export function canViewAllGuestLists(user: SessionUser): boolean {
  return (
    isAdminSession(user.roleLevel) ||
    canManageUsers(user) ||
    Boolean(user.permissions.canViewAllGuestLists) ||
    Boolean(user.permissions.isWeddingCoordinator)
  );
}

export function canEditAllGuestLists(user: SessionUser): boolean {
  return (
    isAdminSession(user.roleLevel) ||
    canManageUsers(user) ||
    Boolean(user.permissions.canEditAllGuestLists)
  );
}

export function receivesAllGuestListNotifications(user: {
  roleLevel?: number;
  isAdmin: boolean;
  permissions: UserPermissions;
}): boolean {
  const level = user.roleLevel ?? (user.isAdmin ? ROLE_ADMIN : ROLE_USER);
  return (
    isAdminSession(level) ||
    Boolean(user.permissions.canManageUsers) ||
    Boolean(user.permissions.isWeddingCoordinator) ||
    Boolean(
      user.permissions.canViewAllGuestLists ||
        user.permissions.canEditAllGuestLists,
    )
  );
}

export function isWeddingCoordinator(user: SessionUser): boolean {
  return (
    isAdminSession(user.roleLevel) ||
    Boolean(user.permissions.isWeddingCoordinator)
  );
}

export function canViewItemTravellers(
  item: ItineraryItem,
  user: SessionUser,
): boolean {
  if (isItemPrivate(item.details)) {
    return canViewPrivateItem(item, user);
  }

  if (isAdminSession(user.roleLevel) || user.permissions.viewTravellers === "all") {
    return true;
  }

  const allowed = user.permissions.viewTravellers;
  const travellers = extractItemTravellers(item.details, item.category);

  if (travellers.length === 0) {
    return (
      item.category === "travel_insurance" ||
      item.category === "flight"
    );
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

export function parentHasVisibleSubitems(
  parentId: number,
  visibleSubitems: ItineraryItem[],
): boolean {
  return visibleSubitems.some((subitem) => subitem.parentItemId === parentId);
}

export function filterParentsWithSubitemAccess(
  parents: ItineraryItem[],
  visibleSubitems: ItineraryItem[],
  user: SessionUser,
): ItineraryItem[] {
  return parents.filter((parent) => {
    if (canViewCategory(user, parent.category as Category) &&
        canViewItemTravellers(parent, user)) {
      return true;
    }
    return parentHasVisibleSubitems(parent.id, visibleSubitems);
  });
}

export function hasFullItemView(
  item: ItineraryItem,
  user: SessionUser,
): boolean {
  if (!canViewCategory(user, item.category as Category)) return false;
  return canViewItemTravellers(item, user);
}

export function visibleCategories(user: SessionUser): Category[] | "all" {
  if (isAdminSession(user.roleLevel) || user.permissions.viewCategories === "all") {
    return "all";
  }
  return user.permissions.viewCategories;
}
