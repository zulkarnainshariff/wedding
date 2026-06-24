import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import type { GuestListAccess } from "@/lib/guest-list-types";
import {
  canEditItinerary,
  canManageUsers,
  type SessionUser,
} from "@/lib/permissions";
import {
  eventRsvpSettings,
  guestListPermissions,
  guestMembers,
  guests,
  weddingEvents,
} from "@/lib/schema";

/** Bride and groom always see every guest list (both celebrations). */
export const GUEST_LIST_HOST_USERNAMES = new Set(["natalie", "zulkarnain"]);

function hasFullGuestListAccess(user: SessionUser): boolean {
  return (
    user.isAdmin ||
    canManageUsers(user) ||
    canEditItinerary(user) ||
    GUEST_LIST_HOST_USERNAMES.has(user.username.toLowerCase())
  );
}

async function getAllGuestListAccess(): Promise<GuestListAccess[]> {
  const events = await db
    .select()
    .from(weddingEvents)
    .orderBy(asc(weddingEvents.sortOrder));

  return events.map((event) => ({
    eventId: event.id,
    eventSlug: event.slug,
    eventName: event.name,
    canView: true,
    canEdit: true,
  }));
}

export async function getGuestListAccessForUser(
  user: SessionUser,
): Promise<GuestListAccess[]> {
  if (hasFullGuestListAccess(user)) {
    return getAllGuestListAccess();
  }

  const rows = await db
    .select({
      eventId: guestListPermissions.eventId,
      eventSlug: weddingEvents.slug,
      eventName: weddingEvents.name,
      canView: guestListPermissions.canView,
      canEdit: guestListPermissions.canEdit,
    })
    .from(guestListPermissions)
    .innerJoin(weddingEvents, eq(guestListPermissions.eventId, weddingEvents.id))
    .where(eq(guestListPermissions.userId, user.id));

  return rows.filter((row) => row.canView || row.canEdit);
}

export async function canViewGuestList(
  user: SessionUser,
  eventId: number,
): Promise<boolean> {
  if (hasFullGuestListAccess(user)) return true;
  const [row] = await db
    .select()
    .from(guestListPermissions)
    .where(
      and(
        eq(guestListPermissions.userId, user.id),
        eq(guestListPermissions.eventId, eventId),
      ),
    )
    .limit(1);
  return Boolean(row?.canView || row?.canEdit);
}

export async function canEditGuestList(
  user: SessionUser,
  eventId: number,
): Promise<boolean> {
  if (hasFullGuestListAccess(user)) return true;
  const [row] = await db
    .select()
    .from(guestListPermissions)
    .where(
      and(
        eq(guestListPermissions.userId, user.id),
        eq(guestListPermissions.eventId, eventId),
        eq(guestListPermissions.canEdit, true),
      ),
    )
    .limit(1);
  return Boolean(row);
}

export async function getGuestsForEvent(eventId: number) {
  const guestRows = await db
    .select()
    .from(guests)
    .where(eq(guests.eventId, eventId))
    .orderBy(asc(guests.sortOrder), asc(guests.id));

  const result = [];
  for (const guest of guestRows) {
    const members = await db
      .select()
      .from(guestMembers)
      .where(eq(guestMembers.guestId, guest.id))
      .orderBy(asc(guestMembers.sortOrder), asc(guestMembers.id));
    result.push({ ...guest, members });
  }
  return result;
}

export async function getGuestByToken(token: string) {
  const [guest] = await db
    .select()
    .from(guests)
    .where(eq(guests.inviteToken, token))
    .limit(1);
  if (!guest) return null;

  const [event] = await db
    .select()
    .from(weddingEvents)
    .where(eq(weddingEvents.id, guest.eventId))
    .limit(1);
  if (!event) return null;

  const members = await db
    .select()
    .from(guestMembers)
    .where(eq(guestMembers.guestId, guest.id))
    .orderBy(asc(guestMembers.sortOrder), asc(guestMembers.id));

  const [rsvpSettings] = await db
    .select()
    .from(eventRsvpSettings)
    .where(eq(eventRsvpSettings.eventId, guest.eventId))
    .limit(1);

  return { guest, event, members, rsvpSettings: rsvpSettings ?? null };
}

export async function getRsvpSettingsForEvent(eventId: number) {
  const [settings] = await db
    .select()
    .from(eventRsvpSettings)
    .where(eq(eventRsvpSettings.eventId, eventId))
    .limit(1);
  return settings ?? null;
}

export async function getGuestListPermissionsForEvent(eventId: number) {
  return db
    .select()
    .from(guestListPermissions)
    .where(eq(guestListPermissions.eventId, eventId));
}

export function isRsvpExpired(
  deadline: Date | string | null | undefined,
): boolean {
  if (!deadline) return false;
  return new Date(deadline).getTime() < Date.now();
}
