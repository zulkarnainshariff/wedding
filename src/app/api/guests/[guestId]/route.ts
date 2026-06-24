import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getAuthUser } from "@/lib/api-auth";
import { canEditGuestList, getGuestsForEvent } from "@/lib/guest-queries";
import { isRsvpStatus } from "@/lib/guest-list-types";
import { db } from "@/lib/db";
import { guestMembers, guests } from "@/lib/schema";

type Params = { params: Promise<{ guestId: string }> };

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

  const body = await request.json();
  const members: { name: string }[] = Array.isArray(body.members) ? body.members : [];

  await db
    .update(guests)
    .set({
      label: body.label ?? existing.label,
      allowIncludeFamily:
        body.allowIncludeFamily ?? existing.allowIncludeFamily,
      expectedHeadcount: Math.max(
        1,
        Number(body.expectedHeadcount) || existing.expectedHeadcount,
      ),
      rsvpStatus: isRsvpStatus(body.rsvpStatus)
        ? body.rsvpStatus
        : existing.rsvpStatus,
      rsvpAttendingCount:
        body.rsvpAttendingCount !== undefined
          ? body.rsvpAttendingCount
          : existing.rsvpAttendingCount,
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

  await db.delete(guests).where(eq(guests.id, guestId));
  return NextResponse.json({ ok: true });
}
