import { NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/api-auth";
import { getGuestListAccessForUser } from "@/lib/guest-queries";
import { getTaskPermissionsForUser } from "@/lib/task-queries";

export async function GET() {
  const user = await requireAuth();
  if (isAuthError(user)) return user;

  let guestListAccess: Awaited<ReturnType<typeof getGuestListAccessForUser>> = [];
  let taskPermissions: Awaited<ReturnType<typeof getTaskPermissionsForUser>> = [];

  try {
    [guestListAccess, taskPermissions] = await Promise.all([
      getGuestListAccessForUser(user),
      getTaskPermissionsForUser(user),
    ]);
  } catch (error) {
    console.error("Failed to load user access metadata:", error);
  }

  return NextResponse.json({
    user: {
      id: user.id,
      username: user.username,
      isAdmin: user.isAdmin,
      permissions: user.permissions,
      preferences: user.preferences,
      guestListAccess,
      taskPermissions,
    },
  });
}
