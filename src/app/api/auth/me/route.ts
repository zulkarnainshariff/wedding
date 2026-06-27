import { NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/api-auth";
import { isSuperuser } from "@/lib/permissions";
import { getGuestListAccessForUser } from "@/lib/guest-queries";
import { getTaskPermissionsForUser } from "@/lib/task-queries";

export async function GET() {
  const user = await requireAuth();
  if (isAuthError(user)) return user;

  let guestListAccess: Awaited<ReturnType<typeof getGuestListAccessForUser>> = [];
  let taskPermissions: Awaited<ReturnType<typeof getTaskPermissionsForUser>> = [];

  try {
    guestListAccess = await getGuestListAccessForUser(user);
  } catch (error) {
    console.error("Failed to load guest list access:", error);
  }

  try {
    taskPermissions = await getTaskPermissionsForUser(user);
  } catch (error) {
    console.error("Failed to load task permissions:", error);
  }

  return NextResponse.json({
    user: {
      id: user.id,
      username: user.username,
      isAdmin: user.isAdmin,
      permissions: user.permissions,
      preferences: user.preferences,
      canAccessDiagnostics: isSuperuser(user),
      guestListAccess,
      taskPermissions,
    },
  });
}
