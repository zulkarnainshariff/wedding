import { inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { filterVisibleDocuments } from "@/lib/item-documents";
import { parseCoveredTravellers } from "@/lib/item-document-utils";
import { filterItemsByPermission } from "@/lib/permissions";
import type { SessionUser } from "@/lib/permissions";
import { itemDocuments, itineraryItems } from "@/lib/schema";
import type { Category } from "@/lib/types";
import { isCategory } from "@/lib/types";

export type DocumentListEntry = {
  id: number;
  label: string;
  fileName: string;
  mimeType: string | null;
  createdAt: string;
  coversTravellers: string[];
  itemId: number;
  itemTitle: string;
  itemCategory: Category;
  itemStartDatetime: string | null;
};

async function loadAuthorizedItemDocs(user: SessionUser) {
  const docs = await db.select().from(itemDocuments);
  if (docs.length === 0) {
    return {
      authorizedItems: [] as (typeof itineraryItems.$inferSelect)[],
      docsByItem: new Map<number, typeof docs>(),
    };
  }

  const itemIds = [...new Set(docs.map((doc) => doc.itemId))];
  const items = await db
    .select()
    .from(itineraryItems)
    .where(inArray(itineraryItems.id, itemIds));

  const authorizedItems = filterItemsByPermission(items, user);
  const docsByItem = new Map<number, typeof docs>();

  for (const doc of docs) {
    const list = docsByItem.get(doc.itemId) ?? [];
    list.push(doc);
    docsByItem.set(doc.itemId, list);
  }

  return { authorizedItems, docsByItem };
}

export async function getDocumentIndicators(user: SessionUser) {
  const { authorizedItems, docsByItem } = await loadAuthorizedItemDocs(user);

  const counts: Record<number, number> = {};
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
  const { authorizedItems, docsByItem } = await loadAuthorizedItemDocs(user);
  const entries: DocumentListEntry[] = [];

  for (const item of authorizedItems) {
    if (!isCategory(item.category)) continue;

    const itemDocs = docsByItem.get(item.id) ?? [];
    const visible = filterVisibleDocuments(itemDocs, item, user);

    for (const doc of visible) {
      entries.push({
        id: doc.id,
        label: doc.label,
        fileName: doc.fileName,
        mimeType: doc.mimeType,
        createdAt: doc.createdAt.toISOString(),
        coversTravellers: parseCoveredTravellers(doc),
        itemId: item.id,
        itemTitle: item.title,
        itemCategory: item.category,
        itemStartDatetime: item.startDatetime
          ? item.startDatetime.toISOString()
          : null,
      });
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
