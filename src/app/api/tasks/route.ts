import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { isAuthError, requireAuth } from "@/lib/api-auth";
import { logAuditEvent } from "@/lib/activity-log";
import { logOperationError } from "@/lib/error-log";
import { createNotification } from "@/lib/notification-service";
import {
  canAssignOnAnyEvent,
  canAssignOnEvent,
  getMaxDueDate,
  getTaskPermissionsForUser,
  getVisibleTasks,
  resolveAssignEventId,
} from "@/lib/task-queries";
import { db } from "@/lib/db";
import { itineraryItems, taskReminders, tasks, weddingEvents } from "@/lib/schema";

export async function GET() {
  const user = await requireAuth();
  if (isAuthError(user)) return user;

  const rows = await getVisibleTasks(user);
  return NextResponse.json(
    rows.map(({ task, assignee, assigner, eventName, eventSlug, itemTitle, noteCount, notePreview }) => ({
      ...task,
      assignee,
      assigner,
      eventName,
      eventSlug,
      itemTitle,
      noteCount,
      hasNotes: noteCount > 0,
      notePreview: notePreview || undefined,
    })),
  );
}

export async function POST(request: Request) {
  const user = await requireAuth();
  if (isAuthError(user)) return user;

  try {
    const body = await request.json();
    const itemId = body.itemId ? Number(body.itemId) : null;
    const eventIdFromBody = body.eventId ? Number(body.eventId) : null;

    if (!body.title?.trim()) {
      return NextResponse.json({ error: "Task title is required." }, { status: 400 });
    }

    if (!(await canAssignOnAnyEvent(user))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let eventId: number | null = null;
    let dayId: number | null = body.dayId ?? null;
    let linkedItemId: number | null = null;

    if (itemId) {
      const [item] = await db
        .select()
        .from(itineraryItems)
        .where(eq(itineraryItems.id, itemId))
        .limit(1);

      if (!item) {
        return NextResponse.json({ error: "Itinerary item not found." }, { status: 404 });
      }

      eventId = await resolveAssignEventId(user);
      if (!eventId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      dayId = dayId ?? item.dayId ?? null;
      linkedItemId = itemId;
    } else {
      if (!eventIdFromBody) {
        return NextResponse.json(
          { error: "eventId is required for standalone tasks." },
          { status: 400 },
        );
      }

      const [event] = await db
        .select()
        .from(weddingEvents)
        .where(eq(weddingEvents.id, eventIdFromBody))
        .limit(1);

      if (!event) {
        return NextResponse.json({ error: "Event not found." }, { status: 404 });
      }

      if (!(await canAssignOnEvent(user, eventIdFromBody))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      eventId = eventIdFromBody;
    }

    const assigneeUserId = Number(body.assigneeUserId) || user.id;
    if (assigneeUserId !== user.id && !user.isAdmin) {
      const perm = (await getTaskPermissionsForUser(user)).find(
        (entry) => entry.eventId === eventId,
      );
      if (!perm?.canAssignForOthers) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    let dueAt = body.dueAt ? new Date(body.dueAt) : null;
    const maxDue = linkedItemId
      ? await getMaxDueDate(dayId, linkedItemId)
      : null;
    if (maxDue && dueAt && dueAt > maxDue) dueAt = maxDue;

    const [created] = await db
      .insert(tasks)
      .values({
        eventId: eventId!,
        dayId,
        itemId: linkedItemId,
        parentTaskId: body.parentTaskId ?? null,
        title: body.title.trim(),
        assignerNotes: body.assignerNotes ?? null,
        assigneeUserId,
        createdByUserId: user.id,
        dueAt,
        allowSubtasks: Boolean(body.allowSubtasks),
        allowTaggedNotes: Boolean(body.allowTaggedNotes),
        allowAssigneeEdit: Boolean(body.allowAssigneeEdit),
        isUrgent: Boolean(body.isUrgent),
      })
      .returning();

    try {
      await createNotification({
        userId: assigneeUserId,
        type: body.isUrgent ? "task_urgent" : "task_assigned",
        title: body.isUrgent ? "Urgent task assigned" : "New task assigned",
        body: body.title,
        href: linkedItemId
          ? `/itinerary?item=${linkedItemId}&task=${created.id}`
          : `/tasks?task=${created.id}`,
        metadata: {
          taskId: created.id,
          urgent: Boolean(body.isUrgent),
          itemId: linkedItemId,
        },
      });
    } catch (notificationError) {
      console.error("Task created but notification failed:", notificationError);
    }

    if (body.remindAt) {
      try {
        await db.insert(taskReminders).values({
          taskId: created.id,
          userId: user.id,
          remindAt: new Date(body.remindAt),
        });
      } catch (reminderError) {
        console.error("Task created but reminder failed:", reminderError);
      }
    }

    await logAuditEvent({
      user,
      action: "create",
      resourceType: "task",
      resourceId: created.id,
      summary: `Created task "${created.title}"`,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("POST /api/tasks failed:", error);
    await logOperationError({
      operation: "create",
      resourceType: "task",
      summary: "Failed to create task",
      error,
      userId: user.id,
      username: user.username,
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create task." },
      { status: 500 },
    );
  }
}
