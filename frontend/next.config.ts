import type { NextConfig } from "next";

// The production container runs Next.js as a compact standalone Node server.
const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    return process.env.NODE_ENV === "development"
      ? [{ source: "/api/:path*", destination: (process.env.API_GATEWAY_URL || "http://127.0.0.1:8080") + "/api/:path*" }]
      : [];
  },
};

export default nextConfig;
