import { NextResponse } from "next/server";
import path from "node:path";
import { logAuditEvent } from "@/lib/activity-log";
import { isAuthError, requireSuperuserAccess } from "@/lib/api-auth";
import { dumpDatabaseToFile } from "@/lib/database-dump";
import {
  describeDeployTarget,
  getDeployConfig,
} from "@/lib/deploy-config";
import { uploadFileViaScp } from "@/lib/deploy-upload";

export async function POST() {
  const actor = await requireSuperuserAccess();
  if (isAuthError(actor)) return actor;

  const deployConfig = getDeployConfig();
  if (!deployConfig) {
    return NextResponse.json(
      {
        error:
          "Deploy credentials are not configured. Set SERVER, DEPLOY_TARGET_DIR, DEPLOY_USERNAME, and DEPLOY_PASSWORD in the server environment.",
      },
      { status: 400 },
    );
  }

  try {
    const dump = await dumpDatabaseToFile();
    const remotePath = path.posix.join(
      deployConfig.targetDir.replace(/\/$/, ""),
      dump.filename,
    );

    await uploadFileViaScp(dump.localPath, remotePath, deployConfig);

    await logAuditEvent({
      user: actor,
      action: "update",
      resourceType: "database",
      summary: `Dumped database and uploaded ${dump.filename} to ${describeDeployTarget(deployConfig)}`,
      metadata: {
        filename: dump.filename,
        remotePath,
        lineCount: dump.lineCount,
        byteSize: dump.byteSize,
        method: dump.method,
      },
    });

    return NextResponse.json({
      ok: true,
      filename: dump.filename,
      localPath: dump.localPath,
      remotePath,
      target: describeDeployTarget(deployConfig),
      lineCount: dump.lineCount,
      byteSize: dump.byteSize,
      method: dump.method,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Database dump and upload failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
