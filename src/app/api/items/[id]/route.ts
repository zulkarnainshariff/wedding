import { asc, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireAuth, requireEditAccess, isAuthError } from "@/lib/api-auth";
import { logAuditEvent } from "@/lib/activity-log";
import { db } from "@/lib/db";
import { deleteDocumentFile } from "@/lib/item-documents";
import { applyItemDatetimeOverrides } from "@/lib/item-schedule-datetime";
import { enrichFlightTimezoneDetails } from "@/lib/airport-timezone-resolver";
import {
  normalizeFlightDetailsSegments,
  syncMultiSegmentRouteFields,
} from "@/lib/flight-segment-timing";
import { getFlightDetails } from "@/lib/types";
import { normalizeItemSchedule } from "@/lib/item-scheduling";
import {
  filterItemsByPermission,
} from "@/lib/permissions";
import {
  buildSubItemDetails,
  getParentItem,
  getSubItemsForParent,
  isSubItem,
  resolveSubItemStartDatetime,
  subItemToFormState,
  type SubItemFormState,
} from "@/lib/item-subitems";
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
  if (filtered.length > 0) {
    return NextResponse.json(filtered[0]);
  }

  if (item.parentItemId == null) {
    const subitems = await getSubItemsForParent(item.id, user);
    if (subitems.length > 0) {
      return NextResponse.json({ ...item, limitedView: true });
    }
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function PUT(request: Request, { params }: Params) {
  const user = await requireEditAccess();
  if (isAuthError(user)) return user;

  const { id } = await params;
  const itemId = Number(id);

  const [existing] = await db
    .select()
    .from(itineraryItems)
    .where(eq(itineraryItems.id, itemId))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  let body = await request.json();

  if (isSubItem(existing)) {
    const parent = existing.parentItemId
      ? await getParentItem(existing.parentItemId)
      : null;
    if (!parent) {
      return NextResponse.json({ error: "Parent not found" }, { status: 404 });
    }

    const form: SubItemFormState = {
      title: typeof body.title === "string" ? body.title.trim() : existing.title,
      time:
        typeof body.time === "string"
          ? body.time.trim()
          : subItemToFormState(existing).time,
      locationName:
        typeof body.locationName === "string" ? body.locationName.trim() : "",
      locationMapUrl:
        typeof body.locationMapUrl === "string" ? body.locationMapUrl.trim() : "",
      summary:
        typeof body.summary === "string"
          ? body.summary.trim()
          : subItemToFormState(existing).summary,
      participants: Array.isArray(body.participants)
        ? body.participants.filter(
            (entry: unknown): entry is string => typeof entry === "string",
          )
        : subItemToFormState(existing).participants,
    };

    if (!form.title) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }

    if (
      !form.locationName &&
      !form.locationMapUrl &&
      body.locationName === undefined
    ) {
      const prior = subItemToFormState(existing);
      form.locationName = prior.locationName;
      form.locationMapUrl = prior.locationMapUrl;
    }

    const details = buildSubItemDetails(
      form,
      existing.details as Record<string, unknown>,
    );
    const startDatetime = resolveSubItemStartDatetime(parent, form.time);

    const [item] = await db
      .update(itineraryItems)
      .set({
        parentItemId: existing.parentItemId,
        dayId: parent.dayId,
        eventDate: parent.eventDate,
        category: "activity",
        title: form.title,
        summary: form.summary || null,
        startDatetime,
        sortOrder: existing.sortOrder,
        details,
      })
      .where(eq(itineraryItems.id, itemId))
      .returning();

    await bumpSyncVersion();
    await logAuditEvent({
      user,
      action: "update",
      resourceType: "item",
      resourceId: item.id,
      summary: `Updated sub-item "${item.title}"`,
    });
    return NextResponse.json(item);
  }

  if (body.category === "flight" && body.details && typeof body.details === "object") {
    const incoming = body.details as Record<string, unknown>;
    let flightDetails = await enrichFlightTimezoneDetails(body.details);
    flightDetails = syncMultiSegmentRouteFields(
      normalizeFlightDetailsSegments(getFlightDetails(flightDetails) ?? flightDetails),
    );
    body = {
      ...body,
      details: {
        ...flightDetails,
        isPrivate: Boolean(incoming.isPrivate),
        privateViewers: Array.isArray(incoming.privateViewers)
          ? incoming.privateViewers
          : Array.isArray(incoming.extraViewers)
            ? incoming.extraViewers
            : [],
        extraViewers: undefined,
      },
    };
  }
  body = applyItemDatetimeOverrides(body);
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
      parentItemId:
        body.parentItemId !== undefined
          ? body.parentItemId
          : existing.parentItemId,
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
  await logAuditEvent({
    user,
    action: "update",
    resourceType: "item",
    resourceId: item.id,
    summary: `Updated ${item.category} item "${item.title}"`,
  });
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
  await logAuditEvent({
    user,
    action: "delete",
    resourceType: "item",
    resourceId: item.id,
    summary: `Deleted ${item.category} item "${item.title}"`,
  });
  return NextResponse.json({ ok: true });
}
