import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  DEFAULT_CARD_FRONT,
  type InvitationCardFront,
  type PublicInvitationEvent,
  type PublicScheduleItem,
} from "@/lib/invitation-types";
import type { SessionUser } from "@/lib/permissions";
import { isAdminSession } from "@/lib/role-levels";
import { travellerMatchesUsername } from "@/lib/item-travellers";
import { guestMembers, guests, publicScheduleItems, weddingEvents } from "@/lib/schema";

function parseCardFront(value: unknown): InvitationCardFront {
  if (!value || typeof value !== "object") return DEFAULT_CARD_FRONT;
  const raw = value as Partial<InvitationCardFront>;
  return {
    headline: raw.headline ?? DEFAULT_CARD_FRONT.headline,
    coupleNames: raw.coupleNames ?? DEFAULT_CARD_FRONT.coupleNames,
    dateLine: raw.dateLine ?? "",
    venue: raw.venue ?? "",
    location: raw.location ?? "",
    mapsUrl: raw.mapsUrl,
    tagline: raw.tagline,
  };
}

function toPublicEvent(row: typeof weddingEvents.$inferSelect): PublicInvitationEvent {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    eventDate: row.eventDate,
    location: row.location,
    cardFront: parseCardFront(row.cardFront),
    sortOrder: row.sortOrder,
  };
}

export async function getPublishedInvitationEvents(): Promise<PublicInvitationEvent[]> {
  const rows = await db
    .select()
    .from(weddingEvents)
    .where(eq(weddingEvents.published, true))
    .orderBy(asc(weddingEvents.sortOrder), asc(weddingEvents.id));

  return rows.map(toPublicEvent);
}

export async function getPublishedEventBySlug(
  slug: string,
): Promise<PublicInvitationEvent | null> {
  const [row] = await db
    .select()
    .from(weddingEvents)
    .where(and(eq(weddingEvents.slug, slug), eq(weddingEvents.published, true)))
    .limit(1);

  return row ? toPublicEvent(row) : null;
}

export async function getPublishedScheduleForEvent(
  eventId: number,
): Promise<PublicScheduleItem[]> {
  const rows = await db
    .select()
    .from(publicScheduleItems)
    .where(
      and(
        eq(publicScheduleItems.eventId, eventId),
        eq(publicScheduleItems.published, true),
      ),
    )
    .orderBy(asc(publicScheduleItems.sortOrder), asc(publicScheduleItems.id));

  return rows.map((row) => ({
    id: row.id,
    eventId: row.eventId,
    timeLabel: row.timeLabel,
    title: row.title,
    description: row.description,
    sortOrder: row.sortOrder,
  }));
}

export async function getInvitationEventsWithSchedules(): Promise<
  Array<PublicInvitationEvent & { schedule: PublicScheduleItem[] }>
> {
  const events = await getPublishedInvitationEvents();
  if (events.length === 0) return [];

  const eventIds = events.map((event) => event.id);
  const rows = await db
    .select()
    .from(publicScheduleItems)
    .where(
      and(
        inArray(publicScheduleItems.eventId, eventIds),
        eq(publicScheduleItems.published, true),
      ),
    )
    .orderBy(asc(publicScheduleItems.sortOrder), asc(publicScheduleItems.id));

  const scheduleByEventId = new Map<number, PublicScheduleItem[]>();
  for (const row of rows) {
    const schedule = scheduleByEventId.get(row.eventId) ?? [];
    schedule.push({
      id: row.id,
      eventId: row.eventId,
      timeLabel: row.timeLabel,
      title: row.title,
      description: row.description,
      sortOrder: row.sortOrder,
    });
    scheduleByEventId.set(row.eventId, schedule);
  }

  return events.map((event) => ({
    ...event,
    schedule: scheduleByEventId.get(event.id) ?? [],
  }));
}

export async function getInvitationEventsForUser(
  user: SessionUser,
): Promise<Array<PublicInvitationEvent & { schedule: PublicScheduleItem[] }>> {
  const events = await getInvitationEventsWithSchedules();
  if (user.isAdmin || isAdminSession(user.roleLevel)) return events;
  if (events.length === 0) return [];

  const eventIds = events.map((event) => event.id);
  const guestRows = await db
    .select({
      eventId: guests.eventId,
      label: guests.label,
      guestId: guests.id,
    })
    .from(guests)
    .where(inArray(guests.eventId, eventIds));

  const guestIds = guestRows.map((row) => row.guestId);
  const memberRows =
    guestIds.length > 0
      ? await db
          .select({
            guestId: guestMembers.guestId,
            name: guestMembers.name,
          })
          .from(guestMembers)
          .where(inArray(guestMembers.guestId, guestIds))
      : [];

  const membersByGuestId = new Map<number, string[]>();
  for (const member of memberRows) {
    const names = membersByGuestId.get(member.guestId) ?? [];
    names.push(member.name);
    membersByGuestId.set(member.guestId, names);
  }

  const matchingEventIds = new Set<number>();
  for (const guest of guestRows) {
    const names = [guest.label, ...(membersByGuestId.get(guest.guestId) ?? [])];
    if (
      names.some((name) => travellerMatchesUsername(name, user.username))
    ) {
      matchingEventIds.add(guest.eventId);
    }
  }

  return events.filter((event) => matchingEventIds.has(event.id));
}

export async function getAllInvitationEvents() {
  return db
    .select()
    .from(weddingEvents)
    .orderBy(asc(weddingEvents.sortOrder), asc(weddingEvents.id));
}

export async function getScheduleItemsForEventAdmin(eventId: number) {
  return db
    .select()
    .from(publicScheduleItems)
    .where(eq(publicScheduleItems.eventId, eventId))
    .orderBy(asc(publicScheduleItems.sortOrder), asc(publicScheduleItems.id));
}
