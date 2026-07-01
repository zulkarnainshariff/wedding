import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { filterItemsByPermission } from "@/lib/permissions";
import type { SessionUser } from "@/lib/permissions";
import { itineraryItems } from "@/lib/schema";

export async function getSubItemsForParent(
  parentItemId: number,
  user: SessionUser,
) {
  const items = await db
    .select()
    .from(itineraryItems)
    .where(eq(itineraryItems.parentItemId, parentItemId))
    .orderBy(asc(itineraryItems.sortOrder), asc(itineraryItems.startDatetime));

  return filterItemsByPermission(items, user);
}

export async function getParentItem(parentItemId: number) {
  const [parent] = await db
    .select()
    .from(itineraryItems)
    .where(eq(itineraryItems.id, parentItemId))
    .limit(1);
  return parent ?? null;
}
