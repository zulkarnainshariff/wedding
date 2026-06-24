import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#1e3a5f",
          borderRadius: "50%",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 14,
            borderRadius: "50%",
            border: "2px solid #d4a853",
            opacity: 0.9,
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 22,
            borderRadius: "50%",
            border: "1px solid #d4a853",
            opacity: 0.45,
          }}
        />
        <span
          style={{
            color: "#e8cc7a",
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
