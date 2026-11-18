import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Open Payments SDK loads OpenAPI spec files from disk at runtime, so it must not be bundled,
  // and its spec files must be shipped with every server route.
  serverExternalPackages: ["@interledger/open-payments", "pg"],
  outputFileTracingIncludes: {
    "/api/**/*": ["./node_modules/@interledger/open-payments/dist/openapi/specs/**/*"],
  },
};

export default nextConfig;
