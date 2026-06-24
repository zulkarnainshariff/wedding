import { NextResponse } from "next/server";
import { asc } from "drizzle-orm";
import { isAuthError, requireEditAccess } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { getScheduleItemsForEventAdmin } from "@/lib/public-queries";
import { weddingEvents } from "@/lib/schema";

export async function GET() {
  const user = await requireEditAccess();
  if (isAuthError(user)) return user;

  const events = await db
    .select()
    .from(weddingEvents)
    .orderBy(asc(weddingEvents.sortOrder), asc(weddingEvents.id));

  const withSchedules = await Promise.all(
    events.map(async (event) => ({
      ...event,
      schedule: await getScheduleItemsForEventAdmin(event.id),
    })),
  );

  return NextResponse.json(withSchedules);
}
