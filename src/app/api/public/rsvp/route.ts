import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import {
  getGuestByToken,
  isRsvpExpired,
} from "@/lib/guest-queries";
import { isRsvpStatus } from "@/lib/guest-list-types";
import { notifyGuestListWatchers } from "@/lib/notification-service";
import { db } from "@/lib/db";
import { guestMembers, guests } from "@/lib/schema";

function clampAttendingCount(
  status: string,
  requested: number,
  maxHeadcount: number,
): number | null {
  if (status === "attending") {
    return Math.min(maxHeadcount, Math.max(1, requested || 1));
  }
  if (status === "not_attending") return 0;
  return null;
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const data = await getGuestByToken(token);
  if (!data) {
    return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
  }

  const { guest, event, members, rsvpSettings } = data;
  const expired =
    !rsvpSettings?.rsvpEnabled ||
    isRsvpExpired(rsvpSettings?.rsvpDeadline ?? null);

  return NextResponse.json({
    guest: {
      label: guest.label,
      allowIncludeFamily: guest.allowIncludeFamily,
      expectedHeadcount: guest.expectedHeadcount,
      rsvpStatus: guest.rsvpStatus,
      rsvpAttendingCount: guest.rsvpAttendingCount,
      rsvpNotes: guest.rsvpNotes,
      members: members.map((member) => ({ id: member.id, name: member.name })),
    },
    event: {
      name: event.name,
      eventDate: event.eventDate,
      location: event.location,
    },
    rsvpSettings: rsvpSettings
      ? {
          rsvpEnabled: rsvpSettings.rsvpEnabled,
          rsvpDeadline: rsvpSettings.rsvpDeadline,
          contactName: rsvpSettings.contactName,
          contactPhone: rsvpSettings.contactPhone,
          contactEmail: rsvpSettings.contactEmail,
        }
      : null,
    expired,
  });
}

export async function PUT(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const data = await getGuestByToken(token);
  if (!data) {
    return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
  }

  const { guest, event, rsvpSettings } = data;
  const expired =
    !rsvpSettings?.rsvpEnabled ||
    isRsvpExpired(rsvpSettings?.rsvpDeadline ?? null);

  if (expired) {
    return NextResponse.json(
      {
        error: "RSVP closed",
        contact: {
          name: rsvpSettings?.contactName,
          phone: rsvpSettings?.contactPhone,
          email: rsvpSettings?.contactEmail,
        },
      },
      { status: 403 },
    );
  }

  const body = await request.json();
  if (!isRsvpStatus(body.rsvpStatus)) {
    return NextResponse.json({ error: "Invalid RSVP status" }, { status: 400 });
  }

  const maxHeadcount = guest.expectedHeadcount;
  const attendingCount = clampAttendingCount(
    body.rsvpStatus,
    Number(body.rsvpAttendingCount),
    maxHeadcount,
  );

  let memberNames: string[] = Array.isArray(body.memberNames)
    ? body.memberNames
        .filter((name: unknown) => typeof name === "string" && name.trim())
        .map((name: string) => name.trim())
    : [];

  if (body.rsvpStatus === "attending") {
    memberNames = memberNames.slice(0, attendingCount ?? maxHeadcount);
  } else {
    memberNames = [];
  }

  const hadResponse = guest.rsvpStatus !== "not_responded";

  await db
    .update(guests)
    .set({
      rsvpStatus: body.rsvpStatus,
      rsvpAttendingCount: attendingCount,
      rsvpNotes: body.rsvpNotes ?? null,
      updatedAt: new Date(),
    })
    .where(eq(guests.id, guest.id));

  await db.delete(guestMembers).where(eq(guestMembers.guestId, guest.id));
  if (memberNames.length > 0) {
    await db.insert(guestMembers).values(
      memberNames.map((name, index) => ({
        guestId: guest.id,
        name,
        sortOrder: index,
      })),
    );
  }

  await notifyGuestListWatchers(
    guest.eventId,
    hadResponse ? "RSVP updated" : "New RSVP received",
    `${guest.label} — ${body.rsvpStatus.replaceAll("_", " ")}${
      attendingCount ? ` (${attendingCount} attending)` : ""
    }`,
    `/guests?event=${event.slug}&tab=summary`,
  );

  return NextResponse.json({ ok: true });
}
