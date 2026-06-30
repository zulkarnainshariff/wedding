import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { logAuditEvent } from "@/lib/activity-log";
import { isAuthError, requireEditAccess } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { weddingEvents } from "@/lib/schema";

type Params = { params: Promise<{ id: string }> };

function requireFullAdmin(
  user: Awaited<ReturnType<typeof requireEditAccess>>,
): NextResponse | null {
  if (user instanceof NextResponse) return user;
  if (!user.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

export async function PUT(request: Request, { params }: Params) {
  const user = await requireEditAccess();
  if (isAuthError(user)) return user;

  const { id } = await params;
  const eventId = Number(id);
  if (!Number.isFinite(eventId)) {
    return NextResponse.json({ error: "Invalid event id" }, { status: 400 });
  }

  const body = await request.json();
  const [updated] = await db
    .update(weddingEvents)
    .set({
      name: body.name,
      slug: body.slug,
      eventDate: body.eventDate,
      location: body.location ?? null,
      cardFront: body.cardFront ?? {},
      sortOrder: body.sortOrder ?? 0,
      published: body.published ?? true,
    })
    .where(eq(weddingEvents.id, eventId))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  return NextResponse.json(updated);
}

export async function DELETE(_request: Request, { params }: Params) {
  const user = await requireEditAccess();
  if (isAuthError(user)) return user;
  const forbidden = requireFullAdmin(user);
  if (forbidden) return forbidden;

  const { id } = await params;
  const eventId = Number(id);
  if (!Number.isFinite(eventId)) {
    return NextResponse.json({ error: "Invalid event id" }, { status: 400 });
  }

  const [existing] = await db
    .select()
    .from(weddingEvents)
    .where(eq(weddingEvents.id, eventId))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  await db.delete(weddingEvents).where(eq(weddingEvents.id, eventId));

  await logAuditEvent({
    user,
    action: "delete",
    resourceType: "wedding_event",
    resourceId: eventId,
    summary: `Deleted invitation event ${existing.name}`,
  });

  return NextResponse.json({ ok: true });
}
