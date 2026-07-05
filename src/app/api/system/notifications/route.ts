import { NextResponse } from "next/server";
import { isAuthError, requireAdminAccess } from "@/lib/api-auth";
import {
  archiveNotificationAdmin,
  deleteNotificationAdmin,
  deleteNotificationsAdmin,
  listAllNotifications,
  setNotificationReadAdmin,
  unarchiveNotificationAdmin,
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
  const actor = await requireAdminAccess();
  if (isAuthError(actor)) return actor;

  const body = (await request.json()) as {
    id?: number;
    archive?: boolean;
    read?: boolean;
  };
  if (typeof body.id !== "number") {
    return NextResponse.json({ error: "Notification id is required." }, { status: 400 });
  }

  if (body.archive === true) {
    await archiveNotificationAdmin(body.id);
    return NextResponse.json({ ok: true });
  }

  if (body.archive === false) {
    await unarchiveNotificationAdmin(body.id);
    return NextResponse.json({ ok: true });
  }

  if (typeof body.read === "boolean") {
    await setNotificationReadAdmin(body.id, body.read);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid request" }, { status: 400 });
}

export async function DELETE(request: Request) {
  const actor = await requireAdminAccess();
  if (isAuthError(actor)) return actor;

  const { searchParams } = new URL(request.url);
  const idsParam = searchParams.get("ids");
  if (idsParam) {
    const ids = idsParam
      .split(",")
      .map((value) => Number(value.trim()))
      .filter((id) => Number.isFinite(id) && id > 0);
    if (ids.length === 0) {
      return NextResponse.json({ error: "Notification ids are required." }, { status: 400 });
    }
    await deleteNotificationsAdmin(ids);
    return NextResponse.json({ ok: true, deleted: ids.length });
  }

  const id = Number(searchParams.get("id"));
  if (!id) {
    return NextResponse.json({ error: "Notification id is required." }, { status: 400 });
  }

  await deleteNotificationAdmin(id);
  return NextResponse.json({ ok: true });
}
