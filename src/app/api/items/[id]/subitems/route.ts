import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { isAuthError, requireAuth, requireEditAccess } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { getSubItemsForParent } from "@/lib/item-subitems";
import { filterItemsByPermission } from "@/lib/permissions";
import { itineraryItems } from "@/lib/schema";
import { bumpSyncVersion } from "@/lib/sync";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const user = await requireAuth();
  if (isAuthError(user)) return user;

  const { id: rawId } = await params;
  const itemId = Number(rawId);

  const [parent] = await db
    .select()
    .from(itineraryItems)
    .where(eq(itineraryItems.id, itemId))
    .limit(1);

  if (!parent) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [authorized] = filterItemsByPermission([parent], user);
  if (!authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(await getSubItemsForParent(itemId, user));
}

export async function POST(request: Request, { params }: Params) {
  const user = await requireEditAccess();
  if (isAuthError(user)) return user;

  const { id: rawId } = await params;
  const parentId = Number(rawId);
  const body = await request.json();

  if (!body.title?.trim()) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  const [parent] = await db
    .select()
    .from(itineraryItems)
    .where(eq(itineraryItems.id, parentId))
    .limit(1);

  if (!parent) {
    return NextResponse.json({ error: "Parent not found" }, { status: 404 });
  }

  const [authorized] = filterItemsByPermission([parent], user);
  if (!authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const timeLabel =
    typeof body.timeLabel === "string" ? body.timeLabel.trim() : "";
  const details: Record<string, unknown> = {
    activityType: "sub_item",
    time: timeLabel || null,
    description: body.summary?.trim() || undefined,
  };

  const siblings = await db
    .select({ sortOrder: itineraryItems.sortOrder })
    .from(itineraryItems)
    .where(eq(itineraryItems.parentItemId, parentId))
    .orderBy(asc(itineraryItems.sortOrder));

  const nextSort =
    siblings.length > 0 ? siblings[siblings.length - 1].sortOrder + 1 : 0;

  const [item] = await db
    .insert(itineraryItems)
    .values({
      parentItemId: parentId,
      dayId: parent.dayId,
      eventDate: parent.eventDate,
      category: "activity",
      title: body.title.trim(),
      summary: body.summary?.trim() || null,
      startDatetime: body.startDatetime ? new Date(body.startDatetime) : null,
      sortOrder: body.sortOrder ?? nextSort,
      details,
    })
    .returning();

  await bumpSyncVersion();
  return NextResponse.json(item, { status: 201 });
}
