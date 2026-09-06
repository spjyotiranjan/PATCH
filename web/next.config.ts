import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  reactStrictMode: true,
  serverExternalPackages: ["mongodb", "pino", "ws", "swagger-ui-dist"],
};

export default nextConfig;
