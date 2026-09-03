import type { NextConfig } from "next";

const BACKEND_URL =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  "http://127.0.0.1:3000";

const nextConfig: NextConfig = {
  // Proxies API calls & QR code images directly to the Node.js Express server
  async rewrites() {
    return [
      {
        source: "/api/admin/:path*",
        destination: `${BACKEND_URL}/api/admin/:path*`,
      },
      {
        source: "/qr/:path*",
        destination: `${BACKEND_URL}/qr/:path*`,
      },
    ];
  },
};

export default nextConfig;
