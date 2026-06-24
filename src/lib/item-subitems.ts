import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { filterItemsByPermission } from "@/lib/permissions";
import { itineraryItems } from "@/lib/schema";
import type { SessionUser } from "@/lib/permissions";

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
