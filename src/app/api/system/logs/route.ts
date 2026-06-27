import { NextResponse } from "next/server";
import {
  deleteLogRows,
  deleteLogsInRange,
  listActiveUsers,
  listAuditLogs,
  listLoginLogs,
  listUsageLogs,
} from "@/lib/activity-log";
import { isAuthError, requireSuperuserAccess } from "@/lib/api-auth";

export async function GET(request: Request) {
  const user = await requireSuperuserAccess();
  if (isAuthError(user)) return user;

  const { searchParams } = new URL(request.url);
  const kind = searchParams.get("kind") ?? "login";
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const username = searchParams.get("username") ?? undefined;
  const resourceType = searchParams.get("resourceType") ?? undefined;
  const eventType = searchParams.get("eventType") ?? undefined;
  const activeOnly = searchParams.get("activeOnly") === "true";

  if (activeOnly) {
    const active = await listActiveUsers();
    return NextResponse.json({ active });
  }

  const range = {
    from: from ? new Date(from) : undefined,
    to: to ? new Date(to) : undefined,
    username,
    limit: 1000,
  };

  if (kind === "audit") {
    return NextResponse.json({
      rows: await listAuditLogs({ ...range, resourceType }),
    });
  }
  if (kind === "usage") {
    return NextResponse.json({
      rows: await listUsageLogs({ ...range, eventType }),
    });
  }

  return NextResponse.json({
    rows: await listLoginLogs(range),
  });
}

export async function DELETE(request: Request) {
  const user = await requireSuperuserAccess();
  if (isAuthError(user)) return user;

  const body = (await request.json()) as {
    kind: "login" | "audit" | "usage";
    ids?: number[];
    from?: string;
    to?: string;
  };

  if (!body.kind) {
    return NextResponse.json({ error: "kind is required" }, { status: 400 });
  }

  if (Array.isArray(body.ids) && body.ids.length > 0) {
    const deleted = await deleteLogRows({ kind: body.kind, ids: body.ids });
    return NextResponse.json({ deleted });
  }

  const deleted = await deleteLogsInRange({
    kind: body.kind,
    from: body.from ? new Date(body.from) : undefined,
    to: body.to ? new Date(body.to) : undefined,
  });

  return NextResponse.json({ deleted });
}
