import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { itineraryItems } from "@/lib/schema";
import { isCategory } from "@/lib/types";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");

  if (category && isCategory(category)) {
    const items = await db
      .select()
      .from(itineraryItems)
      .where(eq(itineraryItems.category, category))
      .orderBy(asc(itineraryItems.startDatetime), asc(itineraryItems.sortOrder));
    return NextResponse.json(items);
  }

  const items = await db
    .select()
    .from(itineraryItems)
    .orderBy(asc(itineraryItems.startDatetime), asc(itineraryItems.sortOrder));
  return NextResponse.json(items);
}

export async function POST(request: Request) {
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
      startDatetime: body.startDatetime ? new Date(body.startDatetime) : null,
      endDatetime: body.endDatetime ? new Date(body.endDatetime) : null,
      sortOrder: body.sortOrder ?? 0,
      details: body.details ?? {},
    })
    .returning();

  return NextResponse.json(item, { status: 201 });
}
