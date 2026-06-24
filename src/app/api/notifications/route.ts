import { NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/api-auth";
import {
  getNotificationsForUser,
  getUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/notification-service";

export async function GET() {
  const user = await requireAuth();
  if (isAuthError(user)) return user;

  const [items, unreadCount] = await Promise.all([
    getNotificationsForUser(user.id),
    getUnreadCount(user.id),
  ]);

  return NextResponse.json({ items, unreadCount });
}

export async function PATCH(request: Request) {
  const user = await requireAuth();
  if (isAuthError(user)) return user;

  const body = await request.json();
  if (body.markAllRead) {
    await markAllNotificationsRead(user.id);
    return NextResponse.json({ ok: true });
  }

  if (typeof body.id === "number") {
    await markNotificationRead(user.id, body.id);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid request" }, { status: 400 });
}
