import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { isAuthError, requireAuth } from "@/lib/api-auth";
import { createNotification } from "@/lib/notification-service";
import {
  canAssignTasks,
  getTaskWithDetails,
} from "@/lib/task-queries";
import { isTaskStatus } from "@/lib/task-types";
import { db } from "@/lib/db";
import { taskNotes, taskReminders, tasks } from "@/lib/schema";

type Params = { params: Promise<{ taskId: string }> };

function taskHref(task: { id: number; itemId: number | null }) {
  return task.itemId ? `/itinerary?item=${task.itemId}` : `/tasks?task=${task.id}`;
}

async function notifyCounterparty(
  actorId: number,
  task: {
    id: number;
    itemId: number | null;
    assigneeUserId: number;
    createdByUserId: number;
    title: string;
  },
  type: string,
  title: string,
  body: string,
) {
  const recipientId =
    actorId === task.assigneeUserId ? task.createdByUserId : task.assigneeUserId;
  if (recipientId === actorId) return;
  await createNotification({
    userId: recipientId,
    type,
    title,
    body,
    href: taskHref(task),
    metadata: { taskId: task.id, itemId: task.itemId },
  });
}

export async function GET(_request: Request, { params }: Params) {
  const user = await requireAuth();
  if (isAuthError(user)) return user;

  const { taskId: rawId } = await params;
  const taskId = Number(rawId);
  const details = await getTaskWithDetails(taskId);
  if (!details) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const canAccess =
    user.isAdmin ||
    details.task.assigneeUserId === user.id ||
    details.task.createdByUserId === user.id ||
    (await canAssignTasks(user, details.task.eventId));

  if (!canAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(details);
}

export async function PUT(request: Request, { params }: Params) {
  const user = await requireAuth();
  if (isAuthError(user)) return user;

  const { taskId: rawId } = await params;
  const taskId = Number(rawId);
  const details = await getTaskWithDetails(taskId);
  if (!details) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const isAssignee = details.task.assigneeUserId === user.id;
  const isCreator = details.task.createdByUserId === user.id;
  const canManage =
    user.isAdmin ||
    isCreator ||
    (await canAssignTasks(user, details.task.eventId));

  if (!isAssignee && !canManage) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const patch: Partial<typeof details.task> = { updatedAt: new Date() };
  let taskWasEdited = false;

  if (isAssignee && body.status && isTaskStatus(body.status)) {
    if (body.status === "cant_complete") {
      const reason = String(body.statusReason ?? "").trim();
      if (!reason) {
        return NextResponse.json(
          { error: "A reason is required when marking a task as can't complete." },
          { status: 400 },
        );
      }
      patch.status = "cant_complete";
      patch.statusReason = reason;
    } else {
      patch.status = body.status;
      if (body.status !== "cant_complete") {
        patch.statusReason = null;
      }
    }
    taskWasEdited = true;
  }

  if (canManage) {
    if (body.title) {
      patch.title = body.title;
      taskWasEdited = true;
    }
    if (body.assignerNotes !== undefined) {
      patch.assignerNotes = body.assignerNotes;
      taskWasEdited = true;
    }
    if (body.dueAt !== undefined) {
      patch.dueAt = body.dueAt ? new Date(body.dueAt) : null;
      taskWasEdited = true;
    }
    if (body.allowSubtasks !== undefined) patch.allowSubtasks = body.allowSubtasks;
    if (body.allowTaggedNotes !== undefined) patch.allowTaggedNotes = body.allowTaggedNotes;
    if (body.allowAssigneeEdit !== undefined) {
      patch.allowAssigneeEdit = body.allowAssigneeEdit;
      taskWasEdited = true;
    }
    if (body.assigneeUserId !== undefined) {
      const nextAssignee = Number(body.assigneeUserId);
      if (nextAssignee && nextAssignee !== details.task.assigneeUserId) {
        patch.assigneeUserId = nextAssignee;
        taskWasEdited = true;
      }
    }
  } else if (isAssignee && details.task.allowAssigneeEdit) {
    if (body.title) {
      patch.title = body.title;
      taskWasEdited = true;
    }
    if (body.dueAt !== undefined) {
      patch.dueAt = body.dueAt ? new Date(body.dueAt) : null;
      taskWasEdited = true;
    }
    if (body.assignerNotes !== undefined) {
      patch.assignerNotes = body.assignerNotes;
      taskWasEdited = true;
    }
  }

  const [updated] =
    Object.keys(patch).length > 1
      ? await db.update(tasks).set(patch).where(eq(tasks.id, taskId)).returning()
      : [details.task];

  if (taskWasEdited && updated) {
    await notifyCounterparty(
      user.id,
      updated,
      "task_updated",
      "Task updated",
      `${user.username} updated "${updated.title}"`,
    );
  }

  if (body.note && typeof body.note === "string") {
    const taggedUserId = body.taggedUserId ? Number(body.taggedUserId) : null;
    if (taggedUserId && !details.task.allowTaggedNotes && !canManage) {
      return NextResponse.json({ error: "Tagging not allowed" }, { status: 403 });
    }

    await db.insert(taskNotes).values({
      taskId,
      authorUserId: user.id,
      content: body.note,
      taggedUserId,
    });

    await notifyCounterparty(
      user.id,
      details.task,
      "task_note_added",
      "New task note",
      body.note,
    );

    if (taggedUserId) {
      await createNotification({
        userId: taggedUserId,
        type: "task_note",
        title: "You were mentioned on a task",
        body: body.note,
        href: taskHref(details.task),
        metadata: { taskId },
      });
    }
  }

  if (body.updateNote && typeof body.updateNote === "object") {
    const noteId = Number(body.updateNote.id);
    const content = String(body.updateNote.content ?? "").trim();
    if (!noteId || !content) {
      return NextResponse.json({ error: "Invalid note update." }, { status: 400 });
    }

    const [existing] = await db
      .select()
      .from(taskNotes)
      .where(and(eq(taskNotes.id, noteId), eq(taskNotes.taskId, taskId)))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Note not found." }, { status: 404 });
    }

    if (existing.authorUserId !== user.id && !canManage) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await db
      .update(taskNotes)
      .set({ content, updatedAt: new Date() })
      .where(eq(taskNotes.id, noteId));

    await notifyCounterparty(
      user.id,
      details.task,
      "task_note_updated",
      "Task note updated",
      content,
    );
  }

  if (body.deleteNote && typeof body.deleteNote === "object") {
    const noteId = Number(body.deleteNote.id);
    if (!noteId) {
      return NextResponse.json({ error: "Invalid note delete." }, { status: 400 });
    }

    if (!user.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [existing] = await db
      .select()
      .from(taskNotes)
      .where(and(eq(taskNotes.id, noteId), eq(taskNotes.taskId, taskId)))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Note not found." }, { status: 404 });
    }

    await db.delete(taskNotes).where(eq(taskNotes.id, noteId));
  }

  if (body.remindAt && canManage) {
    await db.insert(taskReminders).values({
      taskId,
      userId: user.id,
      remindAt: new Date(body.remindAt),
    });
  }

  if (body.subtask && details.task.allowSubtasks && isAssignee) {
    const sub = body.subtask;
    const [created] = await db
      .insert(tasks)
      .values({
        eventId: details.task.eventId,
        dayId: details.task.dayId,
        itemId: details.task.itemId,
        parentTaskId: taskId,
        title: sub.title,
        assignerNotes: sub.assignerNotes ?? null,
        assigneeUserId: Number(sub.assigneeUserId),
        createdByUserId: user.id,
        dueAt: sub.dueAt ? new Date(sub.dueAt) : null,
        allowSubtasks: Boolean(sub.allowSubtasks),
        allowTaggedNotes: Boolean(sub.allowTaggedNotes),
        allowAssigneeEdit: Boolean(sub.allowAssigneeEdit),
        isUrgent: Boolean(sub.isUrgent),
      })
      .returning();

    await createNotification({
      userId: created.assigneeUserId,
      type: sub.isUrgent ? "task_urgent" : "task_assigned",
      title: "Subtask assigned",
      body: created.title,
      href: taskHref(created),
      metadata: { taskId: created.id, urgent: Boolean(sub.isUrgent) },
    });
  }

  return NextResponse.json(updated);
}

export async function DELETE(_request: Request, { params }: Params) {
  const user = await requireAuth();
  if (isAuthError(user)) return user;

  const { taskId: rawId } = await params;
  const taskId = Number(rawId);
  const details = await getTaskWithDetails(taskId);
  if (!details) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const canManage =
    user.isAdmin ||
    details.task.createdByUserId === user.id ||
    (await canAssignTasks(user, details.task.eventId));

  if (!canManage) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db.delete(tasks).where(eq(tasks.id, taskId));
  return NextResponse.json({ ok: true });
}
