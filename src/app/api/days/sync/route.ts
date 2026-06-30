import { NextResponse } from "next/server";
import { requireEditAccess, isAuthError } from "@/lib/api-auth";
import { logAuditEvent } from "@/lib/activity-log";
import { logOperationError } from "@/lib/error-log";
import { updateAppTripRange } from "@/lib/app-settings";
import { syncItineraryDaysForRange } from "@/lib/trip-day-sync";
import { bumpSyncVersion } from "@/lib/sync";

export async function POST(request: Request) {
  const user = await requireEditAccess();
  if (isAuthError(user)) return user;

  try {
    const body = (await request.json()) as {
      startDate?: string;
      endDate?: string;
    };
    const startDate = body.startDate?.trim() ?? "";
    const endDate = body.endDate?.trim() ?? "";

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "Start date and end date are required." },
        { status: 400 },
      );
    }

    const result = await syncItineraryDaysForRange(startDate, endDate);
    await updateAppTripRange(startDate, endDate);
    await bumpSyncVersion();

    await logAuditEvent({
      user,
      action: "update",
      resourceType: "trip_days",
      summary: `Generated itinerary days from ${startDate} to ${endDate}`,
      metadata: result,
    });

    return NextResponse.json({
      ok: true,
      ...result,
      startDate,
      endDate,
    });
  } catch (error) {
    console.error("POST /api/days/sync failed:", error);
    await logOperationError({
      operation: "sync",
      resourceType: "day",
      summary: "Failed to sync itinerary days for trip range",
      error,
      userId: user.id,
      username: user.username,
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate days." },
      { status: 500 },
    );
  }
}
