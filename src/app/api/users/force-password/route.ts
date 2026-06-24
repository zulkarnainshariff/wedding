import { inArray, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth";
import { validatePassword } from "@/lib/password-policy";
import { requireAdminAccess, isAuthError } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";

export async function POST(request: Request) {
  const admin = await requireAdminAccess();
  if (isAuthError(admin)) return admin;

  const body = await request.json();
  const userIds = Array.isArray(body.userIds)
    ? body.userIds.map((id: unknown) => Number(id)).filter((id: number) => id > 0)
    : [];
  const password = String(body.password ?? "");

  if (!userIds.length || !password) {
    return NextResponse.json(
      { error: "Select users and provide a new password" },
      { status: 400 },
    );
  }

  const passwordError = validatePassword(password);
  if (passwordError) {
    return NextResponse.json({ error: passwordError }, { status: 400 });
  }

  const passwordHash = await hashPassword(password);
  const rows = await db
    .select()
    .from(users)
    .where(inArray(users.id, userIds));

  await Promise.all(
    rows.map((row) =>
      db
        .update(users)
        .set({
          passwordHash,
          tokenVersion: row.tokenVersion + 1,
        })
        .where(eq(users.id, row.id)),
    ),
  );

  return NextResponse.json({ ok: true, count: rows.length });
}
