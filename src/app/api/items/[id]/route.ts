import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { itineraryItems } from "@/lib/schema";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const [item] = await db
    .select()
    .from(itineraryItems)
    .where(eq(itineraryItems.id, Number(id)))
    .limit(1);

  if (!item) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }
  return NextResponse.json(item);
}

export async function PUT(request: Request, { params }: Params) {
  const { id } = await params;
  const body = await request.json();

  const [item] = await db
    .update(itineraryItems)
    .set({
      dayId: body.dayId ?? null,
      category: body.category,
      title: body.title,
      summary: body.summary ?? null,
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
  return NextResponse.json(item);
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  const [item] = await db
    .delete(itineraryItems)
    .where(eq(itineraryItems.id, Number(id)))
    .returning();

  if (!item) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
