import { and, desc, eq, inArray, isNull, lte, or } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  normalizePermissions,
  receivesAllGuestListNotifications,
} from "@/lib/permissions";
import { getWeddingCoordinatorUserIdsForEvent } from "@/lib/guest-queries";
import {
  guestListPermissions,
  notifications,
  taskReminders,
  users,
} from "@/lib/schema";

export async function createNotification(input: {
  userId: number;
  type: string;
  title: string;
  body?: string;
  href?: string;
  metadata?: Record<string, unknown>;
}) {
  const [row] = await db
    .insert(notifications)
    .values({
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      href: input.href ?? null,
      metadata: input.metadata ?? {},
    })
    .returning();
  return row;
}

export async function notifyGuestListWatchers(
  eventId: number,
  title: string,
  body: string,
  href: string,
) {
  const watchers = await db
    .select({ userId: guestListPermissions.userId })
    .from(guestListPermissions)
    .where(
      and(
        eq(guestListPermissions.eventId, eventId),
        or(
          eq(guestListPermissions.canView, true),
          eq(guestListPermissions.canEdit, true),
          eq(guestListPermissions.isWeddingCoordinator, true),
        ),
      ),
    );

  const admins = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.isAdmin, true));

  const allUsers = await db
    .select({
      id: users.id,
      username: users.username,
      isAdmin: users.isAdmin,
      permissions: users.permissions,
    })
    .from(users);

  const globalWatchers = allUsers
    .filter((row) =>
      receivesAllGuestListNotifications({
        isAdmin: row.isAdmin,
        permissions: normalizePermissions(
          row.permissions,
          row.isAdmin,
          row.username,
        ),
      }),
    )
    .map((row) => row.id);

  const userIds = [
    ...new Set([
      ...watchers.map((row) => row.userId),
      ...admins.map((row) => row.id),
      ...globalWatchers,
    ]),
  ];

  if (!userIds.length) return;

  await db.insert(notifications).values(
    userIds.map((userId) => ({
      userId,
      type: "rsvp_update",
      title,
      body,
      href,
      metadata: { eventId },
    })),
  );
}

export async function notifyWeddingCoordinatorsOnGuestInvite(input: {
  eventId: number;
  guestLabel: string;
  guestId: number;
}) {
  const coordinatorIds = await getWeddingCoordinatorUserIdsForEvent(input.eventId);

  if (!coordinatorIds.length) return;

  await db.insert(notifications).values(
    coordinatorIds.map((userId) => ({
      userId,
      type: "guest_invited",
      title: "New guest invitation",
      body: input.guestLabel,
      href: `/guests`,
      metadata: { eventId: input.eventId, guestId: input.guestId },
    })),
  );
}

export async function processDueReminders(userId: number) {
  const due = await db
    .select()
    .from(taskReminders)
    .where(
      and(
        eq(taskReminders.userId, userId),
        eq(taskReminders.processed, false),
        lte(taskReminders.remindAt, new Date()),
      ),
    );

  for (const reminder of due) {
    await createNotification({
      userId: reminder.userId,
      type: "task_reminder",
      title: "Task reminder",
      body: "A task reminder is due.",
      href: `/tasks?task=${reminder.taskId}`,
      metadata: { taskId: reminder.taskId, reminderId: reminder.id },
    });
    await db
      .update(taskReminders)
      .set({ processed: true })
      .where(eq(taskReminders.id, reminder.id));
  }
}

export async function getNotificationsForUser(userId: number) {
  await processDueReminders(userId);
  return db
    .select()
    .from(notifications)
    .where(
      and(eq(notifications.userId, userId), isNull(notifications.archivedAt)),
    )
    .orderBy(desc(notifications.createdAt))
    .limit(50);
}

export async function getUnreadCount(userId: number) {
  await processDueReminders(userId);
  const rows = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, userId),
        isNull(notifications.readAt),
        isNull(notifications.archivedAt),
      ),
    );
  return rows.length;
}

export async function listAllNotifications(filters?: {
  includeArchived?: boolean;
  username?: string;
  limit?: number;
}) {
  const baseQuery = db
    .select({
      id: notifications.id,
      userId: notifications.userId,
      username: users.username,
      type: notifications.type,
      title: notifications.title,
      body: notifications.body,
      href: notifications.href,
      metadata: notifications.metadata,
      readAt: notifications.readAt,
      archivedAt: notifications.archivedAt,
      createdAt: notifications.createdAt,
    })
    .from(notifications)
    .innerJoin(users, eq(users.id, notifications.userId));

  const rows = await (filters?.includeArchived
    ? baseQuery
    : baseQuery.where(isNull(notifications.archivedAt))
  )
    .orderBy(desc(notifications.createdAt))
    .limit(filters?.limit ?? 200);

  if (!filters?.username) return rows;
  const needle = filters.username.toLowerCase();
  return rows.filter((row) => row.username?.toLowerCase().includes(needle));
}

export async function archiveNotificationAdmin(id: number) {
  await db
    .update(notifications)
    .set({ archivedAt: new Date() })
    .where(eq(notifications.id, id));
}

export async function setNotificationReadAdmin(id: number, read: boolean) {
  await db
    .update(notifications)
    .set({ readAt: read ? new Date() : null })
    .where(eq(notifications.id, id));
}

export async function deleteNotificationAdmin(id: number) {
  await db.delete(notifications).where(eq(notifications.id, id));
}

export async function deleteNotificationsAdmin(ids: number[]) {
  if (ids.length === 0) return 0;
  await db.delete(notifications).where(inArray(notifications.id, ids));
  return ids.length;
}

export async function markNotificationRead(userId: number, id: number) {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
}

export async function markAllNotificationsRead(userId: number) {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(eq(notifications.userId, userId), isNull(notifications.readAt)),
    );
}

export async function getUnreadUrgentTasks(userId: number) {
  const rows = await db
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, userId),
        isNull(notifications.readAt),
        inArray(notifications.type, ["task_urgent", "task_assigned"]),
      ),
    )
    .orderBy(desc(notifications.createdAt))
    .limit(5);
  return rows.filter((row) => row.metadata && (row.metadata as { urgent?: boolean }).urgent !== false);
}
