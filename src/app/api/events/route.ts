import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { logAuditEvent } from "@/lib/activity-log";
import { isAuthError, requireEditAccess } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { DEFAULT_CARD_FRONT } from "@/lib/invitation-types";
import { getScheduleItemsForEventAdmin } from "@/lib/public-queries";
import { eventRsvpSettings, weddingEvents } from "@/lib/schema";

function normalizeEventSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function slugFromName(name: string): string {
  const slug = normalizeEventSlug(name);
  return slug || "event";
}

function requireFullAdmin(
  user: Awaited<ReturnType<typeof requireEditAccess>>,
): NextResponse | null {
  if (user instanceof NextResponse) return user;
  if (!user.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

export async function GET() {
  const user = await requireEditAccess();
  if (isAuthError(user)) return user;

  const events = await db
    .select()
    .from(weddingEvents)
    .orderBy(asc(weddingEvents.sortOrder), asc(weddingEvents.id));

  const withSchedules = await Promise.all(
    events.map(async (event) => ({
      ...event,
      schedule: await getScheduleItemsForEventAdmin(event.id),
    })),
  );

  return NextResponse.json(withSchedules);
}

export async function POST(request: Request) {
  const user = await requireEditAccess();
  if (isAuthError(user)) return user;
  const forbidden = requireFullAdmin(user);
  if (forbidden) return forbidden;

  const body = await request.json();
  const name = String(body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "Event name is required." }, { status: 400 });
  }

  const slug = normalizeEventSlug(String(body.slug ?? "")) || slugFromName(name);
  const eventDate =
    String(body.eventDate ?? "").trim() ||
    new Date().toISOString().slice(0, 10);
  const location = String(body.location ?? "").trim() || null;

  const [existingSlug] = await db
    .select({ id: weddingEvents.id })
    .from(weddingEvents)
    .where(eq(weddingEvents.slug, slug))
    .limit(1);

  if (existingSlug) {
    return NextResponse.json(
      { error: `Slug "${slug}" is already in use.` },
      { status: 409 },
    );
  }

  const existingEvents = await db
    .select({ sortOrder: weddingEvents.sortOrder })
    .from(weddingEvents);

  const nextSort =
    typeof body.sortOrder === "number"
      ? body.sortOrder
      : existingEvents.reduce((max, row) => Math.max(max, row.sortOrder), -1) + 1;

  const [created] = await db
    .insert(weddingEvents)
    .values({
      name,
      slug,
      eventDate,
      location,
      cardFront: {
        ...DEFAULT_CARD_FRONT,
        dateLine: body.dateLine?.trim() || DEFAULT_CARD_FRONT.dateLine,
        location: location ?? DEFAULT_CARD_FRONT.location,
      },
      sortOrder: nextSort,
      published: body.published !== false,
    })
    .returning();

  await db
    .insert(eventRsvpSettings)
    .values({ eventId: created.id })
    .onConflictDoNothing();

  await logAuditEvent({
    user,
    action: "create",
    resourceType: "wedding_event",
    resourceId: created.id,
    summary: `Created invitation event ${created.name}`,
  });

  return NextResponse.json(
    { ...created, schedule: [] },
    { status: 201 },
  );
}
