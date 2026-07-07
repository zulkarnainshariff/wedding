import { and, asc, eq, inArray, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/lib/db";
import { tripDateFromDueAt } from "@/lib/task-day-link";
import { ensureTaskViewPermissionsSchema } from "@/lib/ensure-task-permissions-schema";
import type { TaskPermissionAccess } from "@/lib/task-types";
import type { SessionUser } from "@/lib/permissions";
import {
  itineraryDays,
  itineraryItems,
  taskNotes,
  taskPermissions,
  taskReminders,
  tasks,
  users,
  weddingEvents,
} from "@/lib/schema";

export type ItemTaskSummary = {
  count: number;
  mine: number;
  label: string;
  hasNotes: boolean;
  hasUrgent?: boolean;
  notePreview?: string;
};

const assigneeUser = alias(users, "assignee_user");
const assignerUser = alias(users, "assigner_user");

type TaskVisibilityTarget = {
  eventId: number | null;
  assigneeUserId: number;
  createdByUserId: number;
};

function normalizeViewableUserIds(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((entry) => Number(entry)).filter((id) => id > 0))];
}

export function canViewTaskWithPermissions(
  user: SessionUser,
  task: TaskVisibilityTarget,
  permissions: TaskPermissionAccess[],
): boolean {
  if (task.assigneeUserId === user.id) return true;
  if (task.createdByUserId === user.id) return true;
  if (user.isAdmin) return true;

  if (task.eventId == null) {
    return permissions.some(
      (entry) =>
        entry.canViewOthersTasks ||
        entry.viewableUserIds.includes(task.assigneeUserId),
    );
  }

  const perm = permissions.find((entry) => entry.eventId === task.eventId);
  if (!perm) return false;
  if (perm.canViewOthersTasks) return true;
  return perm.viewableUserIds.includes(task.assigneeUserId);
}

export async function canViewTask(
  user: SessionUser,
  task: TaskVisibilityTarget,
): Promise<boolean> {
  const permissions = await getTaskPermissionsForUser(user);
  return canViewTaskWithPermissions(user, task, permissions);
}

export async function canAssignOnAnyEvent(user: SessionUser) {
  if (user.isAdmin) return true;
  const permissions = await getTaskPermissionsForUser(user);
  return permissions.some((entry) => entry.canAssign || entry.canAssignForOthers);
}

export async function canAssignOnEvent(user: SessionUser, eventId: number) {
  if (user.isAdmin) return true;
  const permissions = await getTaskPermissionsForUser(user);
  const perm = permissions.find((entry) => entry.eventId === eventId);
  return Boolean(perm?.canAssign || perm?.canAssignForOthers);
}

export async function resolveAssignEventId(user: SessionUser) {
  const permissions = await getTaskPermissionsForUser(user);
  const assignable = permissions.find(
    (entry) => entry.canAssign || entry.canAssignForOthers,
  );
  return assignable?.eventId ?? permissions[0]?.eventId ?? null;
}

export async function getTaskPermissionsForUser(
  user: SessionUser,
): Promise<TaskPermissionAccess[]> {
  await ensureTaskViewPermissionsSchema();

  if (user.isAdmin) {
    const events = await db
      .select()
      .from(weddingEvents)
      .orderBy(asc(weddingEvents.sortOrder));
    return events.map((event) => ({
      eventId: event.id,
      eventSlug: event.slug,
      eventName: event.name,
      canAssign: true,
      canAssignForOthers: true,
      canViewOthersTasks: true,
      viewableUserIds: [],
    }));
  }

  const rows = await db
    .select({
      eventId: taskPermissions.eventId,
      eventSlug: weddingEvents.slug,
      eventName: weddingEvents.name,
      canAssign: taskPermissions.canAssign,
      canAssignForOthers: taskPermissions.canAssignForOthers,
      canViewOthersTasks: taskPermissions.canViewOthersTasks,
      viewableUserIds: taskPermissions.viewableUserIds,
    })
    .from(taskPermissions)
    .innerJoin(weddingEvents, eq(taskPermissions.eventId, weddingEvents.id))
    .where(eq(taskPermissions.userId, user.id));

  return rows
    .map((row) => ({
      ...row,
      viewableUserIds: normalizeViewableUserIds(row.viewableUserIds),
    }))
    .filter(
      (row) =>
        row.canAssign ||
        row.canAssignForOthers ||
        row.canViewOthersTasks ||
        row.viewableUserIds.length > 0,
    );
}

export async function canAssignTasks(user: SessionUser, eventId: number | null) {
  if (user.isAdmin) return true;
  if (eventId == null) return canAssignOnAnyEvent(user);
  const [row] = await db
    .select()
    .from(taskPermissions)
    .where(
      and(
        eq(taskPermissions.userId, user.id),
        eq(taskPermissions.eventId, eventId),
        or(
          eq(taskPermissions.canAssign, true),
          eq(taskPermissions.canAssignForOthers, true),
        ),
      ),
    )
    .limit(1);
  return Boolean(row);
}

export async function canViewOthersTasks(user: SessionUser, eventId: number) {
  if (user.isAdmin) return true;
  const [row] = await db
    .select()
    .from(taskPermissions)
    .where(
      and(
        eq(taskPermissions.userId, user.id),
        eq(taskPermissions.eventId, eventId),
        eq(taskPermissions.canViewOthersTasks, true),
      ),
    )
    .limit(1);
  return Boolean(row);
}

export async function getTaskNotePreviews(taskIds: number[]) {
  if (!taskIds.length) return new Map<number, string>();
  const rows = await db
    .select({
      taskId: taskNotes.taskId,
      content: taskNotes.content,
      author: users.username,
    })
    .from(taskNotes)
    .innerJoin(users, eq(taskNotes.authorUserId, users.id))
    .where(inArray(taskNotes.taskId, taskIds))
    .orderBy(asc(taskNotes.createdAt));

  const grouped = new Map<number, string[]>();
  for (const row of rows) {
    const lines = grouped.get(row.taskId) ?? [];
    lines.push(`${row.author}: ${row.content}`);
    grouped.set(row.taskId, lines);
  }
  return new Map(
    [...grouped.entries()].map(([taskId, lines]) => [taskId, lines.join("\n")]),
  );
}

export async function getTaskNoteCounts(taskIds: number[]) {
  if (!taskIds.length) return new Map<number, number>();
  const rows = await db
    .select({
      taskId: taskNotes.taskId,
      count: sql<number>`count(*)::int`,
    })
    .from(taskNotes)
    .where(inArray(taskNotes.taskId, taskIds))
    .groupBy(taskNotes.taskId);
  return new Map(rows.map((row) => [row.taskId, row.count]));
}

export async function getVisibleTasks(user: SessionUser) {
  const permissions = await getTaskPermissionsForUser(user);

  const allTasks = await db
    .select({
      task: tasks,
      assignee: assigneeUser.username,
      assigner: assignerUser.username,
      eventName: weddingEvents.name,
      eventSlug: weddingEvents.slug,
      itemTitle: itineraryItems.title,
    })
    .from(tasks)
    .innerJoin(assigneeUser, eq(tasks.assigneeUserId, assigneeUser.id))
    .innerJoin(assignerUser, eq(tasks.createdByUserId, assignerUser.id))
    .leftJoin(weddingEvents, eq(tasks.eventId, weddingEvents.id))
    .leftJoin(itineraryItems, eq(tasks.itemId, itineraryItems.id))
    .orderBy(asc(tasks.dueAt), asc(tasks.id));

  const visible = allTasks.filter(({ task }) =>
    canViewTaskWithPermissions(user, task, permissions),
  );

  const noteCounts = await getTaskNoteCounts(visible.map(({ task }) => task.id));
  const notePreviews = await getTaskNotePreviews(visible.map(({ task }) => task.id));
  return visible.map((row) => ({
    ...row,
    noteCount: noteCounts.get(row.task.id) ?? 0,
    notePreview: notePreviews.get(row.task.id) ?? "",
  }));
}

export async function getTaskWithDetails(taskId: number) {
  const [row] = await db
    .select({
      task: tasks,
      assignee: assigneeUser.username,
      assigner: assignerUser.username,
      eventName: weddingEvents.name,
    })
    .from(tasks)
    .innerJoin(assigneeUser, eq(tasks.assigneeUserId, assigneeUser.id))
    .innerJoin(assignerUser, eq(tasks.createdByUserId, assignerUser.id))
    .leftJoin(weddingEvents, eq(tasks.eventId, weddingEvents.id))
    .where(eq(tasks.id, taskId))
    .limit(1);

  if (!row) return null;

  const notes = await db
    .select({
      note: taskNotes,
      author: users.username,
    })
    .from(taskNotes)
    .innerJoin(users, eq(taskNotes.authorUserId, users.id))
    .where(eq(taskNotes.taskId, taskId))
    .orderBy(asc(taskNotes.createdAt));

  const reminders = await db
    .select()
    .from(taskReminders)
    .where(eq(taskReminders.taskId, taskId))
    .orderBy(asc(taskReminders.remindAt));

  const subtasks = await db
    .select()
    .from(tasks)
    .where(eq(tasks.parentTaskId, taskId))
    .orderBy(asc(tasks.id));

  return { ...row, notes, reminders, subtasks };
}

export type DayTaskBrief = {
  id: number;
  title: string;
  isUrgent: boolean;
  hasNotes: boolean;
  mine: boolean;
};

export async function getTaskIndicators(user: SessionUser) {
  const permissions = await getTaskPermissionsForUser(user);
  const visible = await getVisibleTasks(user);
  const dayRows = await db
    .select({ id: itineraryDays.id, date: itineraryDays.date })
    .from(itineraryDays);
  const dayIdByDate = new Map(dayRows.map((day) => [day.date, day.id]));

  const resolveTaskDayId = (task: {
    dayId: number | null;
    itemId: number | null;
    dueAt: Date | null;
  }): number | null => {
    if (task.itemId) return task.dayId;
    if (task.dayId) return task.dayId;
    const tripDate = tripDateFromDueAt(task.dueAt);
    if (!tripDate) return null;
    return dayIdByDate.get(tripDate) ?? null;
  };

  const dayCounts: Record<number, number> = {};
  const dayTasks: Record<number, DayTaskBrief[]> = {};
  const itemCounts: Record<number, number> = {};
  const itemSummaries: Record<
    number,
    { count: number; mine: number; assignees: Set<string>; hasNotes: boolean; hasUrgent: boolean; noteLines: string[] }
  > = {};

  const noteCounts = await getTaskNoteCounts(
    visible.map(({ task }) => task.id),
  );
  const notePreviews = await getTaskNotePreviews(
    visible.map(({ task }) => task.id),
  );

  let openCount = 0;

  for (const { task, assignee } of visible) {
    if (task.status === "completed") continue;
    openCount += 1;
    const effectiveDayId = resolveTaskDayId(task);
    if (effectiveDayId) {
      dayCounts[effectiveDayId] = (dayCounts[effectiveDayId] ?? 0) + 1;
      if (!task.itemId) {
        const list = dayTasks[effectiveDayId] ?? [];
        list.push({
          id: task.id,
          title: task.title,
          isUrgent: task.isUrgent,
          hasNotes: (noteCounts.get(task.id) ?? 0) > 0,
          mine: task.assigneeUserId === user.id,
        });
        dayTasks[effectiveDayId] = list;
      }
    }
    if (!task.itemId) continue;

    itemCounts[task.itemId] = (itemCounts[task.itemId] ?? 0) + 1;
    const summary = itemSummaries[task.itemId] ?? {
      count: 0,
      mine: 0,
      assignees: new Set<string>(),
      hasNotes: false,
      hasUrgent: false,
      noteLines: [],
    };
    summary.count += 1;
    if (task.isUrgent) summary.hasUrgent = true;
    const preview = notePreviews.get(task.id);
    if (preview) {
      summary.hasNotes = true;
      summary.noteLines.push(preview);
    } else if ((noteCounts.get(task.id) ?? 0) > 0) {
      summary.hasNotes = true;
    }
    if (task.assigneeUserId === user.id) {
      summary.mine += 1;
    } else if (canViewTaskWithPermissions(user, task, permissions)) {
      summary.assignees.add(assignee);
    }
    itemSummaries[task.itemId] = summary;
  }

  const formattedSummaries: Record<number, ItemTaskSummary> = {};
  for (const [itemId, summary] of Object.entries(itemSummaries)) {
    const others = Array.from(summary.assignees);
    let label = "";
    if (summary.count === 1 && summary.mine === 1) {
      label = "Task assigned to you";
    } else if (summary.count === 1 && summary.mine === 0 && others.length === 1) {
      label = `Task assigned to ${others[0]}`;
    } else if (summary.mine === summary.count) {
      label = `${summary.count} tasks assigned to you`;
    } else if (summary.mine === 0 && others.length === 1) {
      label = `Task assigned to ${others[0]}`;
    } else if (summary.mine > 0 && others.length > 0) {
      label = `${summary.count} tasks · you, ${others.join(", ")}`;
    } else if (others.length > 0) {
      label = `${summary.count} tasks · ${others.join(", ")}`;
    } else {
      label = `${summary.count} open task${summary.count === 1 ? "" : "s"}`;
    }
    formattedSummaries[Number(itemId)] = {
      count: summary.count,
      mine: summary.mine,
      label,
      hasNotes: summary.hasNotes,
      hasUrgent: summary.hasUrgent,
      notePreview: summary.noteLines.length
        ? summary.noteLines.join("\n\n")
        : undefined,
    };
  }

  return { dayCounts, dayTasks, itemCounts, itemSummaries: formattedSummaries, openCount };
}

export async function getMaxDueDate(dayId?: number | null, itemId?: number | null) {
  if (itemId) {
    const [item] = await db
      .select()
      .from(itineraryItems)
      .where(eq(itineraryItems.id, itemId))
      .limit(1);
    if (item?.startDatetime) return item.startDatetime;
    if (item?.eventDate) return new Date(`${item.eventDate}T23:59:59`);
  }
  if (dayId) {
    const [day] = await db
      .select()
      .from(itineraryDays)
      .where(eq(itineraryDays.id, dayId))
      .limit(1);
    if (day?.date) return new Date(`${day.date}T23:59:59`);
  }
  return null;
}

export async function getAllUsersBrief() {
  return db
    .select({ id: users.id, username: users.username })
    .from(users)
    .orderBy(asc(users.username));
}

export async function getTaskPermissionsAdmin(eventId: number) {
  await ensureTaskViewPermissionsSchema();

  return db
    .select()
    .from(taskPermissions)
    .where(eq(taskPermissions.eventId, eventId));
}
