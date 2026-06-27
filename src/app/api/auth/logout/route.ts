import { NextResponse } from "next/server";
import { clearSessionCookie, getSessionUser } from "@/lib/auth";
import { logLogout } from "@/lib/activity-log";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (user) {
    try {
      await logLogout(user, null, request);
    } catch (error) {
      console.error("Logout activity logging failed:", error);
    }
  }
  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response);
  return response;
}
