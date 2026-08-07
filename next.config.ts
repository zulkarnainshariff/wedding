import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["adm-zip"],
  experimental: {
    serverActions: {
      bodySizeLimit: "512mb",
    },
    proxyClientMaxBodySize: "512mb",
  },
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
