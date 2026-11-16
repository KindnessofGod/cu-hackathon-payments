import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Open Payments SDK loads OpenAPI spec files from disk at runtime, so it must not be bundled.
  serverExternalPackages: ["@interledger/open-payments", "pg"],
};

export default nextConfig;
