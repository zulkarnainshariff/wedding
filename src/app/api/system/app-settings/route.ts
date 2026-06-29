import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { isAuthError, requireAuth } from "@/lib/api-auth";
import { getAppSettings, updateAppTheme } from "@/lib/app-settings";
import {
  APP_THEMES,
  normalizeAppThemeId,
  type AppThemeId,
} from "@/lib/app-theme";
import { logAuditEvent } from "@/lib/activity-log";

export async function GET() {
  const settings = await getAppSettings();
  return NextResponse.json({
    themeId: settings.themeId,
    themes: Object.values(APP_THEMES),
  });
}

export async function PATCH(request: Request) {
  const user = await requireAuth();
  if (isAuthError(user)) return user;
  if (!user.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const themeId = normalizeAppThemeId(body.themeId) as AppThemeId;
  const settings = await updateAppTheme(themeId);

  revalidatePath("/", "layout");

  await logAuditEvent({
    user,
    action: "update",
    resourceType: "app_settings",
    resourceId: "1",
    summary: `Changed application theme to ${APP_THEMES[themeId].name}`,
    metadata: { themeId },
  });

  return NextResponse.json({ themeId: settings.themeId });
}
