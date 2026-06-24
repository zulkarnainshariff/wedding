import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth";
import { validatePassword } from "@/lib/password-policy";
import { requireAdminAccess, isAuthError } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { normalizePermissions, normalizeViewTravellers, type UserPermissions } from "@/lib/permissions";
import { users } from "@/lib/schema";
import { CATEGORIES, type Category } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

function serializeUser(user: typeof users.$inferSelect) {
  return {
    id: user.id,
    username: user.username,
    isAdmin: user.isAdmin,
    permissions: normalizePermissions(user.permissions, user.isAdmin, user.username),
    createdAt: user.createdAt,
  };
}

export async function PUT(request: Request, { params }: Params) {
  const sessionUser = await requireAdminAccess();
  if (isAuthError(sessionUser)) return sessionUser;

  const { id } = await params;
  const userId = Number(id);
  const body = await request.json();

  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const isAdmin =
    userId === sessionUser.id ? existing.isAdmin : Boolean(body.isAdmin);
  const permissions = parsePermissionsBody(
    body.permissions,
    isAdmin,
    existing.username,
  );
  const password = String(body.password ?? "").trim();

  if (password) {
    const passwordError = validatePassword(password);
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 });
    }
  }

  const [updated] = await db
    .update(users)
    .set({
      isAdmin,
      permissions,
      ...(password
        ? {
            passwordHash: await hashPassword(password),
            tokenVersion: existing.tokenVersion + 1,
          }
        : {}),
    })
    .where(eq(users.id, userId))
    .returning();

  return NextResponse.json(serializeUser(updated));
}

export async function DELETE(_request: Request, { params }: Params) {
  const sessionUser = await requireAdminAccess();
  if (isAuthError(sessionUser)) return sessionUser;

  const { id } = await params;
  const userId = Number(id);

  if (userId === sessionUser.id) {
    return NextResponse.json(
      { error: "You cannot delete your own account" },
      { status: 400 },
    );
  }

  const [deleted] = await db
    .delete(users)
    .where(eq(users.id, userId))
    .returning();

  if (!deleted) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

function parsePermissionsBody(
  raw: unknown,
  isAdmin: boolean,
  username: string,
): UserPermissions {
  if (isAdmin) {
    return normalizePermissions({}, true, username);
  }

  if (!raw || typeof raw !== "object") {
    return normalizePermissions({}, false, username);
  }

  const value = raw as Partial<UserPermissions>;
  const viewAllCategories = value.viewCategories === "all";
  const viewCategories: UserPermissions["viewCategories"] = viewAllCategories
    ? "all"
    : Array.isArray(value.viewCategories)
      ? value.viewCategories.filter((c): c is Category =>
          CATEGORIES.includes(c as Category),
        )
      : ["activity"];

  const viewTravellers =
    value.viewTravellers === "all"
      ? "all"
      : normalizeViewTravellers(value.viewTravellers, username);

  return {
    viewCategories,
    viewTravellers,
    canEdit: Boolean(value.canEdit),
    canManageUsers: Boolean(value.canManageUsers),
  };
}
