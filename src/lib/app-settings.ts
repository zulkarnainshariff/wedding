import { cache } from "react";
import { unstable_noStore as noStore } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  DEFAULT_APP_THEME_ID,
  normalizeAppThemeId,
  type AppThemeId,
} from "@/lib/app-theme";
import { appSettings, type AppFeatureFlags } from "@/lib/schema";
import { DEFAULT_ITINERARY_START_DATE } from "@/lib/trip-day-display";

export type AppSettings = {
  themeId: AppThemeId;
  features: AppFeatureFlags;
};

export const DEFAULT_APP_SETTINGS: AppSettings = {
  themeId: DEFAULT_APP_THEME_ID,
  features: {},
};

const SETTINGS_CACHE_TTL_MS =
  process.env.NODE_ENV === "development" ? 30_000 : 60_000;

let cachedSettings: AppSettings | null = null;
let settingsCacheExpiresAt = 0;

export function invalidateAppSettingsCache() {
  cachedSettings = null;
  settingsCacheExpiresAt = 0;
}

let schemaEnsured = false;

/** Idempotent — safe when migrate-app-settings was not run yet. */
async function ensureAppSettingsSchema(): Promise<void> {
  if (schemaEnsured) return;

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS app_settings (
      id integer PRIMARY KEY DEFAULT 1,
      theme_id text NOT NULL DEFAULT 'azure-blossom',
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT app_settings_singleton CHECK (id = 1)
    )
  `);

  await db.execute(sql`
    INSERT INTO app_settings (id, theme_id)
    VALUES (1, 'azure-blossom')
    ON CONFLICT (id) DO NOTHING
  `);

  await db.execute(sql`
    ALTER TABLE app_settings
    ADD COLUMN IF NOT EXISTS features jsonb NOT NULL DEFAULT '{}'::jsonb
  `);

  schemaEnsured = true;
}

function normalizeFeatures(raw: unknown): AppFeatureFlags {
  if (!raw || typeof raw !== "object") return {};
  const value = raw as Partial<AppFeatureFlags>;
  return {
    guestbookEnabled: Boolean(value.guestbookEnabled),
    photoGalleryEnabled: Boolean(value.photoGalleryEnabled),
    tripStartDate:
      typeof value.tripStartDate === "string" && value.tripStartDate.trim()
        ? value.tripStartDate.trim()
        : null,
    tripEndDate:
      typeof value.tripEndDate === "string" && value.tripEndDate.trim()
        ? value.tripEndDate.trim()
        : null,
    itineraryStartDate:
      typeof value.itineraryStartDate === "string" &&
      value.itineraryStartDate.trim()
        ? value.itineraryStartDate.trim()
        : DEFAULT_ITINERARY_START_DATE,
  };
}

async function loadAppSettingsFromDb(): Promise<AppSettings> {
  await ensureAppSettingsSchema();

  const [row] = await db
    .select({ themeId: appSettings.themeId, features: appSettings.features })
    .from(appSettings)
    .where(eq(appSettings.id, 1))
    .limit(1);

  if (row) {
    return {
      themeId: normalizeAppThemeId(row.themeId),
      features: normalizeFeatures(row.features),
    };
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
  const current = await getAppSettings();

  await ensureAppSettingsSchema();

  await db
    .insert(appSettings)
    .values({ id: 1, themeId: normalized, features: current.features })
    .onConflictDoUpdate({
      target: appSettings.id,
      set: { themeId: normalized, updatedAt: new Date() },
    });

  invalidateAppSettingsCache();
  return { themeId: normalized, features: current.features };
}

export async function updateAppFeatures(
  features: AppFeatureFlags,
): Promise<AppSettings> {
  const current = await getAppSettings();
  const normalized = {
    ...normalizeFeatures(current.features),
    ...normalizeFeatures(features),
  };

  await ensureAppSettingsSchema();

  await db
    .insert(appSettings)
    .values({ id: 1, themeId: current.themeId, features: normalized })
    .onConflictDoUpdate({
      target: appSettings.id,
      set: { features: normalized, updatedAt: new Date() },
    });

  invalidateAppSettingsCache();
  return { themeId: current.themeId, features: normalized };
}

export async function updateAppTripRange(
  tripStartDate: string,
  tripEndDate: string,
): Promise<AppSettings> {
  const current = await getAppSettings();
  const features = normalizeFeatures({
    ...current.features,
    tripStartDate,
    tripEndDate,
  });
  return updateAppFeatures(features);
}

export function isGuestbookEnabled(settings: AppSettings): boolean {
  return Boolean(settings.features.guestbookEnabled);
}

export function isPhotoGalleryEnabled(settings: AppSettings): boolean {
  return Boolean(settings.features.photoGalleryEnabled);
}
