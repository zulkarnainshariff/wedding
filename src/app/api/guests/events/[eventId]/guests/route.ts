import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { getAuthUser, isAuthError } from "@/lib/api-auth";
import {
  canEditGuestList,
  canViewGuestList,
  getGuestsForEvent,
} from "@/lib/guest-queries";
import { isRsvpStatus } from "@/lib/guest-list-types";
import { db } from "@/lib/db";
import { guestMembers, guests } from "@/lib/schema";

type Params = { params: Promise<{ eventId: string }> };

async function requireView(eventId: number) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await canViewGuestList(user, eventId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return user;
}

async function requireEdit(eventId: number) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await canEditGuestList(user, eventId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return user;
}

export async function GET(_request: Request, { params }: Params) {
  const { eventId: rawId } = await params;
  const eventId = Number(rawId);
  const user = await requireView(eventId);
  if (user instanceof NextResponse) return user;

  const guestList = await getGuestsForEvent(eventId);
  return NextResponse.json(guestList);
}

export async function POST(request: Request, { params }: Params) {
  const { eventId: rawId } = await params;
  const eventId = Number(rawId);
  const user = await requireEdit(eventId);
  if (user instanceof NextResponse) return user;

  const body = await request.json();
  const members: { name: string }[] = Array.isArray(body.members) ? body.members : [];

  const [created] = await db
    .insert(guests)
    .values({
      eventId,
      inviteToken: randomUUID(),
      label: body.label,
      allowIncludeFamily: Boolean(body.allowIncludeFamily),
      expectedHeadcount: Math.max(1, Number(body.expectedHeadcount) || 1),
      rsvpStatus: isRsvpStatus(body.rsvpStatus) ? body.rsvpStatus : "not_responded",
      adminNotes: body.adminNotes ?? null,
      contactEmail: body.contactEmail ?? null,
      sortOrder: Number(body.sortOrder) || 0,
    })
    .returning();

  if (members.length > 0) {
    await db.insert(guestMembers).values(
      members.map((member, index) => ({
        guestId: created.id,
        name: member.name,
        sortOrder: index,
      })),
    );
  }

  const full = await getGuestsForEvent(eventId);
  const guest = full.find((entry) => entry.id === created.id);
  return NextResponse.json(guest, { status: 201 });
}
