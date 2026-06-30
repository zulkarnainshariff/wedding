import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { guestbookEntries, weddingEvents } from "@/lib/schema";

export type GuestbookEntryRow = {
  id: number;
  eventId: number;
  eventName: string;
  name: string;
  message: string;
  email: string | null;
  hidden: boolean;
  createdAt: Date;
};

export async function listGuestbookEntries(
  eventId?: number,
  options?: { includeHidden?: boolean },
): Promise<GuestbookEntryRow[]> {
  const conditions = [];
  if (eventId) conditions.push(eq(guestbookEntries.eventId, eventId));
  if (!options?.includeHidden) {
    conditions.push(eq(guestbookEntries.hidden, false));
  }

  return db
    .select({
      id: guestbookEntries.id,
      eventId: guestbookEntries.eventId,
      eventName: weddingEvents.name,
      name: guestbookEntries.name,
      message: guestbookEntries.message,
      email: guestbookEntries.email,
      hidden: guestbookEntries.hidden,
      createdAt: guestbookEntries.createdAt,
    })
    .from(guestbookEntries)
    .innerJoin(weddingEvents, eq(guestbookEntries.eventId, weddingEvents.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(guestbookEntries.createdAt));
}

export async function getGuestbookEntryById(id: number) {
  const [row] = await db
    .select({
      id: guestbookEntries.id,
      eventId: guestbookEntries.eventId,
      eventName: weddingEvents.name,
      name: guestbookEntries.name,
      message: guestbookEntries.message,
      email: guestbookEntries.email,
      hidden: guestbookEntries.hidden,
      createdAt: guestbookEntries.createdAt,
    })
    .from(guestbookEntries)
    .innerJoin(weddingEvents, eq(guestbookEntries.eventId, weddingEvents.id))
    .where(eq(guestbookEntries.id, id))
    .limit(1);
  return row ?? null;
}

export async function listPublishedEventsForGuestbook() {
  return db
    .select({ id: weddingEvents.id, name: weddingEvents.name, slug: weddingEvents.slug })
    .from(weddingEvents)
    .where(eq(weddingEvents.published, true))
    .orderBy(asc(weddingEvents.sortOrder));
}

export function serializeGuestbookEntry(entry: GuestbookEntryRow) {
  return {
    id: entry.id,
    eventId: entry.eventId,
    eventName: entry.eventName,
    name: entry.name,
    message: entry.message,
    hidden: entry.hidden,
    createdAt: entry.createdAt.toISOString(),
  };
}
