export const APP_THEME_IDS = [
  "heritage-gold",
  "azure-blossom",
  "pearl-blossom",
] as const;

export type AppThemeId = (typeof APP_THEME_IDS)[number];

export const DEFAULT_APP_THEME_ID: AppThemeId = "azure-blossom";

export type AppThemeMeta = {
  id: AppThemeId;
  name: string;
  description: string;
  manifestThemeColor: string;
  manifestBackgroundColor: string;
  swatches: string[];
};

export const APP_THEMES: Record<AppThemeId, AppThemeMeta> = {
  "heritage-gold": {
    id: "heritage-gold",
    name: "Heritage Gold",
    description:
      "Warm ivory, deep navy, and antique gold — the classic wedding palette.",
    manifestThemeColor: "#1e3a5f",
    manifestBackgroundColor: "#f5f1eb",
    swatches: ["#f5f1eb", "#1e3a5f", "#d4a853"],
  },
  "azure-blossom": {
    id: "azure-blossom",
    name: "Azure Blossom",
    description:
      "Sky-blue wash and soft blush — airy, colourful, and bright.",
    manifestThemeColor: "#3d8fc9",
    manifestBackgroundColor: "#d4ebf9",
    swatches: ["#d4ebf9", "#3d8fc9", "#e8a8c4"],
  },
  "pearl-blossom": {
    id: "pearl-blossom",
    name: "Pearl Blossom",
    description:
      "Clean white grounds with blush rose accents — minimal and luminous.",
    manifestThemeColor: "#e8a8c4",
    manifestBackgroundColor: "#ffffff",
    swatches: ["#ffffff", "#e8a8c4", "#7ec4ef"],
  },
};

export function normalizeAppThemeId(value: unknown): AppThemeId {
  if (value === "heritage-gold") return "heritage-gold";
  if (value === "pearl-blossom") return "pearl-blossom";
  return DEFAULT_APP_THEME_ID;
}

export function getAppThemeMeta(themeId: unknown): AppThemeMeta {
  return APP_THEMES[normalizeAppThemeId(themeId)];
}
