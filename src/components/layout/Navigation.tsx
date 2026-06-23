"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  LayoutGrid,
  Menu,
  Pencil,
  X,
} from "lucide-react";
import { CATEGORY_ICONS } from "@/lib/category-ui";
import { CATEGORIES, CATEGORY_META, type Category } from "@/lib/types";

const NAV_ITEMS: { href: string; label: string; category?: Category | "all" }[] =
  [
    { href: "/itinerary", label: "View All", category: "all" },
    ...CATEGORIES.map((category) => ({
      href: `/itinerary/${category}`,
      label: CATEGORY_META[category].label,
      category,
    })),
  ];

function NavLink({
  href,
  label,
  category,
  onNavigate,
  compact,
}: {
  href: string;
  label: string;
  category?: Category | "all";
  onNavigate?: () => void;
  compact?: boolean;
}) {
  const pathname = usePathname();
  const active =
    category === "all"
      ? pathname === "/itinerary"
      : pathname === href || pathname.startsWith(`${href}/`);

  const Icon =
    category && category !== "all"
      ? CATEGORY_ICONS[category]
      : LayoutGrid;

  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={[
        "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
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
  return (
    <aside
      className={[
        "flex h-full flex-col border-r border-stone-200/80 bg-[#faf8f5]",
        compact ? "w-[72px]" : "w-64",
      ].join(" ")}
    >
      <div className={["border-b border-stone-200/80 p-4", compact ? "px-2" : ""].join(" ")}>
        <div className={compact ? "flex justify-center" : ""}>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1e3a5f] text-[#d4a853]">
            <CalendarDays className="h-5 w-5" />
          </div>
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
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.href} {...item} compact={compact} />
        ))}
      </nav>

      <div className="border-t border-stone-200/80 p-3">
        <NavLink
          href="/admin"
          label="Manage"
          compact={compact}
        />
        {!compact && (
          <p className="mt-3 px-1 text-[11px] leading-relaxed text-stone-400">
            Family itinerary · Bali 2026
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
        <p className="text-xs text-stone-500">Bali 2026</p>
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
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.href} {...item} onNavigate={onClose} />
          ))}
          <NavLink href="/admin" label="Manage" onNavigate={onClose} />
        </nav>
      </div>
    </div>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  const tabs = [
    { href: "/itinerary", label: "All", category: "all" as const },
    ...CATEGORIES.slice(0, 4).map((category) => ({
      href: `/itinerary/${category}`,
      label: CATEGORY_META[category].label.split(" ")[0],
      category,
    })),
  ];

  return (
    <nav className="fixed right-0 bottom-0 left-0 z-30 border-t border-stone-200 bg-white/95 backdrop-blur md:hidden">
      <div className="grid grid-cols-5">
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

export function AdminLink() {
  return (
    <Link
      href="/admin"
      className="hidden items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-600 hover:border-[#1e3a5f]/30 hover:text-[#1e3a5f] md:inline-flex"
    >
      <Pencil className="h-4 w-4" />
      Manage
    </Link>
  );
}
