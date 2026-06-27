import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth";
import { logAuditEvent } from "@/lib/activity-log";
import { isAuthError, requireSuperuserAccess } from "@/lib/api-auth";
import { validatePassword } from "@/lib/password-policy";
import { db } from "@/lib/db";
import { ROLE_ADMIN, ROLE_USER } from "@/lib/role-levels";
import { ADMIN_PERMISSIONS } from "@/lib/permissions";
import { users } from "@/lib/schema";

export async function GET() {
  const user = await requireSuperuserAccess();
  if (isAuthError(user)) return user;

  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      roleLevel: users.roleLevel,
    })
    .from(users)
    .where(eq(users.roleLevel, ROLE_ADMIN))
    .orderBy(asc(users.username));

  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const actor = await requireSuperuserAccess();
  if (isAuthError(actor)) return actor;

  const body = await request.json();
  const username = String(body.username ?? "").trim().toLowerCase();
  const password = String(body.password ?? "").trim();

  if (!username) {
    return NextResponse.json({ error: "Username is required" }, { status: 400 });
  }

  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  if (existing) {
    if (existing.roleLevel === 0) {
      return NextResponse.json(
        { error: "Cannot modify platform operator accounts here" },
        { status: 400 },
      );
    }

    const [updated] = await db
      .update(users)
      .set({
        isAdmin: true,
        roleLevel: ROLE_ADMIN,
        permissions: ADMIN_PERMISSIONS,
      })
      .where(eq(users.id, existing.id))
      .returning();

    await logAuditEvent({
      user: actor,
      action: "update",
      resourceType: "user",
      resourceId: updated.id,
      summary: `Granted admin access to ${updated.username}`,
    });

    return NextResponse.json({
      id: updated.id,
      username: updated.username,
      roleLevel: updated.roleLevel,
    });
  }

  if (!password) {
    return NextResponse.json(
      { error: "Password is required for new admin accounts" },
      { status: 400 },
    );
  }

  const passwordError = validatePassword(password);
  if (passwordError) {
    return NextResponse.json({ error: passwordError }, { status: 400 });
  }

  const [created] = await db
    .insert(users)
    .values({
      username,
      passwordHash: await hashPassword(password),
      isAdmin: true,
      roleLevel: ROLE_ADMIN,
      permissions: ADMIN_PERMISSIONS,
    })
    .returning();

  await logAuditEvent({
    user: actor,
    action: "create",
    resourceType: "user",
    resourceId: created.id,
    summary: `Created admin account ${created.username}`,
  });

  return NextResponse.json(
    {
      id: created.id,
      username: created.username,
      roleLevel: created.roleLevel,
    },
    { status: 201 },
  );
}
