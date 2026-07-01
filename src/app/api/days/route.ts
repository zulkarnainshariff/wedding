import { asc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireAuth, requireEditAccess, isAuthError } from "@/lib/api-auth";
import { logAuditEvent } from "@/lib/activity-log";
import { isPostgresUniqueViolation } from "@/lib/database-sequences";
import { logOperationError } from "@/lib/error-log";
import { db } from "@/lib/db";
import { itineraryDays } from "@/lib/schema";
import { bumpSyncVersion } from "@/lib/sync";

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

export async function GET() {
  const user = await requireAuth();
  if (isAuthError(user)) return user;

  const days = await db
    .select()
    .from(itineraryDays)
    .orderBy(asc(itineraryDays.date));
  return NextResponse.json(days);
}

export async function POST(request: Request) {
  const user = await requireEditAccess();
  if (isAuthError(user)) return user;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const parsed = parseDayPayload(body);
    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const [day] = await db
      .insert(itineraryDays)
      .values(parsed)
      .returning();

    await bumpSyncVersion();
    await logAuditEvent({
      user,
      action: "create",
      resourceType: "day",
      resourceId: day.id,
      summary: `Created day ${day.dayNumber} (${day.date})`,
    });
    return NextResponse.json(day, { status: 201 });
  } catch (error) {
    console.error("POST /api/days failed:", error);
    await logOperationError({
      operation: "create",
      resourceType: "day",
      summary: "Failed to create itinerary day",
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
