import type { NextConfig } from "next";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {
    root: __dirname,
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
    ];
  },
};

export default nextConfig;