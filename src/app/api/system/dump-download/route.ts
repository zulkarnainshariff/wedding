import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { logAuditEvent } from "@/lib/activity-log";
import { isAuthError, requireSuperuserAccess } from "@/lib/api-auth";
import { dumpDatabaseToFile } from "@/lib/database-dump";

export async function GET() {
  const actor = await requireSuperuserAccess();
  if (isAuthError(actor)) return actor;

  try {
    const dump = await dumpDatabaseToFile();
    const sql = await readFile(dump.localPath, "utf8");

    await logAuditEvent({
      user: actor,
      action: "update",
      resourceType: "database",
      summary: `Downloaded database dump ${dump.filename}`,
      metadata: {
        filename: dump.filename,
        lineCount: dump.lineCount,
        byteSize: dump.byteSize,
        method: dump.method,
      },
    }).catch(() => undefined);

    return new NextResponse(sql, {
      status: 200,
      headers: {
        "Content-Type": "application/sql; charset=utf-8",
        "Content-Disposition": `attachment; filename="${dump.filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Database dump failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
