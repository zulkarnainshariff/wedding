import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireAuth, requireEditAccess, isAuthError } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { filterItemsByPermission } from "@/lib/permissions";
import { itineraryItems } from "@/lib/schema";
import { bumpSyncVersion } from "@/lib/sync";
import { isCategory } from "@/lib/types";

export async function GET(request: Request) {
  const user = await requireAuth();
  if (isAuthError(user)) return user;

  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");

  let items;
  if (category && isCategory(category)) {
    items = await db
      .select()
      .from(itineraryItems)
      .where(eq(itineraryItems.category, category))
      .orderBy(asc(itineraryItems.startDatetime), asc(itineraryItems.sortOrder));
  } else {
    items = await db
      .select()
      .from(itineraryItems)
      .orderBy(asc(itineraryItems.startDatetime), asc(itineraryItems.sortOrder));
  }

  return NextResponse.json(filterItemsByPermission(items, user));
}

export async function POST(request: Request) {
  const user = await requireEditAccess();
  if (isAuthError(user)) return user;

  const body = await request.json();

  if (!body.category || !body.title) {
    return NextResponse.json(
      { error: "category and title are required" },
      { status: 400 },
    );
  }

  const [item] = await db
    .insert(itineraryItems)
    .values({
      dayId: body.dayId ?? null,
      category: body.category,
      title: body.title,
      summary: body.summary ?? null,
      eventDate: body.eventDate ?? null,
      startDatetime: body.startDatetime ? new Date(body.startDatetime) : null,
      endDatetime: body.endDatetime ? new Date(body.endDatetime) : null,
      sortOrder: body.sortOrder ?? 0,
      details: body.details ?? {},
    })
    .returning();

  await bumpSyncVersion();
  return NextResponse.json(item, { status: 201 });
}
