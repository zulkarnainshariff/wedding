"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import {
  Heart,
  LayoutGrid,
  LogOut,
  Menu,
  Pencil,
  Settings,
  Users,
  X,
  CheckSquare,
} from "lucide-react";
import { AppMark } from "@/components/ui/AppMark";
import { SidebarSyncIconButton } from "@/components/auth/SidebarSyncIconButton";
import { AdminElevationControl } from "@/components/auth/AdminElevationControl";
import { LogoutConfirmDialog } from "@/components/auth/LogoutConfirmDialog";
import { useAuth } from "@/components/auth/AuthProvider";
import { useNavigationGuard } from "@/components/layout/NavigationGuard";
import { getCategoryIconByName } from "@/lib/category-ui";
import { ExportPdfPanel } from "@/components/itinerary/ExportPdfPanel";
import { DevModePanel } from "@/components/itinerary/DevModePanel";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { useCategories } from "@/components/categories/CategoriesProvider";
import { TaskIndicatorBadge, useTaskIndicators } from "@/components/tasks/useTaskIndicators";

const USERNAME_DISPLAY_MAX = 14;

type NavCategory = string | "all" | "guests" | "invitations" | "tasks" | "flights_hub";

type NavItem = {
  href: string;
  label: string;
  category?: NavCategory;
  icon?: string;
};

const STATIC_NAV_TAIL: NavItem[] = [
  { href: "/invitation", label: "Invitations", category: "invitations" },
  { href: "/guests", label: "Guest lists", category: "guests" },
  { href: "/tasks", label: "Tasks", category: "tasks" },
];

function buildCategoryNavItems(
  itemCategories: ReturnType<typeof useCategories>["itemCategories"],
) {
  const sorted = [...itemCategories]
    .filter((row) => row.pageBehavior !== "redirect")
    .sort((a, b) => a.sortOrder - b.sortOrder || a.slug.localeCompare(b.slug));

  const activity =
    sorted.find((row) => row.slug === "activity") ??
    sorted.find((row) => row.pageBehavior === "schedule");
  const rest = sorted.filter((row) => row !== activity);

  const items: NavItem[] = [];

  if (activity) {
    items.push({
      href: `/itinerary/${activity.slug}`,
      label: activity.label,
      category: activity.slug,
      icon: activity.icon,
    });
  }

  items.push({ href: "/itinerary", label: "View All", category: "all" });

  for (const row of rest) {
    items.push({
      href: `/itinerary/${row.slug}`,
      label: row.label,
      category: row.pageBehavior === "flights_hub" ? "flights_hub" : row.slug,
      icon: row.icon,
    });
  }

  return items;
}

function formatUsername(username: string): string {
  if (username.length <= USERNAME_DISPLAY_MAX) return username;
  return `${username.slice(0, USERNAME_DISPLAY_MAX - 1)}…`;
}

function useNavItems() {
  const {
    user,
    canView,
    isAdmin,
    canEdit,
    canManageUsers,
    guestListAccess,
    loading,
  } = useAuth();
  const { itemCategories, loading: categoriesLoading } = useCategories();

  const baseNavItems = useMemo(
    () => [...buildCategoryNavItems(itemCategories), ...STATIC_NAV_TAIL],
    [itemCategories],
  );

  if (loading || categoriesLoading) return null;
  if (!user) return null;

  return baseNavItems.filter((item) => {
    if (item.category === "invitations") return true;
    if (item.category === "guests") {
      return isAdmin || (guestListAccess?.length ?? 0) > 0;
    }
    if (item.category === "tasks") return true;
    if (item.category === "all") return true;
    if (item.category === "flights_hub") {
      return canView("flight") || canView("pet_relocation");
    }
    if (!item.category) return false;
    return canView(item.category);
  }).concat(
    isAdmin || canManageUsers || canEdit
      ? [{ href: "/admin", label: "Manage", category: undefined as undefined }]
      : [],
  );
}

function NavLink({
  href,
  label,
  category,
  onNavigate,
  compact,
  badgeCount = 0,
  iconName,
}: {
  href: string;
  label: string;
  category?: NavCategory | "guests" | "invitations" | "tasks";
  onNavigate?: () => void;
  compact?: boolean;
  badgeCount?: number;
  iconName?: string;
}) {
  const pathname = usePathname();
  const guard = useNavigationGuard();
  const active =
    href === "/invitation"
      ? pathname === "/invitation"
      : href === "/guests"
        ? pathname.startsWith("/guests")
          : href === "/tasks"
            ? pathname.startsWith("/tasks")
            : category === "all"
            ? pathname === "/itinerary"
            : category === "flights_hub"
              ? pathname === "/itinerary/flight" ||
                pathname.startsWith("/itinerary/flight/") ||
                pathname.startsWith("/itinerary/pet_relocation")
              : pathname === href || pathname.startsWith(`${href}/`);

  const Icon =
    href === "/invitation"
      ? Heart
      : href === "/guests"
        ? Users
        : href === "/tasks"
          ? CheckSquare
          : href === "/admin"
            ? Pencil
            : href === "/settings"
              ? Settings
              : iconName
                ? getCategoryIconByName(iconName)
                : category === "flights_hub"
                  ? getCategoryIconByName("plane")
                  : LayoutGrid;

  return (
    <Link
      href={href}
      onClick={(event) => {
        if (guard && !guard.confirmNavigation()) {
          event.preventDefault();
          return;
        }
        onNavigate?.();
      }}
      className={[
        "group flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
        active
          ? "bg-brand-deep text-white shadow-md shadow-brand-deep/25"
          : "text-muted hover:bg-accent-pearl/60 hover:text-brand-deep",
        compact ? "justify-center px-2" : "",
      ].join(" ")}
      title={compact ? label : undefined}
    >
      <span className="relative shrink-0">
        <Icon
          className={[
            "h-5 w-5",
            active ? "text-accent-soft" : "text-muted group-hover:text-brand",
          ].join(" ")}
        />
        {compact && badgeCount > 0 ? (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-0.5 text-[9px] font-semibold text-white">
            {badgeCount > 99 ? "99+" : badgeCount}
          </span>
        ) : null}
      </span>
      {!compact && (
        <>
          <span className="min-w-0 flex-1">{label}</span>
          <TaskIndicatorBadge count={badgeCount} active={active} />
        </>
      )}
    </Link>
  );
}

function SignedInRow({ username }: { username: string }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl bg-accent-pearl/50 px-3 py-2 text-xs text-muted">
      <span className="min-w-0 truncate">
        Signed in as{" "}
        <span className="font-medium" title={username}>
          {formatUsername(username)}
        </span>
      </span>
      <div className="flex shrink-0 items-center gap-1">
        <AdminElevationControl />
        <SidebarSyncIconButton />
      </div>
    </div>
  );
}

export function Sidebar({ compact = false }: { compact?: boolean }) {
  const { user, logout } = useAuth();
  const navItems = useNavItems();
  const { openCount: openTaskCount } = useTaskIndicators();
  const [logoutOpen, setLogoutOpen] = useState(false);

  async function confirmLogout() {
    setLogoutOpen(false);
    await logout();
  }

  return (
    <aside
      className={[
        "flex h-full flex-col border-r border-border/80 bg-surface-soft",
        compact ? "w-[72px]" : "w-64",
      ].join(" ")}
    >
      <div className={["border-b border-border/80 p-4", compact ? "px-2" : ""].join(" ")}>
        <div className={["flex items-start gap-2", compact ? "flex-col items-center" : ""].join(" ")}>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full shadow-sm">
            <AppMark size={40} />
          </div>
          {user && <NotificationBell compact={compact} />}
        </div>
        {!compact && (
          <div className="mt-3">
            <p className="font-serif text-lg text-brand-deep">Wedding</p>
            <p className="text-xs tracking-wide text-stone-500 uppercase">
              Travel Itinerary
            </p>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {navItems === null ? (
          <div className="space-y-1">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="h-10 animate-pulse rounded-xl bg-stone-200/70"
              />
            ))}
          </div>
        ) : (
          navItems.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              label={item.label}
              category={item.category}
              iconName={item.icon}
              compact={compact}
              badgeCount={item.category === "tasks" ? openTaskCount : 0}
            />
          ))
        )}
      </nav>

      <div className="space-y-1 border-t border-border/80 p-3">
        <ExportPdfPanel compact={compact} />
        <DevModePanel compact={compact} />
        {!compact && user && <SignedInRow username={user.username} />}
        {compact && user && (
          <div className="flex flex-col items-center gap-1 py-1">
            <AdminElevationControl compact />
            <SidebarSyncIconButton />
          </div>
        )}
        <NavLink href="/settings" label="Settings" compact={compact} />
        <button
          type="button"
          onClick={() => setLogoutOpen(true)}
          className={[
            "flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-stone-600 hover:bg-stone-100",
            compact ? "justify-center px-2" : "",
          ].join(" ")}
          title={compact ? "Log out" : undefined}
        >
          <LogOut className="h-5 w-5 shrink-0 text-stone-400" />
          {!compact && <span>Log out</span>}
        </button>
        <LogoutConfirmDialog
          open={logoutOpen}
          onClose={() => setLogoutOpen(false)}
          onConfirm={() => void confirmLogout()}
        />
        {!compact && (
          <p className="mt-3 px-1 text-[11px] leading-relaxed text-stone-400">
            Family wedding travel 2026
          </p>
        )}
      </div>
    </aside>
  );
}

export function MobileHeader({
  onOpenMenu,
}: {
  onOpenMenu: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border/80 bg-surface-soft/95 px-4 py-3 backdrop-blur lg:hidden">
      <div>
        <p className="font-serif text-lg text-brand-deep">Wedding Itinerary</p>
        <p className="text-xs text-stone-500">Wedding travel 2026</p>
      </div>
      <button
        type="button"
        onClick={onOpenMenu}
        className="rounded-lg border border-stone-200 bg-white p-2 text-stone-600"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>
    </header>
  );
}

export function MobileDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { user, logout } = useAuth();
  const navItems = useNavItems();
  const { openCount: openTaskCount } = useTaskIndicators();
  const [logoutOpen, setLogoutOpen] = useState(false);

  async function confirmLogout() {
    setLogoutOpen(false);
    onClose();
    await logout();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <button
        type="button"
        className="absolute inset-0 bg-stone-900/40"
        onClick={onClose}
        aria-label="Close menu"
      />
      <div className="absolute top-0 left-0 h-full w-[min(85vw,18rem)] bg-surface-soft shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="font-serif text-lg text-brand-deep">Menu</p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-stone-500 hover:bg-stone-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="space-y-1 p-3">
          {navItems === null ? (
            <div className="space-y-1">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="h-10 animate-pulse rounded-xl bg-stone-200/70"
                />
              ))}
            </div>
          ) : (
            navItems.map((item) => (
              <NavLink
                key={item.href}
                href={item.href}
                label={item.label}
                category={item.category}
                iconName={item.icon}
                onNavigate={onClose}
                badgeCount={item.category === "tasks" ? openTaskCount : 0}
              />
            ))
          )}
          <div className="px-3 pt-2">
            <ExportPdfPanel />
          </div>
          <DevModePanel />
          {user && <SignedInRow username={user.username} />}
          <NavLink href="/settings" label="Settings" onNavigate={onClose} />
          <button
            type="button"
            onClick={() => setLogoutOpen(true)}
            className="mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-stone-600 hover:bg-stone-100"
          >
            <LogOut className="h-5 w-5" />
            Log out
          </button>
          <LogoutConfirmDialog
            open={logoutOpen}
            onClose={() => setLogoutOpen(false)}
            onConfirm={() => void confirmLogout()}
          />
        </nav>
      </div>
    </div>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  const { canView } = useAuth();
  const { itemCategories } = useCategories();

  const activity =
    itemCategories.find((row) => row.slug === "activity") ??
    itemCategories.find((row) => row.pageBehavior === "schedule");
  const flights = itemCategories.find((row) => row.pageBehavior === "flights_hub");
  const accommodation = itemCategories.find((row) => row.slug === "accommodation");
  const carRental = itemCategories.find((row) => row.slug === "car_rental");

  const tabs = [
    activity
      ? {
          href: `/itinerary/${activity.slug}`,
          label: activity.shortLabel,
          category: activity.slug,
          icon: activity.icon,
        }
      : null,
    flights
      ? {
          href: `/itinerary/${flights.slug}`,
          label: flights.shortLabel,
          category: "flights_hub" as const,
          icon: flights.icon,
        }
      : null,
    {
      href: "/invitation",
      label: "Invitation",
      category: "invitations" as const,
      icon: "heart",
    },
    accommodation
      ? {
          href: `/itinerary/${accommodation.slug}`,
          label: accommodation.shortLabel,
          category: accommodation.slug,
          icon: accommodation.icon,
        }
      : null,
    carRental
      ? {
          href: `/itinerary/${carRental.slug}`,
          label: carRental.shortLabel,
          category: carRental.slug,
          icon: carRental.icon,
        }
      : null,
  ]
    .filter((tab): tab is NonNullable<typeof tab> => tab !== null)
    .filter((tab) => {
      if (tab.category === "invitations") return true;
      if (tab.category === "flights_hub") {
        return canView("flight") || canView("pet_relocation");
      }
      return canView(tab.category);
    });

  return (
    <nav className="fixed right-0 bottom-0 left-0 z-30 border-t border-border bg-surface/95 backdrop-blur md:hidden">
      <div
        className="grid"
        style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
      >
        {tabs.map((tab) => {
          const active =
            tab.category === "invitations"
              ? pathname.startsWith("/invitation")
              : tab.category === "flights_hub"
                ? pathname.startsWith("/itinerary/flight") ||
                  pathname.startsWith("/itinerary/pet_relocation")
                : pathname.startsWith(tab.href);
          const Icon =
            tab.category === "invitations"
              ? Heart
              : getCategoryIconByName(tab.icon);

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={[
                "flex flex-col items-center gap-0.5 px-1 py-2 text-[10px] font-medium",
                active ? "text-brand-deep" : "text-muted",
              ].join(" ")}
            >
              <Icon className={["h-5 w-5", active ? "text-accent" : ""].join(" ")} />
              <span className="truncate">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
