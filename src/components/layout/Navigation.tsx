"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
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
import { SidebarSyncButton } from "@/components/auth/SidebarSyncButton";
import { LogoutConfirmDialog } from "@/components/auth/LogoutConfirmDialog";
import { useAuth } from "@/components/auth/AuthProvider";
import { useNavigationGuard } from "@/components/layout/NavigationGuard";
import { CATEGORY_ICONS } from "@/lib/category-ui";
import { canViewAllGuestLists } from "@/lib/permissions";
import { ExportPdfPanel } from "@/components/itinerary/ExportPdfPanel";
import { DevModePanel } from "@/components/itinerary/DevModePanel";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { CATEGORIES, CATEGORY_META, type Category } from "@/lib/types";

const BASE_NAV_ITEMS: { href: string; label: string; category?: Category | "all" | "guests" | "invitations" | "tasks" }[] =
  [
    { href: "/itinerary", label: "View All", category: "all" },
    ...CATEGORIES.map((category) => ({
      href: `/itinerary/${category}`,
      label: CATEGORY_META[category].label,
      category,
    })),
    { href: "/invitation", label: "Invitations", category: "invitations" },
    { href: "/guests", label: "Guest lists", category: "guests" },
    { href: "/tasks", label: "Tasks", category: "tasks" },
  ];

function useNavItems() {
  const { user, canView, isAdmin, canEdit, canManageUsers, guestListAccess, loading } =
    useAuth();

  if (loading) return null;

  return BASE_NAV_ITEMS.filter((item) => {
    if (!user) return false;
    if (item.category === "invitations") return true;
    if (item.category === "guests") {
      return (
        isAdmin ||
        (guestListAccess?.length ?? 0) > 0 ||
        (user ? canViewAllGuestLists(user) : false)
      );
    }
    if (item.category === "tasks") return true;
    if (item.category === "all") return true;
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
}: {
  href: string;
  label: string;
  category?: Category | "all" | "guests" | "invitations" | "tasks";
  onNavigate?: () => void;
  compact?: boolean;
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
          : category && category !== "all" && category !== "guests" && category !== "invitations" && category !== "tasks"
            ? CATEGORY_ICONS[category as Category]
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
          ? "bg-[#1e3a5f] text-white shadow-md shadow-[#1e3a5f]/20"
          : "text-stone-600 hover:bg-stone-100 hover:text-stone-900",
        compact ? "justify-center px-2" : "",
      ].join(" ")}
      title={compact ? label : undefined}
    >
      <Icon
        className={[
          "h-5 w-5 shrink-0",
          active ? "text-[#d4a853]" : "text-stone-400 group-hover:text-stone-600",
        ].join(" ")}
      />
      {!compact && <span>{label}</span>}
    </Link>
  );
}

export function Sidebar({ compact = false }: { compact?: boolean }) {
  const { user, logout } = useAuth();
  const navItems = useNavItems();
  const [logoutOpen, setLogoutOpen] = useState(false);

  async function confirmLogout() {
    setLogoutOpen(false);
    await logout();
  }

  return (
    <aside
      className={[
        "flex h-full flex-col border-r border-stone-200/80 bg-[#faf8f5]",
        compact ? "w-[72px]" : "w-64",
      ].join(" ")}
    >
      <div className={["border-b border-stone-200/80 p-4", compact ? "px-2" : ""].join(" ")}>
        <div className={["flex items-start gap-2", compact ? "flex-col items-center" : ""].join(" ")}>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full shadow-sm">
            <AppMark size={40} />
          </div>
          {user && <NotificationBell compact={compact} />}
        </div>
        {!compact && (
          <div className="mt-3">
            <p className="font-serif text-lg text-[#1e3a5f]">Wedding</p>
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
            <NavLink key={item.href} {...item} compact={compact} />
          ))
        )}
      </nav>

      <div className="border-t border-stone-200/80 p-3 space-y-1">
        <ExportPdfPanel compact={compact} />
        <DevModePanel compact={compact} />
        <SidebarSyncButton compact={compact} />
        <NavLink href="/settings" label="Settings" compact={compact} />
        {!compact && user && (
          <div className="rounded-xl bg-stone-100 px-3 py-2 text-xs text-stone-600">
            Signed in as <span className="font-medium">{user.username}</span>
          </div>
        )}
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
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-stone-200/80 bg-[#faf8f5]/95 px-4 py-3 backdrop-blur lg:hidden">
      <div>
        <p className="font-serif text-lg text-[#1e3a5f]">Wedding Itinerary</p>
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
      <div className="absolute top-0 left-0 h-full w-[min(85vw,18rem)] bg-[#faf8f5] shadow-2xl">
        <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3">
          <p className="font-serif text-lg text-[#1e3a5f]">Menu</p>
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
              <NavLink key={item.href} {...item} onNavigate={onClose} />
            ))
          )}
          <div className="px-3 pt-2">
            <ExportPdfPanel />
          </div>
          <DevModePanel />
          <SidebarSyncButton />
          <NavLink href="/settings" label="Settings" onNavigate={onClose} />
          {user && (
            <p className="px-3 pt-3 text-xs text-stone-500">
              Signed in as {user.username}
            </p>
          )}
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
  const tabs = [
    { href: "/itinerary", label: "All", category: "all" as const },
    { href: "/itinerary/flight", label: "Flights", category: "flight" as const },
    { href: "/itinerary/pet_relocation", label: "Pets", category: "pet_relocation" as const },
    { href: "/itinerary/accommodation", label: "Stay", category: "accommodation" as const },
    { href: "/itinerary/car_rental", label: "Cars", category: "car_rental" as const },
    { href: "/itinerary/activity", label: "Schedule", category: "activity" as const },
  ].filter((tab) => tab.category === "all" || canView(tab.category));

  return (
    <nav className="fixed right-0 bottom-0 left-0 z-30 border-t border-stone-200 bg-white/95 backdrop-blur md:hidden">
      <div
        className="grid"
        style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
      >
        {tabs.map((tab) => {
          const active =
            tab.category === "all"
              ? pathname === "/itinerary"
              : pathname.startsWith(tab.href);
          const Icon =
            tab.category === "all"
              ? LayoutGrid
              : CATEGORY_ICONS[tab.category];

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={[
                "flex flex-col items-center gap-0.5 px-1 py-2 text-[10px] font-medium",
                active ? "text-[#1e3a5f]" : "text-stone-400",
              ].join(" ")}
            >
              <Icon className={["h-5 w-5", active ? "text-[#d4a853]" : ""].join(" ")} />
              <span className="truncate">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
