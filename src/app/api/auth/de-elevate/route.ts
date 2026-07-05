import { NextResponse } from "next/server";
import { logAuditEvent } from "@/lib/activity-log";
import { isAuthError, requireAuth } from "@/lib/api-auth";
import {
  getUserById,
  issueSessionForUser,
  setSessionCookie,
} from "@/lib/auth";

export async function POST() {
  const user = await requireAuth();
  if (isAuthError(user)) return user;

  if (!user.elevatedAdmin) {
    return NextResponse.json({ ok: true, elevatedAdmin: false });
  }

  const row = await getUserById(user.id);
  if (!row) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const token = await issueSessionForUser(row, { adminElevated: false });

  try {
    await logAuditEvent({
      user,
      action: "update",
      resourceType: "session",
      resourceId: user.id,
      summary: `${user.username} dropped admin elevation`,
      metadata: { elevatedAdmin: false },
    });
  } catch (error) {
    console.error("Admin de-elevation audit log failed:", error);
  }

  const response = NextResponse.json({ ok: true, elevatedAdmin: false });
  setSessionCookie(response, token);
  return response;
}
