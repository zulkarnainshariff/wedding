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
    bg: "bg-sky-50",
    text: "text-sky-700",
    border: "border-sky-200",
    dot: "bg-sky-400",
  },
  flight: {
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
    dot: "bg-brand",
  },
  pet_relocation: {
    bg: "bg-rose-50",
    text: "text-rose-700",
    border: "border-rose-200",
    dot: "bg-rose-400",
  },
  accommodation: {
    bg: "bg-teal-50",
    text: "text-teal-700",
    border: "border-teal-200",
    dot: "bg-teal-400",
  },
  car_rental: {
    bg: "bg-cyan-50",
    text: "text-cyan-800",
    border: "border-cyan-200",
    dot: "bg-cyan-500",
  },
  travel_insurance: {
    bg: "bg-violet-50",
    text: "text-violet-700",
    border: "border-violet-200",
    dot: "bg-violet-400",
  },
};
