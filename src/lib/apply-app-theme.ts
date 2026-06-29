import type { AppThemeId } from "@/lib/app-theme";

export function applyAppThemeToDocument(themeId: AppThemeId) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = themeId;
}
