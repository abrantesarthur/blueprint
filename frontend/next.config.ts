import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Add every @blueprint/* workspace package used by the frontend here.
  transpilePackages: [
    "@blueprint/api-utils",
    "@blueprint/enum-utils",
    "@blueprint/error-utils",
    "@blueprint/time-utils",
    "@blueprint/type-utils",
  ],
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:4001/api/:path*",
      },
    ];
  },
};

export default nextConfig;
