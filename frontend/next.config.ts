import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config) => {
    // pino optionally loads pino-pretty in dev; WalletConnect pulls pino into the client bundle.
    // Stub it so Next can resolve the graph (optional dependency is not installed).
    config.resolve.alias = {
      ...config.resolve.alias,
      "pino-pretty": false,
    };
    return config;
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "api.dicebear.com",
        pathname: "/7.x/**",
      },
    ],
  },
};

export default nextConfig;
