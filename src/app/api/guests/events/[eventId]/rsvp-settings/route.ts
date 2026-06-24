import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getAuthUser } from "@/lib/api-auth";
import { canEditGuestList, getRsvpSettingsForEvent } from "@/lib/guest-queries";
import { db } from "@/lib/db";
import { eventRsvpSettings } from "@/lib/schema";

type Params = { params: Promise<{ eventId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { eventId: rawId } = await params;
  const eventId = Number(rawId);
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await canEditGuestList(user, eventId)) && !user.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const settings = await getRsvpSettingsForEvent(eventId);
  return NextResponse.json(settings);
}

export async function PUT(request: Request, { params }: Params) {
  const { eventId: rawId } = await params;
  const eventId = Number(rawId);
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await canEditGuestList(user, eventId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const deadline = body.rsvpDeadline
    ? new Date(body.rsvpDeadline)
    : null;

  await db
    .insert(eventRsvpSettings)
    .values({
      eventId,
      rsvpEnabled: Boolean(body.rsvpEnabled),
      rsvpDeadline: deadline,
      contactName: body.contactName ?? null,
      contactPhone: body.contactPhone ?? null,
      contactEmail: body.contactEmail ?? null,
    })
    .onConflictDoUpdate({
      target: eventRsvpSettings.eventId,
      set: {
        rsvpEnabled: Boolean(body.rsvpEnabled),
        rsvpDeadline: deadline,
        contactName: body.contactName ?? null,
        contactPhone: body.contactPhone ?? null,
        contactEmail: body.contactEmail ?? null,
      },
    });

  const settings = await getRsvpSettingsForEvent(eventId);
  return NextResponse.json(settings);
}
