import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Readability + jsdom only ever run on the server (cron route, spikes).
  serverExternalPackages: ["jsdom", "@mozilla/readability"],
};

export default nextConfig;
