import { NextResponse } from "next/server";
import {
  authenticateUser,
  issueSessionForUser,
  setSessionCookie,
} from "@/lib/auth";
import { logLoginFailed, startUserSession } from "@/lib/activity-log";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function POST(request: Request) {
  const body = await request.json();
  const username = String(body.username ?? "").trim();
  const password = String(body.password ?? "");

  if (!username || !password) {
    return NextResponse.json(
      { error: "Username and password are required" },
      { status: 400 },
    );
  }

  const sessionUser = await authenticateUser(username, password);
  if (!sessionUser) {
    await logLoginFailed(username, request);
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, sessionUser.id))
    .limit(1);

  if (!user) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const token = await issueSessionForUser(user);
  await startUserSession(sessionUser, "login", request);
  const response = NextResponse.json({
    user: {
      id: sessionUser.id,
      username: sessionUser.username,
      isAdmin: sessionUser.isAdmin,
      permissions: sessionUser.permissions,
      preferences: sessionUser.preferences,
    },
  });
  setSessionCookie(response, token);
  return response;
}
