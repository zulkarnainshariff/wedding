import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { isAuthError, requireAuth } from "@/lib/api-auth";
import { createNotification } from "@/lib/notification-service";
import {
  canAssignOnAnyEvent,
  getMaxDueDate,
  getTaskPermissionsForUser,
  getVisibleTasks,
  resolveAssignEventId,
} from "@/lib/task-queries";
import { db } from "@/lib/db";
import { itineraryItems, taskReminders, tasks } from "@/lib/schema";

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

  const body = await request.json();
  const itemId = body.itemId ? Number(body.itemId) : null;

  if (!itemId) {
    return NextResponse.json(
      { error: "Tasks must be linked to an itinerary item." },
      { status: 400 },
    );
  }

  const [item] = await db
    .select()
    .from(itineraryItems)
    .where(eq(itineraryItems.id, itemId))
    .limit(1);

  if (!item) {
    return NextResponse.json({ error: "Itinerary item not found." }, { status: 404 });
  }

  if (!(await canAssignOnAnyEvent(user))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const eventId = await resolveAssignEventId(user);
  if (!eventId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
  const dayId = body.dayId ?? item.dayId ?? null;
  const maxDue = await getMaxDueDate(dayId, itemId);
  if (maxDue && dueAt && dueAt > maxDue) dueAt = maxDue;

  const [created] = await db
    .insert(tasks)
    .values({
      eventId,
      dayId,
      itemId,
      parentTaskId: body.parentTaskId ?? null,
      title: body.title,
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
      href: `/itinerary?item=${itemId}&task=${created.id}`,
      metadata: { taskId: created.id, urgent: Boolean(body.isUrgent), itemId },
    });
  } catch (error) {
    console.error("Task created but notification failed:", error);
  }

  if (body.remindAt) {
    try {
      await db.insert(taskReminders).values({
        taskId: created.id,
        userId: user.id,
        remindAt: new Date(body.remindAt),
      });
    } catch (error) {
      console.error("Task created but reminder failed:", error);
    }
  }

  return NextResponse.json(created, { status: 201 });
}
