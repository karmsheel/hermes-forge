import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {
    root: process.cwd(),
  },
  async redirects() {
    return [
      {
        source: "/businesses",
        destination: "/functions",
        permanent: true,
      },
      {
        source: "/projects",
        destination: "/functions",
        permanent: true,
      },
      {
        source: "/interview",
        destination: "/home",
        permanent: true,
      },
      {
        source: "/dashboard",
        destination: "/functions",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
