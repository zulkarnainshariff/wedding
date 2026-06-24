import { NextResponse } from "next/server";
import { isAuthError, requireAuth } from "@/lib/api-auth";
import { canEditItinerary, canManageUsers } from "@/lib/permissions";
import {
  canAssignOnAnyEvent,
  getAllUsersBrief,
} from "@/lib/task-queries";

export async function GET() {
  const user = await requireAuth();
  if (isAuthError(user)) return user;

  const canList =
    user.isAdmin ||
    canManageUsers(user) ||
    canEditItinerary(user) ||
    (await canAssignOnAnyEvent(user));

  if (!canList) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await getAllUsersBrief();
  return NextResponse.json(users);
}
