import type { NextConfig } from "next";

/**
 * Baseline security headers for every response. No strict CSP on purpose: inline theme/RSC scripts
 * and third-party map tiles would need nonces — `frame-ancestors` alone covers clickjacking.
 * The microphone stays allowed for our own origin (voice answers in interview practice / chat),
 * and geolocation for the commute bar on the jobs map.
 */
const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(self), geolocation=(self), payment=(), usb=(), browsing-topics=()",
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // CV export (docs/cv-templates.md): load react-pdf natively (ESM-only deps) and ship the OFL fonts.
  serverExternalPackages: ["@react-pdf/renderer"],
  outputFileTracingIncludes: { "/api/cv/export": ["./src/lib/cv-templates/fonts/**"] },
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  // The project is a non-commercial practice project; the old pricing page is gone.
  async redirects() {
    return [{ source: "/pricing", destination: "/", permanent: true }];
  },
};

export default nextConfig;
