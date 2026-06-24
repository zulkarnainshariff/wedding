import { NextResponse } from "next/server";
import { isAuthError, requireEditAccess } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { publicScheduleItems } from "@/lib/schema";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const user = await requireEditAccess();
  if (isAuthError(user)) return user;

  const { id } = await params;
  const eventId = Number(id);
  if (!Number.isFinite(eventId)) {
    return NextResponse.json({ error: "Invalid event id" }, { status: 400 });
  }

  const body = await request.json();
  const [created] = await db
    .insert(publicScheduleItems)
    .values({
      eventId,
      timeLabel: body.timeLabel,
      title: body.title,
      description: body.description ?? null,
      sortOrder: body.sortOrder ?? 0,
      published: body.published ?? true,
    })
    .returning();

  return NextResponse.json(created, { status: 201 });
}
