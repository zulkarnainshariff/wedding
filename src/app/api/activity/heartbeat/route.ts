import { NextResponse } from "next/server";
import { isAuthError, requireAuth } from "@/lib/api-auth";
import { recordUsageHeartbeat } from "@/lib/activity-log";

export async function POST(request: Request) {
  const user = await requireAuth();
  if (isAuthError(user)) return user;

  const body = (await request.json().catch(() => ({}))) as {
    path?: string;
    detailed?: boolean;
  };

  const detailed =
    body.detailed === true || process.env.NODE_ENV === "development";

  const result = await recordUsageHeartbeat({
    user,
    path: body.path,
    detailed,
    request,
  });

  return NextResponse.json(result);
}
