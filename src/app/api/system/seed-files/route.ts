import { NextResponse } from "next/server";
import { isAuthError, requireSuperuserAccess } from "@/lib/api-auth";
import { listSeedSqlFiles } from "@/lib/database-restore";
import { describeDeployTarget, getDeployConfig } from "@/lib/deploy-config";

export async function GET() {
  const user = await requireSuperuserAccess();
  if (isAuthError(user)) return user;

  const files = await listSeedSqlFiles();
  const deployConfigured = Boolean(getDeployConfig());

  return NextResponse.json({
    files,
    deployConfigured,
    deployTarget: deployConfigured
      ? describeDeployTarget(getDeployConfig()!)
      : null,
    isProduction: process.env.NODE_ENV === "production",
  });
}
