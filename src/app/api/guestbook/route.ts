import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getAppSettings, isGuestbookEnabled } from "@/lib/app-settings";
import {
  listGuestbookEntries,
  listPublishedEventsForGuestbook,
  serializeGuestbookEntry,
} from "@/lib/guestbook-queries";
import { getGuestListAccessForUser } from "@/lib/guest-queries";
import { db } from "@/lib/db";
import { guestbookEntries, weddingEvents } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get("eventId");
  const sessionUser = await getSessionUser();
  let moderatableEventIds: number[] = [];
  let canModerateAny = false;

  if (sessionUser) {
    if (sessionUser.isAdmin) {
      canModerateAny = true;
    } else {
      const guestListAccess = await getGuestListAccessForUser(sessionUser);
      moderatableEventIds = guestListAccess
        .filter((entry) => entry.canModerateGuestbook)
        .map((entry) => entry.eventId);
      canModerateAny = moderatableEventIds.length > 0;
    }
  }

  const requestedEventId = eventId ? Number(eventId) : undefined;
  const includeHidden =
    requestedEventId != null &&
    (canModerateAny &&
      (sessionUser?.isAdmin ||
        moderatableEventIds.includes(requestedEventId)));

  const entries = await listGuestbookEntries(
    requestedEventId,
    {
      includeHidden,
      includeHiddenForEventIds:
        !requestedEventId && canModerateAny ? moderatableEventIds : [],
    },
  );
  const events = await listPublishedEventsForGuestbook();
  return NextResponse.json({
    entries: entries.map(serializeGuestbookEntry),
    events,
    canModerateAny,
    moderatableEventIds,
  });
}

export async function POST(request: Request) {
  const settings = await getAppSettings();
  if (!isGuestbookEnabled(settings)) {
    return NextResponse.json({ error: "Guestbook is not enabled." }, { status: 403 });
  }

  const body = await request.json();
  const eventId = Number(body.eventId);
  const name = String(body.name ?? "").trim();
  const message = String(body.message ?? "").trim();
  const email = body.email ? String(body.email).trim() : null;

  if (!eventId || !name || !message) {
    return NextResponse.json(
      { error: "Event, name, and message are required." },
      { status: 400 },
    );
  }

  const [event] = await db
    .select({ id: weddingEvents.id, name: weddingEvents.name })
    .from(weddingEvents)
    .where(eq(weddingEvents.id, eventId))
    .limit(1);

  if (!event) {
    return NextResponse.json({ error: "Event not found." }, { status: 400 });
  }

  const [created] = await db
    .insert(guestbookEntries)
    .values({ eventId, name, message, email, hidden: false })
    .returning();

  return NextResponse.json(
    serializeGuestbookEntry({
      ...created,
      eventName: event.name,
    }),
    { status: 201 },
  );
}
