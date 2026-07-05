import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { canManageUsers } from "@/lib/permissions";
import { getAuthUser } from "@/lib/api-auth";
import { canEditGuestList, getGuestListPermissionsForEvent } from "@/lib/guest-queries";
import { db } from "@/lib/db";
import { guestListPermissions, users } from "@/lib/schema";

type Params = { params: Promise<{ eventId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canManageUsers(user) && !(await canEditGuestList(user, Number((await params).eventId)))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { eventId: rawId } = await params;
  const eventId = Number(rawId);
  const permissions = await getGuestListPermissionsForEvent(eventId);
  const allUsers = await db
    .select({ id: users.id, username: users.username })
    .from(users)
    .orderBy(asc(users.username));

  return NextResponse.json({ permissions, users: allUsers });
}

export async function PUT(request: Request, { params }: Params) {
  const user = await getAuthUser();
  if (!user || !canManageUsers(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { eventId: rawId } = await params;
  const eventId = Number(rawId);
  const body = await request.json();
  const entries: {
    userId: number;
    canView: boolean;
    canEdit: boolean;
    isWeddingCoordinator: boolean;
    canModerateGuestbook: boolean;
  }[] = Array.isArray(body.permissions) ? body.permissions : [];

  await db
    .delete(guestListPermissions)
    .where(eq(guestListPermissions.eventId, eventId));

  const active = entries
    .map((entry) => ({
      ...entry,
      canView: entry.isWeddingCoordinator ? true : entry.canView,
      canEdit: entry.isWeddingCoordinator ? true : entry.canEdit,
      canModerateGuestbook: entry.isWeddingCoordinator
        ? true
        : entry.canModerateGuestbook,
    }))
    .filter(
      (entry) =>
        entry.canView ||
        entry.canEdit ||
        entry.isWeddingCoordinator ||
        entry.canModerateGuestbook,
    );
  if (active.length > 0) {
    await db.insert(guestListPermissions).values(
      active.map((entry) => ({
        eventId,
        userId: entry.userId,
        canView: entry.canView,
        canEdit: entry.canEdit,
        isWeddingCoordinator: entry.isWeddingCoordinator,
        canModerateGuestbook: entry.canModerateGuestbook,
      })),
    );
  }

  const permissions = await getGuestListPermissionsForEvent(eventId);
  return NextResponse.json(permissions);
}
