import { NextResponse } from "next/server";
import { isAuthError, requireAuth } from "@/lib/api-auth";
import {
  canAssignOnAnyEvent,
  getAllUsersBrief,
} from "@/lib/task-queries";

export async function GET() {
  const user = await requireAuth();
  if (isAuthError(user)) return user;

  if (!(await canAssignOnAnyEvent(user))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await getAllUsersBrief();
  return NextResponse.json(users);
}
