import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { canManageUsers } from "@/lib/permissions";
import { getAuthUser } from "@/lib/api-auth";
import { getAllUsersBrief, getTaskPermissionsAdmin } from "@/lib/task-queries";
import { db } from "@/lib/db";
import { taskPermissions } from "@/lib/schema";

type Params = { params: Promise<{ eventId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const user = await getAuthUser();
  if (!user || !canManageUsers(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { eventId: rawId } = await params;
  const eventId = Number(rawId);
  const [permissions, users] = await Promise.all([
    getTaskPermissionsAdmin(eventId),
    getAllUsersBrief(),
  ]);

  return NextResponse.json({ permissions, users });
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
    canAssign: boolean;
    canAssignForOthers: boolean;
    canViewOthersTasks: boolean;
  }[] = Array.isArray(body.permissions) ? body.permissions : [];

  await db.delete(taskPermissions).where(eq(taskPermissions.eventId, eventId));

  const active = entries.filter(
    (entry) => entry.canAssign || entry.canAssignForOthers || entry.canViewOthersTasks,
  );

  if (active.length) {
    await db.insert(taskPermissions).values(
      active.map((entry) => ({
        eventId,
        userId: entry.userId,
        canAssign: entry.canAssign,
        canAssignForOthers: entry.canAssignForOthers,
        canViewOthersTasks: entry.canViewOthersTasks,
      })),
    );
  }

  const permissions = await getTaskPermissionsAdmin(eventId);
  return NextResponse.json(permissions);
}
