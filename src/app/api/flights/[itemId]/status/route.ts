import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { isAuthError, requireAuth } from "@/lib/api-auth";
import { db } from "@/lib/db";
import {
  buildFlightScheduleItemPatch,
  lookupFlightSchedule,
} from "@/lib/flight-schedule-lookup";
import { resolveOperatingFlightNumber } from "@/lib/flight-numbers";
import {
  getFlightLiveStatus,
  getStoredTrackingState,
  mergeLiveGateUpdates,
  withTrackingState,
} from "@/lib/flight-tracking";
import { resolveTrackingLegEndpoints, syncMultiSegmentRouteFields } from "@/lib/flight-segment-timing";
import { autoCompleteLandedFlightItem } from "@/lib/flight-auto-complete";
import { isFlightLanded } from "@/lib/flight-progress";
import {
  isFlightCalendarDay,
  parseEffectiveDate,
  shouldShowSavedFlightGateInfo,
} from "@/lib/flight-live-eligibility";
import { getItemCalendarDate } from "@/lib/item-scheduling";
import { filterItemsByPermission } from "@/lib/permissions";
import { itineraryItems } from "@/lib/schema";
import { getFlightDetails } from "@/lib/types";
import { bumpSyncVersion } from "@/lib/sync";

type Params = { params: Promise<{ itemId: string }> };

export async function GET(request: Request, { params }: Params) {
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

  const asOfParam = new URL(request.url).searchParams.get("asOf");
  const effectiveDate = parseEffectiveDate(asOfParam) ?? new Date();
  const onFlightDay = isFlightCalendarDay(item, effectiveDate);

  if (!onFlightDay) {
    if (shouldShowSavedFlightGateInfo(item, effectiveDate)) {
      return NextResponse.json({
        available: true,
        computedOnly: true,
        cached: true,
        marketingFlightNumber: flightDetails.marketingFlightNumber ?? null,
        operatingFlightNumber: flightDetails.operatingFlightNumber ?? null,
        departure: {
          terminal: flightDetails.departureTerminal ?? null,
          gate: flightDetails.departureGate ?? null,
        },
        arrival: {
          terminal: flightDetails.arrivalTerminal ?? null,
          gate: flightDetails.arrivalGate ?? null,
        },
        message:
          "Early morning flight — showing saved gate details from the itinerary.",
      });
    }

    return NextResponse.json({
      available: false,
      reason: "not_travel_day",
      message: "Live updates appear on the day of travel.",
    });
  }

  const operatingFlightNumber = resolveOperatingFlightNumber(flightDetails);
  const flightDate = getItemCalendarDate(item);
  const activeLeg = resolveTrackingLegEndpoints(item);
  const scheduleLookup =
    operatingFlightNumber && flightDate
      ? await lookupFlightSchedule({
          operatingFlightNumber,
          flightDate,
          depIata: activeLeg?.depIata ?? flightDetails.fromIata,
          arrIata: activeLeg?.arrIata ?? flightDetails.toIata,
        })
      : null;
  const schedulePatch = scheduleLookup
    ? buildFlightScheduleItemPatch(item, scheduleLookup)
    : null;

  const lookupDetails = schedulePatch?.details ?? flightDetails;

  const { status: live, trackingState, details: trackedDetails } =
    await getFlightLiveStatus(item, lookupDetails);

  let mergedDetails = syncMultiSegmentRouteFields(
    withTrackingState(trackedDetails, trackingState),
  );
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

  const scheduleChanged = Boolean(
    schedulePatch &&
      (schedulePatch.startDatetime !==
        (item.startDatetime
          ? new Date(item.startDatetime).toISOString()
          : null) ||
        schedulePatch.endDatetime !==
          (item.endDatetime ? new Date(item.endDatetime).toISOString() : null) ||
        schedulePatch.eventDate !== (item.eventDate ?? null) ||
        JSON.stringify(schedulePatch.details) !== JSON.stringify(flightDetails)),
  );

  if (detailsUpdated || trackingChanged || scheduleChanged) {
    await db
      .update(itineraryItems)
      .set({
        details: mergedDetails,
        ...(schedulePatch
          ? {
              eventDate: schedulePatch.eventDate,
              startDatetime: schedulePatch.startDatetime
                ? new Date(schedulePatch.startDatetime)
                : null,
              endDatetime: schedulePatch.endDatetime
                ? new Date(schedulePatch.endDatetime)
                : null,
            }
          : {}),
      })
      .where(eq(itineraryItems.id, itemId));
    await bumpSyncVersion();
  }

  let currentItem = item;
  if (
    isFlightLanded({
      ...item,
      details: mergedDetails,
    })
  ) {
    const autoCompleted = await autoCompleteLandedFlightItem({
      ...item,
      details: mergedDetails,
    });
    if (autoCompleted) {
      currentItem = autoCompleted;
      mergedDetails = (autoCompleted.details ?? {}) as typeof mergedDetails;
    }
  }

  return NextResponse.json({
    ...live,
    scheduleLookup,
    detailsUpdated: detailsUpdated || trackingChanged || scheduleChanged,
    details: mergedDetails,
    item: currentItem,
  });
}
