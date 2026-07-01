import { inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { filterVisibleDocuments } from "@/lib/item-documents";
import { filterItemsByPermission } from "@/lib/permissions";
import type { SessionUser } from "@/lib/permissions";
import { itemDocuments, itineraryItems } from "@/lib/schema";

export async function getDocumentIndicators(user: SessionUser) {
  const docs = await db.select().from(itemDocuments);
  if (docs.length === 0) {
    return { counts: {} as Record<number, number> };
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
