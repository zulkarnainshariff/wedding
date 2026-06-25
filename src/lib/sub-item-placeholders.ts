import type { ItineraryItem } from "@/lib/schema";
import type { Category } from "@/lib/types";

export type SubItemFormPlaceholders = {
  title: string;
  locationName: string;
  locationMapUrl: string;
};

const DEFAULT_PLACEHOLDERS: SubItemFormPlaceholders = {
  title: "Add a step or reminder",
  locationName: "Location name",
  locationMapUrl: "https://maps.google.com/...",
};

const PLACEHOLDERS_BY_CATEGORY: Partial<
  Record<Category, SubItemFormPlaceholders>
> = {
  flight: {
    title: "Online check-in",
    locationName: "Departure airport",
    locationMapUrl: "https://maps.google.com/...",
  },
  pet_relocation: {
    title: "Drop off at cargo desk",
    locationName: "Airline cargo office",
    locationMapUrl: "https://maps.google.com/...",
  },
  accommodation: {
    title: "Pick up keys",
    locationName: "Property address",
    locationMapUrl: "https://maps.google.com/...",
  },
  car_rental: {
    title: "Collect rental car",
    locationName: "Pick-up location",
    locationMapUrl: "https://maps.google.com/...",
  },
  travel_insurance: {
    title: "Save policy confirmation",
    locationName: "Insurer or policy reference",
    locationMapUrl: "https://maps.google.com/...",
  },
  activity: {
    title: "Add a timed step",
    locationName: "Meeting point",
    locationMapUrl: "https://maps.google.com/...",
  },
};

export function getSubItemFormPlaceholders(
  parent: ItineraryItem,
): SubItemFormPlaceholders {
  const category = parent.category as Category;
  return PLACEHOLDERS_BY_CATEGORY[category] ?? DEFAULT_PLACEHOLDERS;
}
