import {
  CalendarDays,
  Car,
  Cat,
  Home,
  LayoutGrid,
  Plane,
  Shield,
  type LucideIcon,
} from "lucide-react";
import type { Category } from "@/lib/types";

export const CATEGORY_ICONS: Record<Category, LucideIcon> = {
  activity: CalendarDays,
  flight: Plane,
  pet_relocation: Cat,
  accommodation: Home,
  car_rental: Car,
  travel_insurance: Shield,
};

export function getCategoryIcon(category: Category): LucideIcon {
  return CATEGORY_ICONS[category] ?? LayoutGrid;
}

export const CATEGORY_STYLES: Record<
  Category,
  { bg: string; text: string; border: string; dot: string }
> = {
  activity: {
    bg: "bg-indigo-50",
    text: "text-indigo-700",
    border: "border-indigo-200",
    dot: "bg-indigo-500",
  },
  flight: {
    bg: "bg-sky-50",
    text: "text-sky-700",
    border: "border-sky-200",
    dot: "bg-sky-500",
  },
  pet_relocation: {
    bg: "bg-rose-50",
    text: "text-rose-700",
    border: "border-rose-200",
    dot: "bg-rose-500",
  },
  accommodation: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
    dot: "bg-emerald-500",
  },
  car_rental: {
    bg: "bg-amber-50",
    text: "text-amber-800",
    border: "border-amber-200",
    dot: "bg-amber-500",
  },
  travel_insurance: {
    bg: "bg-violet-50",
    text: "text-violet-700",
    border: "border-violet-200",
    dot: "bg-violet-500",
  },
};
