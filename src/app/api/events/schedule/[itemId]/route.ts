import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { isAuthError, requireEditAccess } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { publicScheduleItems } from "@/lib/schema";

type Params = { params: Promise<{ itemId: string }> };

export async function PUT(request: Request, { params }: Params) {
  const user = await requireEditAccess();
  if (isAuthError(user)) return user;

  const { itemId } = await params;
  const id = Number(itemId);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Invalid item id" }, { status: 400 });
  }

  const body = await request.json();
  const [updated] = await db
    .update(publicScheduleItems)
    .set({
      timeLabel: body.timeLabel,
      title: body.title,
      description: body.description ?? null,
      sortOrder: body.sortOrder ?? 0,
      published: body.published ?? true,
    })
    .where(eq(publicScheduleItems.id, id))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  return NextResponse.json(updated);
}

export async function DELETE(_request: Request, { params }: Params) {
  const user = await requireEditAccess();
  if (isAuthError(user)) return user;

  const { itemId } = await params;
  const id = Number(itemId);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Invalid item id" }, { status: 400 });
  }

  await db.delete(publicScheduleItems).where(eq(publicScheduleItems.id, id));
  return NextResponse.json({ ok: true });
}
