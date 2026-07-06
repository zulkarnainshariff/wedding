import { CATEGORY_META, CATEGORIES, type Category } from "@/lib/types";

export const STANDALONE_DOCUMENT_CATEGORY = "general" as const;

export type DocumentCategory = Category | typeof STANDALONE_DOCUMENT_CATEGORY;

export const DOCUMENT_CATEGORIES: DocumentCategory[] = [
  STANDALONE_DOCUMENT_CATEGORY,
  ...CATEGORIES,
];

export function isDocumentCategory(value: string): value is DocumentCategory {
  return DOCUMENT_CATEGORIES.includes(value as DocumentCategory);
}

export function documentCategoryLabel(category: string): string {
  if (category === STANDALONE_DOCUMENT_CATEGORY) return "General";
  if (CATEGORIES.includes(category as Category)) {
    return CATEGORY_META[category as Category].label;
  }
  return category;
}

export function defaultDocumentCategoryForItem(
  itemCategory: string | null | undefined,
): DocumentCategory {
  if (itemCategory && isDocumentCategory(itemCategory)) {
    return itemCategory;
  }
  return STANDALONE_DOCUMENT_CATEGORY;
}
