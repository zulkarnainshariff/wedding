import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { isAuthError, requireAuth } from "@/lib/api-auth";
import { logAuditEvent } from "@/lib/activity-log";
import {
  getGuestbookEntryById,
  serializeGuestbookEntry,
} from "@/lib/guestbook-queries";
import { canModerateGuestbook } from "@/lib/permissions";
import { db } from "@/lib/db";
import { guestbookEntries } from "@/lib/schema";

type Params = { params: Promise<{ id: string }> };

async function requireGuestbookModerator() {
  const user = await requireAuth();
  if (isAuthError(user)) return user;
  if (!canModerateGuestbook(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return user;
}

export async function PATCH(request: Request, { params }: Params) {
  const user = await requireGuestbookModerator();
  if (user instanceof NextResponse) return user;

  const { id } = await params;
  const entryId = Number(id);
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
  const user = await requireGuestbookModerator();
  if (user instanceof NextResponse) return user;

  const { id } = await params;
  const entryId = Number(id);
  const existing = await getGuestbookEntryById(entryId);
  if (!existing) {
    return NextResponse.json({ error: "Entry not found." }, { status: 404 });
  }

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
