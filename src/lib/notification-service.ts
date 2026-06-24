import { and, desc, eq, inArray, isNull, lte, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { GUEST_LIST_HOST_USERNAMES } from "@/lib/guest-queries";
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
        ),
      ),
    );

  const admins = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.isAdmin, true));

  const hosts = await db
    .select({ id: users.id })
    .from(users)
    .where(
      inArray(users.username, [...GUEST_LIST_HOST_USERNAMES]),
    );

  const userIds = [
    ...new Set([
      ...watchers.map((row) => row.userId),
      ...admins.map((row) => row.id),
      ...hosts.map((row) => row.id),
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
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(50);
}

export async function getUnreadCount(userId: number) {
  await processDueReminders(userId);
  const rows = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(
      and(eq(notifications.userId, userId), isNull(notifications.readAt)),
    );
  return rows.length;
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
