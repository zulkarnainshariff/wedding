import { cache } from "react";
import { unstable_noStore as noStore } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  DEFAULT_APP_THEME_ID,
  normalizeAppThemeId,
  type AppThemeId,
} from "@/lib/app-theme";
import { appSettings } from "@/lib/schema";

export type AppSettings = {
  themeId: AppThemeId;
};

export const DEFAULT_APP_SETTINGS: AppSettings = {
  themeId: DEFAULT_APP_THEME_ID,
};

const SETTINGS_CACHE_TTL_MS =
  process.env.NODE_ENV === "development" ? 30_000 : 60_000;

let cachedSettings: AppSettings | null = null;
let settingsCacheExpiresAt = 0;

export function invalidateAppSettingsCache() {
  cachedSettings = null;
  settingsCacheExpiresAt = 0;
}

async function loadAppSettingsFromDb(): Promise<AppSettings> {
  const [row] = await db
    .select({ themeId: appSettings.themeId })
    .from(appSettings)
    .where(eq(appSettings.id, 1))
    .limit(1);

  if (row) {
    return { themeId: normalizeAppThemeId(row.themeId) };
  }

  return DEFAULT_APP_SETTINGS;
}

export const getAppSettings = cache(async (): Promise<AppSettings> => {
  noStore();
  const now = Date.now();
  if (cachedSettings && now < settingsCacheExpiresAt) {
    return cachedSettings;
  }

  try {
    const settings = await loadAppSettingsFromDb();
    cachedSettings = settings;
    settingsCacheExpiresAt = now + SETTINGS_CACHE_TTL_MS;
    return settings;
  } catch {
    return cachedSettings ?? DEFAULT_APP_SETTINGS;
  }
});

export async function updateAppTheme(themeId: AppThemeId): Promise<AppSettings> {
  const normalized = normalizeAppThemeId(themeId);

  await db
    .insert(appSettings)
    .values({ id: 1, themeId: normalized })
    .onConflictDoUpdate({
      target: appSettings.id,
      set: { themeId: normalized, updatedAt: new Date() },
    });

  invalidateAppSettingsCache();
  return { themeId: normalized };
}
