import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { isAuthError, requireAuth } from "@/lib/api-auth";
import { autoCompleteLandedFlightItem } from "@/lib/flight-auto-complete";
import { isFlightLanded } from "@/lib/flight-progress";
import { getItemCompletion } from "@/lib/item-completion";
import { filterItemsByPermission } from "@/lib/permissions";
import { db } from "@/lib/db";
import { itineraryItems } from "@/lib/schema";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  const user = await requireAuth();
  if (isAuthError(user)) return user;

  const { id } = await params;
  const itemId = Number(id);

  const [item] = await db
    .select()
    .from(itineraryItems)
    .where(eq(itineraryItems.id, itemId))
    .limit(1);

  if (!item) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  const [authorized] = filterItemsByPermission([item], user);
  if (!authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (item.category !== "flight") {
    return NextResponse.json({ error: "Not a flight item" }, { status: 400 });
  }

  if (!isFlightLanded(item)) {
    return NextResponse.json({
      completed: getItemCompletion(item.details) != null,
      item,
      autoCompleted: false,
    });
  }

  const updated = await autoCompleteLandedFlightItem(item);
  const nextItem = updated ?? item;

  return NextResponse.json({
    completed: getItemCompletion(nextItem.details) != null,
    item: nextItem,
    autoCompleted: Boolean(updated),
  });
}
