import { NextResponse } from "next/server";
import { clearSessionCookie, getSessionUser } from "@/lib/auth";
import { logLogout } from "@/lib/activity-log";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (user) {
    await logLogout(user, null, request);
  }
  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response);
  return response;
}
