import { and, gte, lte } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireEditAccess, isAuthError } from "@/lib/api-auth";
import { logAuditEvent } from "@/lib/activity-log";
import { logOperationError } from "@/lib/error-log";
import { db } from "@/lib/db";
import { itineraryDays } from "@/lib/schema";
import { bumpSyncVersion } from "@/lib/sync";
import { eachDateInRange } from "@/lib/trip-day-sync";

export async function PATCH(request: Request) {
  const user = await requireEditAccess();
  if (isAuthError(user)) return user;

  try {
    const body = (await request.json()) as {
      startDate?: string;
      endDate?: string;
      hidden?: boolean;
    };

    const startDate = body.startDate?.trim() ?? "";
    const endDate = body.endDate?.trim() ?? "";
    const hidden = Boolean(body.hidden);

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "Start date and end date are required." },
        { status: 400 },
      );
    }

    const dates = eachDateInRange(startDate, endDate);
    if (dates.length === 0) {
      return NextResponse.json(
        { error: "End date must be on or after start date." },
        { status: 400 },
      );
    }

    const updated = await db
      .update(itineraryDays)
      .set({ hidden })
      .where(
        and(
          gte(itineraryDays.date, startDate),
          lte(itineraryDays.date, endDate),
        ),
      )
      .returning({ id: itineraryDays.id });

    await bumpSyncVersion();
    await logAuditEvent({
      user,
      action: "update",
      resourceType: "day",
      summary: `${hidden ? "Hid" : "Unhid"} ${updated.length} day(s) from ${startDate} to ${endDate}`,
      metadata: { startDate, endDate, hidden, count: updated.length },
    });

    return NextResponse.json({
      ok: true,
      updated: updated.length,
      startDate,
      endDate,
      hidden,
    });
  } catch (error) {
    console.error("PATCH /api/days/visibility failed:", error);
    await logOperationError({
      operation: "update",
      resourceType: "day",
      summary: "Failed batch day visibility update",
      error,
      userId: user.id,
      username: user.username,
    });
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update day visibility.",
      },
      { status: 500 },
    );
  }
}
