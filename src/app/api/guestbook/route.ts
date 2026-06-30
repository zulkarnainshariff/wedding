import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getAppSettings, isGuestbookEnabled } from "@/lib/app-settings";
import {
  getGuestbookEntryById,
  listGuestbookEntries,
  listPublishedEventsForGuestbook,
  serializeGuestbookEntry,
} from "@/lib/guestbook-queries";
import { canModerateGuestbook } from "@/lib/permissions";
import { db } from "@/lib/db";
import { guestbookEntries, weddingEvents } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get("eventId");
  const sessionUser = await getSessionUser();
  const includeHidden = sessionUser ? canModerateGuestbook(sessionUser) : false;

  const entries = await listGuestbookEntries(
    eventId ? Number(eventId) : undefined,
    { includeHidden },
  );
  const events = await listPublishedEventsForGuestbook();
  return NextResponse.json({
    entries: entries.map(serializeGuestbookEntry),
    events,
    canModerate: includeHidden,
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
