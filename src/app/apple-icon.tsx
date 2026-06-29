import { ImageResponse } from "next/og";
import { getAppSettings } from "@/lib/app-settings";
import { getAppThemeMeta } from "@/lib/app-theme";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default async function AppleIcon() {
  const { themeId } = await getAppSettings();
  const theme = getAppThemeMeta(themeId);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: theme.manifestThemeColor,
          borderRadius: "50%",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 14,
            borderRadius: "50%",
            border: `2px solid ${theme.swatches[2]}`,
            opacity: 0.9,
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 22,
            borderRadius: "50%",
            border: `1px solid ${theme.swatches[2]}`,
            opacity: 0.45,
          }}
        />
        <span
          style={{
            color: theme.id === "heritage-gold" ? "#e8cc7a" : "#fceef4",
            fontSize: 96,
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontWeight: 400,
            lineHeight: 1,
            marginTop: -6,
          }}
        >
          &amp;
        </span>
      </div>
    ),
    { ...size },
  );
}
