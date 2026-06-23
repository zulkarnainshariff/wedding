import { NextResponse } from "next/server";
import { asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { itineraryDays } from "@/lib/schema";

export async function GET() {
  const days = await db
    .select()
    .from(itineraryDays)
    .orderBy(asc(itineraryDays.dayNumber));
  return NextResponse.json(days);
}

export async function POST(request: Request) {
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
  return NextResponse.json(day, { status: 201 });
}
