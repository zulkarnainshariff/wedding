import { asc, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireAuth, requireEditAccess, isAuthError } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { deleteDocumentFile } from "@/lib/item-documents";
import { applyFlightDatetimeOverrides } from "@/lib/flight-datetime";
import { normalizeItemSchedule } from "@/lib/item-scheduling";
import { filterItemsByPermission } from "@/lib/permissions";
import { itemDocuments, itineraryDays, itineraryItems } from "@/lib/schema";
import { bumpSyncVersion } from "@/lib/sync";

type Params = { params: Promise<{ id: string }> };

async function getDays() {
  return db.select().from(itineraryDays).orderBy(asc(itineraryDays.dayNumber));
}

async function collectDescendantItemIds(itemId: number): Promise<number[]> {
  const children = await db
    .select({ id: itineraryItems.id })
    .from(itineraryItems)
    .where(eq(itineraryItems.parentItemId, itemId));

  const ids = [itemId];
  for (const child of children) {
    ids.push(...(await collectDescendantItemIds(child.id)));
  }
  return ids;
}

export async function GET(_request: Request, { params }: Params) {
  const user = await requireAuth();
  if (isAuthError(user)) return user;

  const { id } = await params;
  const [item] = await db
    .select()
    .from(itineraryItems)
    .where(eq(itineraryItems.id, Number(id)))
    .limit(1);

  if (!item) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  const filtered = filterItemsByPermission([item], user);
  if (filtered.length === 0) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(filtered[0]);
}

export async function PUT(request: Request, { params }: Params) {
  const user = await requireEditAccess();
  if (isAuthError(user)) return user;

  const { id } = await params;
  const body = applyFlightDatetimeOverrides(await request.json());
  const days = await getDays();
  const scheduled = normalizeItemSchedule(
    {
      dayId: body.dayId ?? null,
      eventDate: body.eventDate ?? null,
      startDatetime: body.startDatetime ? new Date(body.startDatetime) : null,
    },
    days,
  );

  const [item] = await db
    .update(itineraryItems)
    .set({
      dayId: scheduled.dayId,
      parentItemId: body.parentItemId ?? null,
      category: body.category,
      title: body.title,
      summary: body.summary ?? null,
      eventDate: scheduled.eventDate,
      startDatetime: body.startDatetime ? new Date(body.startDatetime) : null,
      endDatetime: body.endDatetime ? new Date(body.endDatetime) : null,
      sortOrder: body.sortOrder ?? 0,
      details: body.details ?? {},
    })
    .where(eq(itineraryItems.id, Number(id)))
    .returning();

  if (!item) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  await bumpSyncVersion();
  return NextResponse.json(item);
}

export async function DELETE(_request: Request, { params }: Params) {
  const user = await requireEditAccess();
  if (isAuthError(user)) return user;

  const { id } = await params;
  const itemId = Number(id);

  const treeIds = await collectDescendantItemIds(itemId);
  const docs =
    treeIds.length > 0
      ? await db
          .select()
          .from(itemDocuments)
          .where(inArray(itemDocuments.itemId, treeIds))
      : [];

  const [item] = await db
    .delete(itineraryItems)
    .where(eq(itineraryItems.id, itemId))
    .returning();

  if (!item) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  await Promise.all(docs.map((doc) => deleteDocumentFile(doc.storageKey)));

  await bumpSyncVersion();
  return NextResponse.json({ ok: true });
}
