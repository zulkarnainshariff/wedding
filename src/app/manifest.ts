import type { MetadataRoute } from "next";
import { getAppSettings } from "@/lib/app-settings";
import { getAppThemeMeta } from "@/lib/app-theme";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const { themeId } = await getAppSettings();
  const theme = getAppThemeMeta(themeId);

  return {
    name: "Natalie & Zulkarnain",
    short_name: "N & Z",
    description: "Wedding invitations and family travel itinerary",
    start_url: "/itinerary",
    display: "standalone",
    background_color: theme.manifestBackgroundColor,
    theme_color: theme.manifestThemeColor,
    icons: [
      {
        src: "/icon",
        sizes: "32x32",
        type: "image/png",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
