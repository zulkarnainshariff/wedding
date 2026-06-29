import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { logAuditEvent } from "@/lib/activity-log";
import { requireEditAccess, isAuthError } from "@/lib/api-auth";
import { db } from "@/lib/db";
import {
  buildCheckInStatusFromPassengers,
  buildSeatMapFromPassengers,
  getFlightPassengers,
  isFlightFullyCheckedIn,
} from "@/lib/flight-check-in";
import { itineraryItems } from "@/lib/schema";
import { bumpSyncVersion } from "@/lib/sync";
import { getFlightDetails } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const user = await requireEditAccess();
  if (isAuthError(user)) return user;

  const { id } = await params;
  const itemId = Number(id);
  const body = (await request.json()) as {
    checkedIn?: boolean;
    seats?: Record<string, string>;
  };

  const [existing] = await db
    .select()
    .from(itineraryItems)
    .where(eq(itineraryItems.id, itemId))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  if (existing.category !== "flight") {
    return NextResponse.json({ error: "Not a flight item" }, { status: 400 });
  }

  const flightDetails = getFlightDetails(existing.details);
  if (!flightDetails) {
    return NextResponse.json({ error: "Invalid flight details" }, { status: 400 });
  }

  const passengers = getFlightPassengers(flightDetails);
  if (passengers.length === 0) {
    return NextResponse.json(
      { error: "Add passengers to this flight before recording check-in." },
      { status: 400 },
    );
  }

  const details = (existing.details ?? {}) as Record<string, unknown>;
  const shouldCheckIn = body.checkedIn !== false;
  const seatDraft =
    body.seats && typeof body.seats === "object" ? body.seats : {};

  const nextDetails = {
    ...details,
    seats: shouldCheckIn
      ? buildSeatMapFromPassengers(flightDetails, seatDraft)
      : flightDetails.seats,
    checkInStatus: buildCheckInStatusFromPassengers(
      passengers,
      shouldCheckIn,
    ),
  };

  const [item] = await db
    .update(itineraryItems)
    .set({ details: nextDetails })
    .where(eq(itineraryItems.id, itemId))
    .returning();

  await bumpSyncVersion();
  await logAuditEvent({
    user,
    action: "update",
    resourceType: "item",
    resourceId: item.id,
    summary: shouldCheckIn
      ? `Recorded check-in reference for "${item.title}"`
      : `Cleared check-in reference for "${item.title}"`,
  });

  const updatedDetails = getFlightDetails(item.details);

  return NextResponse.json({
    item,
    checkedIn: isFlightFullyCheckedIn(updatedDetails),
  });
}
