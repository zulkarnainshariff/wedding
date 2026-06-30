import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireEditAccess, isAuthError } from "@/lib/api-auth";
import { logAuditEvent } from "@/lib/activity-log";
import { isPostgresUniqueViolation } from "@/lib/database-sequences";
import { logOperationError } from "@/lib/error-log";
import { db } from "@/lib/db";
import { itineraryDays } from "@/lib/schema";
import { bumpSyncVersion } from "@/lib/sync";

type Params = { params: Promise<{ id: string }> };

function parseDayPayload(body: Record<string, unknown>) {
  const dayNumber = Number(body.dayNumber);
  const date = typeof body.date === "string" ? body.date.trim() : "";

  if (!Number.isFinite(dayNumber) || dayNumber < 1) {
    return { error: "Day number is required." as const };
  }
  if (!date) {
    return { error: "Date is required." as const };
  }

  return {
    dayNumber,
    date,
    title: typeof body.title === "string" && body.title.trim() ? body.title.trim() : null,
    notes: typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null,
    hidden: Boolean(body.hidden),
  };
}

export async function PUT(request: Request, { params }: Params) {
  const user = await requireEditAccess();
  if (isAuthError(user)) return user;

  const { id } = await params;
  const dayId = Number(id);

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const parsed = parseDayPayload(body);
    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const [day] = await db
      .update(itineraryDays)
      .set(parsed)
      .where(eq(itineraryDays.id, dayId))
      .returning();

    if (!day) {
      return NextResponse.json({ error: "Day not found" }, { status: 404 });
    }

    await bumpSyncVersion();
    await logAuditEvent({
      user,
      action: "update",
      resourceType: "day",
      resourceId: day.id,
      summary: `Updated day ${day.dayNumber} (${day.date})`,
    });
    return NextResponse.json(day);
  } catch (error) {
    console.error(`PUT /api/days/${id} failed:`, error);
    await logOperationError({
      operation: "update",
      resourceType: "day",
      resourceId: id,
      summary: "Failed to update itinerary day",
      error,
      userId: user.id,
      username: user.username,
    });

    if (isPostgresUniqueViolation(error)) {
      return NextResponse.json(
        { error: "A day with this day number already exists." },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save day." },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const user = await requireEditAccess();
  if (isAuthError(user)) return user;

  const { id } = await params;

  try {
    const [day] = await db
      .delete(itineraryDays)
      .where(eq(itineraryDays.id, Number(id)))
      .returning();

    if (!day) {
      return NextResponse.json({ error: "Day not found" }, { status: 404 });
    }

    await bumpSyncVersion();
    await logAuditEvent({
      user,
      action: "delete",
      resourceType: "day",
      resourceId: day.id,
      summary: `Deleted day ${day.dayNumber} (${day.date})`,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(`DELETE /api/days/${id} failed:`, error);
    await logOperationError({
      operation: "delete",
      resourceType: "day",
      resourceId: id,
      summary: "Failed to delete itinerary day",
      error,
      userId: user.id,
      username: user.username,
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete day." },
      { status: 500 },
    );
  }
}
