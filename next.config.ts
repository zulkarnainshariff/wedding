import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["adm-zip"],
  experimental: {
    serverActions: {
      bodySizeLimit: "512mb",
    },
    // Used when middleware/proxy clones request bodies (default is 10MB).
    // Do not also set middlewareClientMaxBodySize — Next rejects both together.
    proxyClientMaxBodySize: "512mb",
  },
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
