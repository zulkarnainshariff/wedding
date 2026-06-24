import { NextResponse } from "next/server";
import { getSessionUser, hashPassword, issueSessionForUser, setSessionCookie, verifyPassword } from "@/lib/auth";
import { requireAuth, isAuthError } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { normalizeUserPreferences } from "@/lib/user-preferences";
import { validatePassword } from "@/lib/password-policy";
import { users } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const user = await requireAuth();
  if (isAuthError(user)) return user;

  const [row] = await db
    .select({ preferences: users.preferences })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  return NextResponse.json({
    preferences: normalizeUserPreferences(row?.preferences),
  });
}

export async function PUT(request: Request) {
  const user = await requireAuth();
  if (isAuthError(user)) return user;

  const body = await request.json();

  const [row] = await db
    .select({ preferences: users.preferences })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  const preferences = normalizeUserPreferences({
    ...normalizeUserPreferences(row?.preferences),
    ...(body.preferences ?? {}),
  });

  await db
    .update(users)
    .set({ preferences })
    .where(eq(users.id, user.id));

  return NextResponse.json({ preferences });
}

export async function PATCH(request: Request) {
  const user = await requireAuth();
  if (isAuthError(user)) return user;

  const body = await request.json();
  const currentPassword = String(body.currentPassword ?? "");
  const newPassword = String(body.newPassword ?? "");

  if (!currentPassword || !newPassword) {
    return NextResponse.json(
      { error: "Current and new password are required" },
      { status: 400 },
    );
  }

  const [row] = await db
    .select()
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const valid = await verifyPassword(currentPassword, row.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });
  }

  const passwordError = validatePassword(newPassword);
  if (passwordError) {
    return NextResponse.json({ error: passwordError }, { status: 400 });
  }

  const passwordHash = await hashPassword(newPassword);
  const [updated] = await db
    .update(users)
    .set({
      passwordHash,
      tokenVersion: row.tokenVersion + 1,
    })
    .where(eq(users.id, user.id))
    .returning();

  const token = await issueSessionForUser(updated);
  const response = NextResponse.json({ ok: true });
  setSessionCookie(response, token);
  return response;
}
