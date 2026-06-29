import { ImageResponse } from "next/og";
import { getAppSettings } from "@/lib/app-settings";
import { getAppThemeMeta } from "@/lib/app-theme";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default async function Icon() {
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
            inset: 3,
            borderRadius: "50%",
            border: `1px solid ${theme.swatches[2]}`,
            opacity: 0.9,
          }}
        />
        <span
          style={{
            color: theme.id === "heritage-gold" ? "#e8cc7a" : "#fceef4",
            fontSize: 18,
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontWeight: 400,
            lineHeight: 1,
            marginTop: -1,
          }}
        >
          &amp;
        </span>
      </div>
    ),
    { ...size },
  );
}
