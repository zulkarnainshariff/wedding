import {
  CalendarDays,
  Car,
  Cat,
  Home,
  LayoutGrid,
  Plane,
  Shield,
  Briefcase,
  MapPin,
  Luggage,
  Ticket,
  Ship,
  Train,
  Bus,
  Utensils,
  Camera,
  Heart,
  Star,
  type LucideIcon,
} from "lucide-react";
import { CATEGORY_META, LEGACY_CATEGORIES, type LegacyCategory } from "@/lib/types";

const ICON_BY_NAME: Record<string, LucideIcon> = {
  "layout-grid": LayoutGrid,
  calendar: CalendarDays,
  plane: Plane,
  cat: Cat,
  home: Home,
  car: Car,
  shield: Shield,
  briefcase: Briefcase,
  "map-pin": MapPin,
  luggage: Luggage,
  ticket: Ticket,
  ship: Ship,
  train: Train,
  bus: Bus,
  utensils: Utensils,
  camera: Camera,
  heart: Heart,
  star: Star,
};

export const CATEGORY_ICON_OPTIONS = Object.keys(ICON_BY_NAME);

export type CategoryStyleSet = {
  bg: string;
  text: string;
  border: string;
  dot: string;
};

export const COLOR_STYLES: Record<string, CategoryStyleSet> = {
  stone: {
    bg: "bg-stone-50",
    text: "text-stone-700",
    border: "border-stone-200",
    dot: "bg-stone-400",
  },
  sky: {
    bg: "bg-sky-50",
    text: "text-sky-700",
    border: "border-sky-200",
    dot: "bg-sky-400",
  },
  blue: {
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
    dot: "bg-brand",
  },
  indigo: {
    bg: "bg-indigo-50",
    text: "text-indigo-700",
    border: "border-indigo-200",
    dot: "bg-indigo-400",
  },
  rose: {
    bg: "bg-rose-50",
    text: "text-rose-700",
    border: "border-rose-200",
    dot: "bg-rose-400",
  },
  emerald: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
    dot: "bg-emerald-400",
  },
  teal: {
    bg: "bg-teal-50",
    text: "text-teal-700",
    border: "border-teal-200",
    dot: "bg-teal-400",
  },
  amber: {
    bg: "bg-amber-50",
    text: "text-amber-800",
    border: "border-amber-200",
    dot: "bg-amber-500",
  },
  cyan: {
    bg: "bg-cyan-50",
    text: "text-cyan-800",
    border: "border-cyan-200",
    dot: "bg-cyan-500",
  },
  violet: {
    bg: "bg-violet-50",
    text: "text-violet-700",
    border: "border-violet-200",
    dot: "bg-violet-400",
  },
};

export const CATEGORY_COLOR_OPTIONS = Object.keys(COLOR_STYLES);

export function getCategoryIconByName(iconName: string): LucideIcon {
  return ICON_BY_NAME[iconName] ?? LayoutGrid;
}

export function getCategoryStylesByColor(color: string): CategoryStyleSet {
  return COLOR_STYLES[color] ?? COLOR_STYLES.stone;
}

export const CATEGORY_ICONS: Record<LegacyCategory, LucideIcon> = {
  activity: CalendarDays,
  flight: Plane,
  pet_relocation: Cat,
  accommodation: Home,
  car_rental: Car,
  travel_insurance: Shield,
};

/** @deprecated Prefer getCategoryIconByName with DB meta. */
export function getCategoryIcon(category: string, iconName?: string): LucideIcon {
  if (iconName) return getCategoryIconByName(iconName);
  if ((LEGACY_CATEGORIES as readonly string[]).includes(category)) {
    return CATEGORY_ICONS[category as LegacyCategory] ?? LayoutGrid;
  }
  const legacyMeta = CATEGORY_META[category as LegacyCategory];
  if (legacyMeta?.icon) return getCategoryIconByName(legacyMeta.icon);
  return LayoutGrid;
}

export const CATEGORY_STYLES: Record<string, CategoryStyleSet> = {
  activity: COLOR_STYLES.sky,
  flight: COLOR_STYLES.blue,
  pet_relocation: COLOR_STYLES.rose,
  accommodation: COLOR_STYLES.teal,
  car_rental: COLOR_STYLES.cyan,
  travel_insurance: COLOR_STYLES.violet,
};

export function getCategoryStyles(
  category: string,
  color?: string,
): CategoryStyleSet {
  if (color) return getCategoryStylesByColor(color);
  if ((LEGACY_CATEGORIES as readonly string[]).includes(category)) {
    return CATEGORY_STYLES[category as LegacyCategory] ?? COLOR_STYLES.stone;
  }
  const legacyMeta = CATEGORY_META[category as LegacyCategory];
  if (legacyMeta?.color) return getCategoryStylesByColor(legacyMeta.color);
  return COLOR_STYLES.stone;
}
