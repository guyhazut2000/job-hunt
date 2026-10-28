import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The project is a non-commercial practice project; the old pricing page is gone.
  async redirects() {
    return [{ source: "/pricing", destination: "/", permanent: true }];
  },
};

export default nextConfig;
