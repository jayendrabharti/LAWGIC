import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config: any, { dev, isServer }: any) => {
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      canvas: false,
    };

    // pdfjs-dist can crash in Next/Webpack dev mode with eval source maps.
    // Use normal source maps for the browser bundle.
    if (dev && !isServer) {
      config.devtool = "source-map";
    }

    return config;
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "byte-us-dev-bucket.s3.ap-south-1.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "lawgic-backend-684404792129.asia-south2.run.app",
      },
      {
        protocol: "http",
        hostname: "localhost",
        port: "6900",
      },
    ],
  },
};

export default nextConfig;
