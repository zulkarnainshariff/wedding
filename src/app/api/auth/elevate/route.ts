import { NextResponse } from "next/server";
import { verifyAdminElevationPassword } from "@/lib/admin-elevation";
import { logAuditEvent } from "@/lib/activity-log";
import { isAuthError, requireAuth } from "@/lib/api-auth";
import {
  getUserById,
  issueSessionForUser,
  setSessionCookie,
} from "@/lib/auth";
import { isAdminSession } from "@/lib/role-levels";

export async function POST(request: Request) {
  const user = await requireAuth();
  if (isAuthError(user)) return user;

  if (isAdminSession(user.roleLevel)) {
    return NextResponse.json(
      { error: "You already have admin access" },
      { status: 400 },
    );
  }

  if (user.elevatedAdmin) {
    return NextResponse.json({ ok: true, elevatedAdmin: true });
  }

  const body = await request.json();
  const password = String(body.password ?? "");

  if (!password) {
    return NextResponse.json(
      { error: "Admin password is required" },
      { status: 400 },
    );
  }

  const valid = await verifyAdminElevationPassword(password);
  if (!valid) {
    return NextResponse.json({ error: "Invalid admin password" }, { status: 401 });
  }

  const row = await getUserById(user.id);
  if (!row) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const token = await issueSessionForUser(row, { adminElevated: true });

  try {
    await logAuditEvent({
      user,
      action: "update",
      resourceType: "session",
      resourceId: user.id,
      summary: `${user.username} elevated to admin privileges`,
      metadata: { elevatedAdmin: true },
    });
  } catch (error) {
    console.error("Admin elevation audit log failed:", error);
  }

  const response = NextResponse.json({ ok: true, elevatedAdmin: true });
  setSessionCookie(response, token);
  return response;
}
