export type PageBehavior =
  | "list"
  | "schedule"
  | "flights_hub"
  | "travel_insurance"
  | "redirect";

export type PageBehaviorConfig = {
  targetSlug?: string;
  tab?: string;
};

export type CategoryMeta = {
  label: string;
  plural: string;
  shortLabel: string;
  icon: string;
  color: string;
};

export type AppCategorySeed = {
  slug: string;
  label: string;
  plural: string;
  shortLabel: string;
  icon: string;
  color: string;
  sortOrder: number;
  forItems: boolean;
  forDocuments: boolean;
  pageBehavior: PageBehavior;
  pageBehaviorConfig: PageBehaviorConfig;
};

export const BUILTIN_CATEGORY_SEEDS: AppCategorySeed[] = [
  {
    slug: "general",
    label: "General",
    plural: "General",
    shortLabel: "General",
    icon: "layout-grid",
    color: "stone",
    sortOrder: 0,
    forItems: false,
    forDocuments: true,
    pageBehavior: "list",
    pageBehaviorConfig: {},
  },
  {
    slug: "activity",
    label: "Daily Schedule",
    plural: "Daily Schedule",
    shortLabel: "Schedule",
    icon: "calendar",
    color: "indigo",
    sortOrder: 10,
    forItems: true,
    forDocuments: true,
    pageBehavior: "schedule",
    pageBehaviorConfig: {},
  },
  {
    slug: "flight",
    label: "Flights",
    plural: "Flights",
    shortLabel: "Flights",
    icon: "plane",
    color: "sky",
    sortOrder: 20,
    forItems: true,
    forDocuments: true,
    pageBehavior: "flights_hub",
    pageBehaviorConfig: {},
  },
  {
    slug: "pet_relocation",
    label: "Pet Relocation",
    plural: "Pet Relocation",
    shortLabel: "Pets",
    icon: "cat",
    color: "rose",
    sortOrder: 25,
    forItems: true,
    forDocuments: true,
    pageBehavior: "redirect",
    pageBehaviorConfig: { targetSlug: "flight", tab: "pet_relocation" },
  },
  {
    slug: "accommodation",
    label: "Accommodation",
    plural: "Accommodation",
    shortLabel: "Stay",
    icon: "home",
    color: "emerald",
    sortOrder: 30,
    forItems: true,
    forDocuments: true,
    pageBehavior: "list",
    pageBehaviorConfig: {},
  },
  {
    slug: "car_rental",
    label: "Car Rental",
    plural: "Car Rentals",
    shortLabel: "Cars",
    icon: "car",
    color: "amber",
    sortOrder: 40,
    forItems: true,
    forDocuments: true,
    pageBehavior: "list",
    pageBehaviorConfig: {},
  },
  {
    slug: "travel_insurance",
    label: "Travel Insurance",
    plural: "Travel Insurance",
    shortLabel: "Insurance",
    icon: "shield",
    color: "violet",
    sortOrder: 50,
    forItems: true,
    forDocuments: true,
    pageBehavior: "travel_insurance",
    pageBehaviorConfig: {},
  },
];

export function slugifyCategoryLabel(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
}

export function validateCategorySlug(slug: string): string | null {
  const normalized = slug.trim().toLowerCase();
  if (!normalized) return "Slug is required";
  if (!/^[a-z][a-z0-9_]*$/.test(normalized)) {
    return "Slug must start with a letter and contain only lowercase letters, numbers, and underscores";
  }
  if (normalized.length > 64) return "Slug is too long";
  return null;
}
