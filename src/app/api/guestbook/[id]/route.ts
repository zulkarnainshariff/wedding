import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { isAuthError, requireAuth } from "@/lib/api-auth";
import { logAuditEvent } from "@/lib/activity-log";
import {
  getGuestbookEntryById,
  serializeGuestbookEntry,
} from "@/lib/guestbook-queries";
import { canModerateGuestbookForEvent } from "@/lib/guest-queries";
import { db } from "@/lib/db";
import { guestbookEntries } from "@/lib/schema";

type Params = { params: Promise<{ id: string }> };

async function requireGuestbookModeratorForEntry(entryId: number) {
  const user = await requireAuth();
  if (isAuthError(user)) return user;
  const entry = await getGuestbookEntryById(entryId);
  if (!entry) {
    return NextResponse.json({ error: "Entry not found." }, { status: 404 });
  }
  if (!(await canModerateGuestbookForEvent(user, entry.eventId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return { user, entry };
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const entryId = Number(id);
  const auth = await requireGuestbookModeratorForEntry(entryId);
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;
  const body = (await request.json()) as { hidden?: boolean };

  const [updated] = await db
    .update(guestbookEntries)
    .set({ hidden: Boolean(body.hidden) })
    .where(eq(guestbookEntries.id, entryId))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Entry not found." }, { status: 404 });
  }

  const row = await getGuestbookEntryById(entryId);
  if (!row) {
    return NextResponse.json({ error: "Entry not found." }, { status: 404 });
  }

  await logAuditEvent({
    user,
    action: "update",
    resourceType: "guestbook_entry",
    resourceId: entryId,
    summary: `${body.hidden ? "Hid" : "Unhid"} guestbook message from ${row.name}`,
  });

  return NextResponse.json(serializeGuestbookEntry(row));
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  const entryId = Number(id);
  const auth = await requireGuestbookModeratorForEntry(entryId);
  if (auth instanceof NextResponse) return auth;
  const { user, entry: existing } = auth;

  await db.delete(guestbookEntries).where(eq(guestbookEntries.id, entryId));

  await logAuditEvent({
    user,
    action: "delete",
    resourceType: "guestbook_entry",
    resourceId: entryId,
    summary: `Deleted guestbook message from ${existing.name}`,
  });

  return NextResponse.json({ ok: true });
}
