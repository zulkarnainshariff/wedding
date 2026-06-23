import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { itineraryDays } from "@/lib/schema";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Params) {
  const { id } = await params;
  const body = await request.json();
  const [day] = await db
    .update(itineraryDays)
    .set({
      dayNumber: body.dayNumber,
      date: body.date,
      title: body.title ?? null,
      notes: body.notes ?? null,
    })
    .where(eq(itineraryDays.id, Number(id)))
    .returning();

  if (!day) {
    return NextResponse.json({ error: "Day not found" }, { status: 404 });
  }
  return NextResponse.json(day);
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  const [day] = await db
    .delete(itineraryDays)
    .where(eq(itineraryDays.id, Number(id)))
    .returning();

  if (!day) {
    return NextResponse.json({ error: "Day not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
