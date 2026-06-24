import { asc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireAuth, requireEditAccess, isAuthError } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { itineraryDays } from "@/lib/schema";
import { bumpSyncVersion } from "@/lib/sync";

export async function GET() {
  const user = await requireAuth();
  if (isAuthError(user)) return user;

  const days = await db
    .select()
    .from(itineraryDays)
    .orderBy(asc(itineraryDays.dayNumber));
  return NextResponse.json(days);
}

export async function POST(request: Request) {
  const user = await requireEditAccess();
  if (isAuthError(user)) return user;

  const body = await request.json();
  const [day] = await db
    .insert(itineraryDays)
    .values({
      dayNumber: body.dayNumber,
      date: body.date,
      title: body.title ?? null,
      notes: body.notes ?? null,
    })
    .returning();

  await bumpSyncVersion();
  return NextResponse.json(day, { status: 201 });
}
