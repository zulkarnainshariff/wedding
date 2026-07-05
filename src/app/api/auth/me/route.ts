import { NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/api-auth";
import { isSuperuser } from "@/lib/permissions";
import { getAppSettings, isGuestbookEnabled } from "@/lib/app-settings";
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

  let guestbookEnabled = false;
  try {
    const settings = await getAppSettings();
    guestbookEnabled = isGuestbookEnabled(settings);
  } catch (error) {
    console.error("Failed to load app settings:", error);
  }

  return NextResponse.json({
    user: {
      id: user.id,
      username: user.username,
      roleLevel: user.roleLevel,
      isAdmin: user.isAdmin,
      permissions: user.permissions,
      preferences: user.preferences,
      guardianForUsernames: user.guardianForUsernames ?? [],
      elevatedAdmin: Boolean(user.elevatedAdmin),
      canAccessDiagnostics: isSuperuser(user),
      guestListAccess,
      taskPermissions,
      guestbookEnabled,
    },
  });
}
