import { NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/api-auth";
import { getGuestListAccessForUser } from "@/lib/guest-queries";
import { getTaskPermissionsForUser } from "@/lib/task-queries";

export async function GET() {
  const user = await requireAuth();
  if (isAuthError(user)) return user;

  const [guestListAccess, taskPermissions] = await Promise.all([
    getGuestListAccessForUser(user),
    getTaskPermissionsForUser(user),
  ]);

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
