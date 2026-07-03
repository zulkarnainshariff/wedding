import { NextResponse } from "next/server";
import {
  isAuthError,
  requireAdminAccess,
  requireSuperuserAccess,
} from "@/lib/api-auth";
import {
  archiveNotificationAdmin,
  deleteNotificationAdmin,
  listAllNotifications,
} from "@/lib/notification-service";

export async function GET(request: Request) {
  const actor = await requireAdminAccess();
  if (isAuthError(actor)) return actor;

  const { searchParams } = new URL(request.url);
  const includeArchived = searchParams.get("includeArchived") === "true";
  const username = searchParams.get("username") ?? undefined;

  const items = await listAllNotifications({ includeArchived, username });
  return NextResponse.json({ items });
}

export async function PATCH(request: Request) {
  const actor = await requireSuperuserAccess();
  if (isAuthError(actor)) return actor;

  const body = (await request.json()) as { id?: number; archive?: boolean };
  if (typeof body.id !== "number") {
    return NextResponse.json({ error: "Notification id is required." }, { status: 400 });
  }

  if (body.archive) {
    await archiveNotificationAdmin(body.id);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid request" }, { status: 400 });
}

export async function DELETE(request: Request) {
  const actor = await requireSuperuserAccess();
  if (isAuthError(actor)) return actor;

  const { searchParams } = new URL(request.url);
  const id = Number(searchParams.get("id"));
  if (!id) {
    return NextResponse.json({ error: "Notification id is required." }, { status: 400 });
  }

  await deleteNotificationAdmin(id);
  return NextResponse.json({ ok: true });
}
