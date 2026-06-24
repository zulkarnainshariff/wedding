import { asc, eq, isNull, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireAuth, requireEditAccess, isAuthError } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { applyItemDatetimeOverrides } from "@/lib/item-schedule-datetime";
import { normalizeItemSchedule } from "@/lib/item-scheduling";
import { filterItemsByPermission } from "@/lib/permissions";
import { itineraryDays, itineraryItems } from "@/lib/schema";
import { bumpSyncVersion } from "@/lib/sync";
import { isCategory } from "@/lib/types";

async function getDays() {
  return db.select().from(itineraryDays).orderBy(asc(itineraryDays.dayNumber));
}

export async function GET(request: Request) {
  const user = await requireAuth();
  if (isAuthError(user)) return user;

  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const parentItemId = searchParams.get("parentItemId");
  const topLevelOnly = searchParams.get("topLevel") !== "false";

  const conditions = [];
  if (category && isCategory(category)) {
    conditions.push(eq(itineraryItems.category, category));
  }
  if (parentItemId) {
    conditions.push(eq(itineraryItems.parentItemId, Number(parentItemId)));
  } else if (topLevelOnly) {
    conditions.push(isNull(itineraryItems.parentItemId));
  }

  const items = await db
    .select()
    .from(itineraryItems)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(asc(itineraryItems.startDatetime), asc(itineraryItems.sortOrder));

  return NextResponse.json(filterItemsByPermission(items, user));
}

export async function POST(request: Request) {
  const user = await requireEditAccess();
  if (isAuthError(user)) return user;

  const body = applyItemDatetimeOverrides(await request.json());

  if (!body.category || !body.title) {
    return NextResponse.json(
      { error: "category and title are required" },
      { status: 400 },
    );
  }

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
    .insert(itineraryItems)
    .values({
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
    .returning();

  await bumpSyncVersion();
  return NextResponse.json(item, { status: 201 });
}
