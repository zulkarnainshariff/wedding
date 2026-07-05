import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import type { GuestListAccess } from "@/lib/guest-list-types";
import { hasGlobalGuestListAccess, type SessionUser } from "@/lib/permissions";
import {
  eventRsvpSettings,
  guestListPermissions,
  guestMembers,
  guests,
  weddingEvents,
} from "@/lib/schema";

function hasGuestListPanelAccess(entry: GuestListAccess): boolean {
  return Boolean(
    entry.canView || entry.canEdit || entry.isWeddingCoordinator,
  );
}

async function getAllGuestListAccess(
  user: SessionUser,
): Promise<GuestListAccess[]> {
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
    isWeddingCoordinator: true,
    canModerateGuestbook: true,
  }));
}

export async function getGuestListAccessForUser(
  user: SessionUser,
): Promise<GuestListAccess[]> {
  if (hasGlobalGuestListAccess(user)) {
    return getAllGuestListAccess(user);
  }

  const rows = await db
    .select({
      eventId: guestListPermissions.eventId,
      eventSlug: weddingEvents.slug,
      eventName: weddingEvents.name,
      canView: guestListPermissions.canView,
      canEdit: guestListPermissions.canEdit,
      isWeddingCoordinator: guestListPermissions.isWeddingCoordinator,
      canModerateGuestbook: guestListPermissions.canModerateGuestbook,
    })
    .from(guestListPermissions)
    .innerJoin(weddingEvents, eq(guestListPermissions.eventId, weddingEvents.id))
    .where(eq(guestListPermissions.userId, user.id));

  return rows.filter(
    (row) =>
      row.canView ||
      row.canEdit ||
      row.isWeddingCoordinator ||
      row.canModerateGuestbook,
  );
}

export async function canViewGuestList(
  user: SessionUser,
  eventId: number,
): Promise<boolean> {
  if (hasGlobalGuestListAccess(user)) return true;
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
  return Boolean(row?.canView || row?.canEdit || row?.isWeddingCoordinator);
}

export async function canEditGuestList(
  user: SessionUser,
  eventId: number,
): Promise<boolean> {
  if (hasGlobalGuestListAccess(user)) return true;
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
  return Boolean(row?.canEdit || row?.isWeddingCoordinator);
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

export async function canModerateGuestbookForEvent(
  user: SessionUser,
  eventId: number,
): Promise<boolean> {
  if (hasGlobalGuestListAccess(user)) return true;
  if (await isWeddingCoordinatorForEvent(user, eventId)) return true;
  const [row] = await db
    .select({ canModerateGuestbook: guestListPermissions.canModerateGuestbook })
    .from(guestListPermissions)
    .where(
      and(
        eq(guestListPermissions.userId, user.id),
        eq(guestListPermissions.eventId, eventId),
      ),
    )
    .limit(1);
  return Boolean(row?.canModerateGuestbook);
}

export async function isWeddingCoordinatorForEvent(
  user: SessionUser,
  eventId: number,
): Promise<boolean> {
  if (hasGlobalGuestListAccess(user)) return true;
  const [row] = await db
    .select({ isWeddingCoordinator: guestListPermissions.isWeddingCoordinator })
    .from(guestListPermissions)
    .where(
      and(
        eq(guestListPermissions.userId, user.id),
        eq(guestListPermissions.eventId, eventId),
      ),
    )
    .limit(1);
  return Boolean(row?.isWeddingCoordinator);
}

export async function getWeddingCoordinatorUserIdsForEvent(
  eventId: number,
): Promise<number[]> {
  const rows = await db
    .select({ userId: guestListPermissions.userId })
    .from(guestListPermissions)
    .where(
      and(
        eq(guestListPermissions.eventId, eventId),
        eq(guestListPermissions.isWeddingCoordinator, true),
      ),
    );
  return [...new Set(rows.map((row) => row.userId))];
}

export async function getEventsMissingCoordinators(): Promise<
  { id: number; name: string }[]
> {
  const events = await db
    .select({ id: weddingEvents.id, name: weddingEvents.name })
    .from(weddingEvents)
    .orderBy(asc(weddingEvents.sortOrder), asc(weddingEvents.id));

  const coordinatorRows = await db
    .select({ eventId: guestListPermissions.eventId })
    .from(guestListPermissions)
    .where(eq(guestListPermissions.isWeddingCoordinator, true));

  const eventsWithCoordinators = new Set(
    coordinatorRows.map((row) => row.eventId),
  );

  return events
    .filter((event) => !eventsWithCoordinators.has(event.id))
    .map((event) => ({ id: event.id, name: event.name }));
}

export function isRsvpExpired(
  deadline: Date | string | null | undefined,
): boolean {
  if (!deadline) return false;
  return new Date(deadline).getTime() < Date.now();
}

export { hasGuestListPanelAccess };
