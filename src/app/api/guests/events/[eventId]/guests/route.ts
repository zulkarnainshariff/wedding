import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getAuthUser } from "@/lib/api-auth";
import { logAuditEvent } from "@/lib/activity-log";
import { logOperationError } from "@/lib/error-log";
import {
  canEditGuestList,
  canViewGuestList,
  getGuestsForEvent,
} from "@/lib/guest-queries";
import { isRsvpStatus } from "@/lib/guest-list-types";
import { notifyWeddingCoordinatorsOnGuestInvite } from "@/lib/notification-service";
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

  try {
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

    try {
      await notifyWeddingCoordinatorsOnGuestInvite({
        eventId,
        guestLabel: created.label,
        guestId: created.id,
      });
    } catch (notifyError) {
      console.error("Guest created but coordinator notification failed:", notifyError);
    }

    await logAuditEvent({
      user,
      action: "create",
      resourceType: "guest",
      resourceId: created.id,
      summary: `Created guest invite "${created.label}"`,
      metadata: { eventId },
    });

    const full = await getGuestsForEvent(eventId);
    const guest = full.find((entry) => entry.id === created.id);
    return NextResponse.json(guest, { status: 201 });
  } catch (error) {
    console.error("POST /api/guests/events/[eventId]/guests failed:", error);
    await logOperationError({
      operation: "create",
      resourceType: "guest",
      summary: "Failed to create guest invite",
      error,
      userId: user.id,
      username: user.username,
      metadata: { eventId },
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create guest." },
      { status: 500 },
    );
  }
}
