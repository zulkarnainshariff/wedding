import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { logAuditEvent } from "@/lib/activity-log";
import { isAuthError, requireSuperuserAccess } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { ROLE_USER } from "@/lib/role-levels";
import { DEFAULT_PERMISSIONS } from "@/lib/permissions";
import { users } from "@/lib/schema";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  const actor = await requireSuperuserAccess();
  if (isAuthError(actor)) return actor;

  const userId = Number((await params).id);
  if (userId === actor.id) {
    return NextResponse.json(
      { error: "You cannot modify your own operator account here" },
      { status: 400 },
    );
  }

  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (existing.roleLevel === 0) {
    return NextResponse.json(
      { error: "Cannot demote platform operator accounts" },
      { status: 400 },
    );
  }

  const [updated] = await db
    .update(users)
    .set({
      isAdmin: false,
      roleLevel: ROLE_USER,
      permissions: {
        ...DEFAULT_PERMISSIONS,
        viewTravellers: [existing.username],
      },
    })
    .where(eq(users.id, userId))
    .returning();

  await logAuditEvent({
    user: actor,
    action: "update",
    resourceType: "user",
    resourceId: updated.id,
    summary: `Revoked admin access for ${updated.username}`,
  });

  return NextResponse.json({ ok: true });
}
