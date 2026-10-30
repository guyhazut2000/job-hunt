import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/notifications/config";

/** Public pages are crawlable; APIs and per-user areas are not (they only redirect to /login anyway). */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/admin",
        "/dashboard",
        "/profile",
        "/settings",
        "/notifications",
        "/digest",
        "/stats",
        "/interview",
        "/cv",
        "/chat",
        "/onboarding",
        "/documents",
        "/learn/me",
      ],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
