import { cache } from "react";
import { unstable_noStore as noStore } from "next/cache";
import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  appCategories,
  itemDocuments,
  itineraryItems,
  users,
  type AppCategoryRow,
} from "@/lib/schema";
import { CATEGORY_META, LEGACY_CATEGORIES } from "@/lib/types";

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

let schemaEnsured = false;

async function ensureAppCategoriesSchema(): Promise<void> {
  if (schemaEnsured) return;

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS app_categories (
      slug text PRIMARY KEY,
      label text NOT NULL,
      plural text NOT NULL,
      short_label text NOT NULL,
      icon text NOT NULL DEFAULT 'layout-grid',
      color text NOT NULL DEFAULT 'stone',
      sort_order integer NOT NULL DEFAULT 0,
      for_items boolean NOT NULL DEFAULT false,
      for_documents boolean NOT NULL DEFAULT false,
      page_behavior text NOT NULL DEFAULT 'list',
      page_behavior_config jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  for (const seed of BUILTIN_CATEGORY_SEEDS) {
    await db.execute(sql`
      INSERT INTO app_categories (
        slug, label, plural, short_label, icon, color, sort_order,
        for_items, for_documents, page_behavior, page_behavior_config
      ) VALUES (
        ${seed.slug},
        ${seed.label},
        ${seed.plural},
        ${seed.shortLabel},
        ${seed.icon},
        ${seed.color},
        ${seed.sortOrder},
        ${seed.forItems},
        ${seed.forDocuments},
        ${seed.pageBehavior},
        ${JSON.stringify(seed.pageBehaviorConfig)}::jsonb
      )
      ON CONFLICT (slug) DO NOTHING
    `);
  }

  schemaEnsured = true;
}

function rowToCategory(row: AppCategoryRow): AppCategoryRow {
  return row;
}

function legacyMetaForSlug(slug: string): CategoryMeta | null {
  if (!(LEGACY_CATEGORIES as readonly string[]).includes(slug)) return null;
  const meta = CATEGORY_META[slug as keyof typeof CATEGORY_META];
  return meta ?? null;
}

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

export const getAllAppCategories = cache(async (): Promise<AppCategoryRow[]> => {
  noStore();
  try {
    await ensureAppCategoriesSchema();
    const rows = await db
      .select()
      .from(appCategories)
      .orderBy(asc(appCategories.sortOrder), asc(appCategories.slug));
    if (rows.length > 0) return rows.map(rowToCategory);
  } catch {
    // fall through to seeds
  }
  return BUILTIN_CATEGORY_SEEDS.map((seed) => ({
    slug: seed.slug,
    label: seed.label,
    plural: seed.plural,
    shortLabel: seed.shortLabel,
    icon: seed.icon,
    color: seed.color,
    sortOrder: seed.sortOrder,
    forItems: seed.forItems,
    forDocuments: seed.forDocuments,
    pageBehavior: seed.pageBehavior,
    pageBehaviorConfig: seed.pageBehaviorConfig,
    createdAt: new Date(),
  }));
});

export async function getItemCategories(): Promise<AppCategoryRow[]> {
  const all = await getAllAppCategories();
  return all.filter((row) => row.forItems);
}

export async function getDocumentCategories(): Promise<AppCategoryRow[]> {
  const all = await getAllAppCategories();
  return all.filter((row) => row.forDocuments);
}

export async function getCategoryBySlug(
  slug: string,
): Promise<AppCategoryRow | null> {
  const all = await getAllAppCategories();
  return all.find((row) => row.slug === slug) ?? null;
}

export async function getCategoryMeta(slug: string): Promise<CategoryMeta> {
  const row = await getCategoryBySlug(slug);
  if (row) {
    return {
      label: row.label,
      plural: row.plural,
      shortLabel: row.shortLabel,
      icon: row.icon,
      color: row.color,
    };
  }
  const legacy = legacyMetaForSlug(slug);
  if (legacy) return legacy;
  return {
    label: slug.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    plural: slug.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    shortLabel: slug,
    icon: "layout-grid",
    color: "stone",
  };
}

export async function isItemCategorySlug(slug: string): Promise<boolean> {
  const row = await getCategoryBySlug(slug);
  if (row) return row.forItems;
  return (LEGACY_CATEGORIES as readonly string[]).includes(slug);
}

export async function isDocumentCategorySlug(slug: string): Promise<boolean> {
  const row = await getCategoryBySlug(slug);
  if (row) return row.forDocuments;
  return slug === "general" || (LEGACY_CATEGORIES as readonly string[]).includes(slug);
}

export type CreateCategoryInput = {
  slug: string;
  label: string;
  plural: string;
  shortLabel: string;
  icon?: string;
  color?: string;
  sortOrder?: number;
  forItems?: boolean;
  forDocuments?: boolean;
  pageBehavior?: PageBehavior;
  pageBehaviorConfig?: PageBehaviorConfig;
};

export type UpdateCategoryInput = Partial<
  Omit<CreateCategoryInput, "slug">
>;

export async function createCategory(
  input: CreateCategoryInput,
): Promise<AppCategoryRow> {
  const slugError = validateCategorySlug(input.slug);
  if (slugError) throw new Error(slugError);
  if (!input.label.trim()) throw new Error("Label is required");
  if (!input.plural.trim()) throw new Error("Plural is required");
  if (!input.shortLabel.trim()) throw new Error("Short label is required");
  if (!input.forItems && !input.forDocuments) {
    throw new Error("Category must be used for items and/or documents");
  }

  await ensureAppCategoriesSchema();

  const existing = await getCategoryBySlug(input.slug.trim().toLowerCase());
  if (existing) throw new Error("A category with this slug already exists");

  const values = {
    slug: input.slug.trim().toLowerCase(),
    label: input.label.trim(),
    plural: input.plural.trim(),
    shortLabel: input.shortLabel.trim(),
    icon: input.icon?.trim() || "layout-grid",
    color: input.color?.trim() || "stone",
    sortOrder: input.sortOrder ?? 100,
    forItems: Boolean(input.forItems),
    forDocuments: Boolean(input.forDocuments),
    pageBehavior: input.pageBehavior ?? "list",
    pageBehaviorConfig: input.pageBehaviorConfig ?? {},
  };

  const [row] = await db.insert(appCategories).values(values).returning();
  return row;
}

export async function updateCategory(
  slug: string,
  input: UpdateCategoryInput,
): Promise<AppCategoryRow> {
  await ensureAppCategoriesSchema();
  const existing = await getCategoryBySlug(slug);
  if (!existing) throw new Error("Category not found");

  const nextForItems = input.forItems ?? existing.forItems;
  const nextForDocuments = input.forDocuments ?? existing.forDocuments;
  if (!nextForItems && !nextForDocuments) {
    throw new Error("Category must be used for items and/or documents");
  }

  const patch: Partial<typeof appCategories.$inferInsert> = {};
  if (input.label !== undefined) patch.label = input.label.trim();
  if (input.plural !== undefined) patch.plural = input.plural.trim();
  if (input.shortLabel !== undefined) patch.shortLabel = input.shortLabel.trim();
  if (input.icon !== undefined) patch.icon = input.icon.trim() || "layout-grid";
  if (input.color !== undefined) patch.color = input.color.trim() || "stone";
  if (input.sortOrder !== undefined) patch.sortOrder = input.sortOrder;
  if (input.forItems !== undefined) patch.forItems = input.forItems;
  if (input.forDocuments !== undefined) patch.forDocuments = input.forDocuments;
  if (input.pageBehavior !== undefined) patch.pageBehavior = input.pageBehavior;
  if (input.pageBehaviorConfig !== undefined) {
    patch.pageBehaviorConfig = input.pageBehaviorConfig;
  }

  const [row] = await db
    .update(appCategories)
    .set(patch)
    .where(eq(appCategories.slug, slug))
    .returning();

  if (!row) throw new Error("Category not found");
  return row;
}

async function reassignUserCategoryPermissions(
  fromSlug: string,
  toSlug: string,
): Promise<void> {
  const allUsers = await db
    .select({ id: users.id, permissions: users.permissions })
    .from(users);

  for (const user of allUsers) {
    const perms = user.permissions as { viewCategories?: unknown };
    if (!Array.isArray(perms.viewCategories)) continue;

    const updated = perms.viewCategories.map((entry) =>
      entry === fromSlug ? toSlug : entry,
    );
    if (updated.join(",") === perms.viewCategories.join(",")) continue;

    await db
      .update(users)
      .set({
        permissions: {
          ...perms,
          viewCategories: updated,
        },
      })
      .where(eq(users.id, user.id));
  }
}

export async function deleteCategory(
  slug: string,
  reassignTo: string,
): Promise<void> {
  await ensureAppCategoriesSchema();

  const existing = await getCategoryBySlug(slug);
  if (!existing) throw new Error("Category not found");

  const target = await getCategoryBySlug(reassignTo);
  if (!target) throw new Error("Reassign target category not found");
  if (target.slug === slug) throw new Error("Cannot reassign to the same category");

  if (existing.forItems && !target.forItems) {
    throw new Error("Reassign target must support items");
  }
  if (existing.forDocuments && !target.forDocuments) {
    throw new Error("Reassign target must support documents");
  }

  if (existing.forItems) {
    await db
      .update(itineraryItems)
      .set({ category: reassignTo })
      .where(eq(itineraryItems.category, slug));
  }

  if (existing.forDocuments) {
    await db
      .update(itemDocuments)
      .set({ category: reassignTo })
      .where(eq(itemDocuments.category, slug));
  }

  await reassignUserCategoryPermissions(slug, reassignTo);

  await db.delete(appCategories).where(eq(appCategories.slug, slug));
}

export async function getCategoryUsageCounts(): Promise<
  Record<string, { items: number; documents: number }>
> {
  await ensureAppCategoriesSchema();
  const counts: Record<string, { items: number; documents: number }> = {};

  const itemRows = await db
    .select({
      category: itineraryItems.category,
      count: sql<number>`count(*)::int`,
    })
    .from(itineraryItems)
    .groupBy(itineraryItems.category);

  for (const row of itemRows) {
    counts[row.category] = { items: row.count, documents: 0 };
  }

  const docRows = await db
    .select({
      category: itemDocuments.category,
      count: sql<number>`count(*)::int`,
    })
    .from(itemDocuments)
    .groupBy(itemDocuments.category);

  for (const row of docRows) {
    counts[row.category] ??= { items: 0, documents: 0 };
    counts[row.category].documents = row.count;
  }

  return counts;
}
