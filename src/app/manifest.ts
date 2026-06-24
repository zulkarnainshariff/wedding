import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Natalie & Zulkarnain",
    short_name: "N & Z",
    description: "Wedding invitations and family travel itinerary",
    start_url: "/itinerary",
    display: "standalone",
    background_color: "#f5f1eb",
    theme_color: "#1e3a5f",
    icons: [
      {
        src: "/icon",
        sizes: "32x32",
        type: "image/svg+xml",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
