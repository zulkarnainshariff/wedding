import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getAuthUser } from "@/lib/api-auth";
import { logOperationError } from "@/lib/error-log";
import { canEditGuestList, getGuestsForEvent } from "@/lib/guest-queries";
import { isRsvpStatus } from "@/lib/guest-list-types";
import { db } from "@/lib/db";
import { guestMembers, guests } from "@/lib/schema";

type Params = { params: Promise<{ guestId: string }> };

function resolveRsvpAttendingCount(
  rsvpStatus: string,
  body: Record<string, unknown>,
  existing: typeof guests.$inferSelect,
  expectedHeadcount: number,
): number | null {
  if (rsvpStatus !== "attending") return null;

  if (body.rsvpAttendingCount !== undefined && body.rsvpAttendingCount !== null) {
    return Math.max(1, Number(body.rsvpAttendingCount) || expectedHeadcount);
  }

  if (existing.rsvpStatus === "attending" && existing.rsvpAttendingCount != null) {
    return existing.rsvpAttendingCount;
  }

  return expectedHeadcount;
}

export async function PUT(request: Request, { params }: Params) {
  const { guestId: rawId } = await params;
  const guestId = Number(rawId);

  const [existing] = await db
    .select()
    .from(guests)
    .where(eq(guests.id, guestId))
    .limit(1);
  if (!existing) {
    return NextResponse.json({ error: "Guest not found" }, { status: 404 });
  }

  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await canEditGuestList(user, existing.eventId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const members: { name: string }[] = Array.isArray(body.members) ? body.members : [];
    const expectedHeadcount = Math.max(
      1,
      Number(body.expectedHeadcount) || existing.expectedHeadcount,
    );
    const rsvpStatus = isRsvpStatus(body.rsvpStatus)
      ? body.rsvpStatus
      : existing.rsvpStatus;

    await db
      .update(guests)
      .set({
        label: body.label ?? existing.label,
        allowIncludeFamily:
          body.allowIncludeFamily ?? existing.allowIncludeFamily,
        expectedHeadcount,
        rsvpStatus,
        rsvpAttendingCount: resolveRsvpAttendingCount(
          rsvpStatus,
          body,
          existing,
          expectedHeadcount,
        ),
        rsvpNotes:
          body.rsvpNotes !== undefined ? body.rsvpNotes : existing.rsvpNotes,
        adminNotes:
          body.adminNotes !== undefined ? body.adminNotes : existing.adminNotes,
        contactEmail:
          body.contactEmail !== undefined
            ? body.contactEmail
            : existing.contactEmail,
        sortOrder:
          body.sortOrder !== undefined ? body.sortOrder : existing.sortOrder,
        updatedAt: new Date(),
      })
      .where(eq(guests.id, guestId));

    await db.delete(guestMembers).where(eq(guestMembers.guestId, guestId));
    if (members.length > 0) {
      await db.insert(guestMembers).values(
        members.map((member, index) => ({
          guestId,
          name: member.name,
          sortOrder: index,
        })),
      );
    }

    const full = await getGuestsForEvent(existing.eventId);
    const guest = full.find((entry) => entry.id === guestId);
    return NextResponse.json(guest);
  } catch (error) {
    console.error("PUT /api/guests/[guestId] failed:", error);
    await logOperationError({
      operation: "update",
      resourceType: "guest",
      resourceId: guestId,
      summary: "Failed to update guest",
      error,
      userId: user.id,
      username: user.username,
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save guest." },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const { guestId: rawId } = await params;
  const guestId = Number(rawId);

  const [existing] = await db
    .select()
    .from(guests)
    .where(eq(guests.id, guestId))
    .limit(1);
  if (!existing) {
    return NextResponse.json({ error: "Guest not found" }, { status: 404 });
  }

  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await canEditGuestList(user, existing.eventId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await db.delete(guests).where(eq(guests.id, guestId));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/guests/[guestId] failed:", error);
    await logOperationError({
      operation: "delete",
      resourceType: "guest",
      resourceId: guestId,
      summary: "Failed to delete guest",
      error,
      userId: user.id,
      username: user.username,
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete guest." },
      { status: 500 },
    );
  }
}
