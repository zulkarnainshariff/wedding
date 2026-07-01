import { NextResponse } from "next/server";
import { requireEditAccess, isAuthError } from "@/lib/api-auth";
import { logAuditEvent } from "@/lib/activity-log";
import { logOperationError } from "@/lib/error-log";
import { renumberItineraryDays } from "@/lib/trip-day-sync";
import { bumpSyncVersion } from "@/lib/sync";

export async function POST() {
  const user = await requireEditAccess();
  if (isAuthError(user)) return user;

  try {
    const result = await renumberItineraryDays();
    await bumpSyncVersion();

    await logAuditEvent({
      user,
      action: "update",
      resourceType: "trip_days",
      summary: `Renumbered ${result.total} itinerary day(s) in date order`,
      metadata: result,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("POST /api/days/renumber failed:", error);
    await logOperationError({
      operation: "update",
      resourceType: "day",
      summary: "Failed to renumber itinerary days",
      error,
      userId: user.id,
      username: user.username,
    });
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to renumber days.",
      },
      { status: 500 },
    );
  }
}
