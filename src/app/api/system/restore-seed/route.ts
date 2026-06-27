import { NextResponse } from "next/server";
import { logAuditEvent } from "@/lib/activity-log";
import { isAuthError, requireSuperuserAccess } from "@/lib/api-auth";
import { wipeAndRestoreSeedFile } from "@/lib/database-restore";

export async function POST(request: Request) {
  const actor = await requireSuperuserAccess();
  if (isAuthError(actor)) return actor;

  const body = (await request.json()) as { filename?: string };
  const filename = String(body.filename ?? "").trim();

  if (!filename) {
    return NextResponse.json({ error: "Seed filename is required." }, { status: 400 });
  }

  try {
    const result = await wipeAndRestoreSeedFile(filename);

    await logAuditEvent({
      user: actor,
      action: "delete",
      resourceType: "database",
      summary: `Wiped database and restored from ${result.filename}`,
      metadata: {
        filename: result.filename,
        tablesTruncated: result.tablesTruncated,
      },
    });

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Database restore failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
