import { inArray, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  defaultDocumentCategoryForItem,
  type DocumentCategory,
} from "@/lib/document-categories";
import { getDocumentCategories, getItemCategories } from "@/lib/app-categories";
import { filterVisibleDocuments, canViewStandaloneDocument } from "@/lib/item-documents";
import { isSharedDocument, parseCoveredTravellers, parseExtraViewers } from "@/lib/item-document-utils";
import { filterItemsByPermission } from "@/lib/permissions";
import type { SessionUser } from "@/lib/permissions";
import { itemDocuments, itineraryItems } from "@/lib/schema";
import type { Category } from "@/lib/types";

export type DocumentListEntry = {
  id: number;
  label: string;
  fileName: string;
  mimeType: string | null;
  createdAt: string;
  coversTravellers: string[];
  extraViewers: string[];
  category: DocumentCategory;
  isShared: boolean;
  itemId: number | null;
  itemTitle: string | null;
  itemCategory: Category | null;
  itemStartDatetime: string | null;
};

export type DocumentViewMode = "item_type" | "document_category" | "user";

function toListEntry(
  doc: (typeof itemDocuments.$inferSelect),
  item: (typeof itineraryItems.$inferSelect) | null,
  documentCategoryRows: Awaited<ReturnType<typeof getDocumentCategories>>,
  itemCategorySlugs: Set<string>,
): DocumentListEntry {
  return {
    id: doc.id,
    label: doc.label,
    fileName: doc.fileName,
    mimeType: doc.mimeType,
    createdAt: doc.createdAt.toISOString(),
    coversTravellers: parseCoveredTravellers(doc),
    extraViewers: parseExtraViewers(doc.extraViewers),
    category: defaultDocumentCategoryForItem(doc.category, documentCategoryRows),
    isShared: isSharedDocument(doc),
    itemId: item?.id ?? null,
    itemTitle: item?.title ?? null,
    itemCategory:
      item && itemCategorySlugs.has(item.category)
        ? (item.category as Category)
        : null,
    itemStartDatetime: item?.startDatetime
      ? item.startDatetime.toISOString()
      : null,
  };
}

async function loadVisibleDocumentRows(user: SessionUser) {
  const [documentCategoryRows, itemCategoryRows] = await Promise.all([
    getDocumentCategories(),
    getItemCategories(),
  ]);
  const itemCategorySlugs = new Set(itemCategoryRows.map((row) => row.slug));
  const docs = await db.select().from(itemDocuments);
  if (docs.length === 0) {
    return [] as DocumentListEntry[];
  }

  const linkedItemIds = [
    ...new Set(
      docs
        .map((doc) => doc.itemId)
        .filter((itemId): itemId is number => itemId != null),
    ),
  ];

  const items =
    linkedItemIds.length > 0
      ? await db
          .select()
          .from(itineraryItems)
          .where(inArray(itineraryItems.id, linkedItemIds))
      : [];

  const authorizedItems = filterItemsByPermission(items, user);
  const authorizedItemIds = new Set(authorizedItems.map((item) => item.id));
  const itemById = new Map(authorizedItems.map((item) => [item.id, item]));

  const entries: DocumentListEntry[] = [];

  for (const doc of docs) {
    if (doc.itemId == null) {
      if (canViewStandaloneDocument(doc, user)) {
        entries.push(toListEntry(doc, null, documentCategoryRows, itemCategorySlugs));
      }
      continue;
    }

    const item = itemById.get(doc.itemId);
    if (!item || !authorizedItemIds.has(doc.itemId)) continue;

    const visible = filterVisibleDocuments([doc], item, user);
    if (visible.length > 0) {
      entries.push(toListEntry(doc, item, documentCategoryRows, itemCategorySlugs));
    }
  }

  entries.sort((a, b) => {
    const timeDiff =
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    if (timeDiff !== 0) return timeDiff;
    return a.label.localeCompare(b.label);
  });

  return entries;
}

export async function getDocumentIndicators(user: SessionUser) {
  const docs = await db.select().from(itemDocuments);
  const counts: Record<number, number> = {};

  const linkedItemIds = [
    ...new Set(
      docs
        .map((doc) => doc.itemId)
        .filter((itemId): itemId is number => itemId != null),
    ),
  ];

  const items =
    linkedItemIds.length > 0
      ? await db
          .select()
          .from(itineraryItems)
          .where(inArray(itineraryItems.id, linkedItemIds))
      : [];

  const authorizedItems = filterItemsByPermission(items, user);
  const docsByItem = new Map<number, typeof docs>();

  for (const doc of docs) {
    if (doc.itemId == null) continue;
    const list = docsByItem.get(doc.itemId) ?? [];
    list.push(doc);
    docsByItem.set(doc.itemId, list);
  }

  for (const item of authorizedItems) {
    const itemDocs = docsByItem.get(item.id) ?? [];
    const visible = filterVisibleDocuments(itemDocs, item, user);
    if (visible.length > 0) {
      counts[item.id] = visible.length;
    }
  }

  return { counts };
}

export async function getAllVisibleDocuments(
  user: SessionUser,
): Promise<DocumentListEntry[]> {
  return loadVisibleDocumentRows(user);
}

export async function countStandaloneDocuments(): Promise<number> {
  const rows = await db
    .select({ id: itemDocuments.id })
    .from(itemDocuments)
    .where(isNull(itemDocuments.itemId));
  return rows.length;
}
