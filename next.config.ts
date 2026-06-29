import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async redirects() {
    return [
      {
        source: "/businesses",
        destination: "/projects",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
