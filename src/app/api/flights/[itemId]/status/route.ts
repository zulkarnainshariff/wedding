import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { isAuthError, requireAuth } from "@/lib/api-auth";
import { db } from "@/lib/db";
import {
  getFlightLiveStatus,
  getStoredTrackingState,
  mergeLiveGateUpdates,
  withTrackingState,
} from "@/lib/flight-tracking";
import { filterItemsByPermission } from "@/lib/permissions";
import { itineraryItems } from "@/lib/schema";
import { getFlightDetails } from "@/lib/types";
import { bumpSyncVersion } from "@/lib/sync";

type Params = { params: Promise<{ itemId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const user = await requireAuth();
  if (isAuthError(user)) return user;

  const { itemId: rawId } = await params;
  const itemId = Number(rawId);

  const [item] = await db
    .select()
    .from(itineraryItems)
    .where(eq(itineraryItems.id, itemId))
    .limit(1);

  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [authorized] = filterItemsByPermission([item], user);
  if (!authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (item.category !== "flight") {
    return NextResponse.json({ error: "Not a flight item" }, { status: 400 });
  }

  const flightDetails = getFlightDetails(item.details);
  if (!flightDetails) {
    return NextResponse.json({ error: "Invalid flight details" }, { status: 400 });
  }

  const { status: live, trackingState, details: trackedDetails } =
    await getFlightLiveStatus(item, flightDetails);

  let mergedDetails = withTrackingState(trackedDetails, trackingState);
  let detailsUpdated = false;

  if (live.available) {
    const { details: withGates, changed } = mergeLiveGateUpdates(
      mergedDetails,
      live,
    );
    mergedDetails = withGates;
    if (changed) detailsUpdated = true;
  }

  const trackingChanged =
    JSON.stringify(getStoredTrackingState(flightDetails)) !==
    JSON.stringify(trackingState);

  if (detailsUpdated || trackingChanged) {
    await db
      .update(itineraryItems)
      .set({ details: mergedDetails })
      .where(eq(itineraryItems.id, itemId));
    await bumpSyncVersion();
  }

  return NextResponse.json({
    ...live,
    detailsUpdated: detailsUpdated || trackingChanged,
    details: mergedDetails,
  });
}
