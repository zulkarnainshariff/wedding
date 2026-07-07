import type { AppCategoryRow } from "@/lib/schema";
import { CATEGORY_META, LEGACY_CATEGORIES } from "@/lib/types";

export const STANDALONE_DOCUMENT_CATEGORY = "general" as const;

export type DocumentCategory = string;

export function documentCategoriesFromRows(
  categories: AppCategoryRow[],
): AppCategoryRow[] {
  return categories.filter((entry) => entry.forDocuments);
}

export function isDocumentCategory(
  value: string,
  categories?: AppCategoryRow[],
): boolean {
  if (categories) {
    return categories.some(
      (entry) => entry.forDocuments && entry.slug === value,
    );
  }
  return (
    value === STANDALONE_DOCUMENT_CATEGORY ||
    (LEGACY_CATEGORIES as readonly string[]).includes(value)
  );
}

export function documentCategoryLabel(
  category: string,
  categories?: AppCategoryRow[],
): string {
  const match = categories?.find((entry) => entry.slug === category);
  if (match) return match.label;
  if (category === STANDALONE_DOCUMENT_CATEGORY) return "General";
  const legacy = CATEGORY_META[category as keyof typeof CATEGORY_META];
  if (legacy) return legacy.label;
  return category.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function defaultDocumentCategoryForItem(
  itemCategory: string | null | undefined,
  categories?: AppCategoryRow[],
): DocumentCategory {
  if (itemCategory && isDocumentCategory(itemCategory, categories)) {
    return itemCategory;
  }
  return STANDALONE_DOCUMENT_CATEGORY;
}

/** Resolve a stored or submitted category slug using DB-backed document categories. */
export function resolveDocumentCategorySlug(
  raw: string | null | undefined,
  categories: AppCategoryRow[],
): DocumentCategory {
  const trimmed = typeof raw === "string" ? raw.trim() : "";
  if (!trimmed) {
    return STANDALONE_DOCUMENT_CATEGORY;
  }
  if (isDocumentCategory(trimmed, categories)) {
    return trimmed;
  }
  return defaultDocumentCategoryForItem(trimmed, categories);
}
