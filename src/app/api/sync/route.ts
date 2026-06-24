import { asc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { filterItemsByPermission } from "@/lib/permissions";
import { itineraryDays, itineraryItems } from "@/lib/schema";
import { getCurrentUpdateId } from "@/lib/sync";

export async function GET(request: Request) {
  const user = await requireAuth();
  if (isAuthError(user)) return user;

  const { searchParams } = new URL(request.url);
  const clientUpdateId = searchParams.get("updateId");
  const updateId = await getCurrentUpdateId();

  if (clientUpdateId && clientUpdateId === updateId) {
    return new NextResponse(null, { status: 304 });
  }

  const days = await db
    .select()
    .from(itineraryDays)
    .orderBy(asc(itineraryDays.dayNumber));

  const items = await db
    .select()
    .from(itineraryItems)
    .orderBy(asc(itineraryItems.startDatetime), asc(itineraryItems.sortOrder));

  const filteredItems = filterItemsByPermission(items, user);

  return NextResponse.json({
    updateId,
    days,
    items: filteredItems,
  });
}
