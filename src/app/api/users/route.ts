import { asc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth";
import { requireAdminAccess, isAuthError } from "@/lib/api-auth";
import { validatePassword } from "@/lib/password-policy";
import { db } from "@/lib/db";
import {
  DEFAULT_PERMISSIONS,
  isSuperuser,
  normalizePermissions,
  normalizeViewTravellers,
  type UserPermissions,
} from "@/lib/permissions";
import { roleLevelFromDb, ROLE_ADMIN, ROLE_USER } from "@/lib/role-levels";
import { users } from "@/lib/schema";
import { loadGuardianUserIdsByWard } from "@/lib/user-guardians-server";
import { CATEGORIES, type Category } from "@/lib/types";

async function serializeUser(user: typeof users.$inferSelect) {
  const guardianMap = await loadGuardianUserIdsByWard([user.id]);
  return {
    id: user.id,
    username: user.username,
    isAdmin: user.isAdmin,
    permissions: normalizePermissions(user.permissions, user.isAdmin, user.username),
    guardianUserIds: guardianMap.get(user.id) ?? [],
    createdAt: user.createdAt,
  };
}

export async function GET() {
  const user = await requireAdminAccess();
  if (isAuthError(user)) return user;

  const rows = await db.select().from(users).orderBy(asc(users.username));
  const visible = isSuperuser(user)
    ? rows
    : rows.filter((row) => roleLevelFromDb(row.roleLevel, row.isAdmin) !== 0);
  const guardianMap = await loadGuardianUserIdsByWard(visible.map((row) => row.id));
  return NextResponse.json(
    visible.map((row) => ({
      id: row.id,
      username: row.username,
      isAdmin: row.isAdmin,
      permissions: normalizePermissions(row.permissions, row.isAdmin, row.username),
      guardianUserIds: guardianMap.get(row.id) ?? [],
      createdAt: row.createdAt,
    })),
  );
}

export async function POST(request: Request) {
  const user = await requireAdminAccess();
  if (isAuthError(user)) return user;

  const body = await request.json();
  const username = String(body.username ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const isAdmin = Boolean(body.isAdmin);
  if (isAdmin && !isSuperuser(user)) {
    return NextResponse.json(
      { error: "Only platform operators can grant admin access" },
      { status: 403 },
    );
  }

  if (!username || !password) {
    return NextResponse.json(
      { error: "Username and password are required" },
      { status: 400 },
    );
  }

  const passwordError = validatePassword(password);
  if (passwordError) {
    return NextResponse.json({ error: passwordError }, { status: 400 });
  }

  const permissions = parsePermissionsBody(body.permissions, isAdmin, username);
  const passwordHash = await hashPassword(password);

  try {
    const [created] = await db
      .insert(users)
      .values({
        username,
        passwordHash,
        isAdmin,
        roleLevel: isAdmin ? ROLE_ADMIN : ROLE_USER,
        permissions,
      })
      .returning();

    return NextResponse.json(await serializeUser(created), { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Username already exists" },
      { status: 409 },
    );
  }
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
      ? value.viewCategories.filter(
          (c): c is Category => typeof c === "string" && c.trim().length > 0,
        )
      : DEFAULT_PERMISSIONS.viewCategories;

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
