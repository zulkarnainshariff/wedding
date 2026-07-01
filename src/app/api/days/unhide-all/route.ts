import { NextResponse } from "next/server";
import { requireEditAccess, isAuthError } from "@/lib/api-auth";
import { logAuditEvent } from "@/lib/activity-log";
import { logOperationError } from "@/lib/error-log";
import { unhideAllItineraryDays } from "@/lib/trip-day-sync";
import { bumpSyncVersion } from "@/lib/sync";

export async function POST() {
  const user = await requireEditAccess();
  if (isAuthError(user)) return user;

  try {
    const result = await unhideAllItineraryDays();
    await bumpSyncVersion();

    await logAuditEvent({
      user,
      action: "update",
      resourceType: "trip_days",
      summary: `Unhid ${result.updated} itinerary day(s)`,
      metadata: result,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("POST /api/days/unhide-all failed:", error);
    await logOperationError({
      operation: "update",
      resourceType: "day",
      summary: "Failed to unhide all itinerary days",
      error,
      userId: user.id,
      username: user.username,
    });
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to unhide days.",
      },
      { status: 500 },
    );
  }
}
