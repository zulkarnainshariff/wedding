import { NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/api-auth";
import { getTaskIndicators } from "@/lib/task-queries";

export async function GET() {
  const user = await requireAuth();
  if (isAuthError(user)) return user;

  const indicators = await getTaskIndicators(user);
  return NextResponse.json(indicators);
}
