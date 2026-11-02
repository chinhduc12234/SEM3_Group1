import type { NextConfig } from "next";

// The production container runs Next.js as a compact standalone Node server.
const nextConfig: NextConfig = {
  output: "standalone",
};

export default nextConfig;
