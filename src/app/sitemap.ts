import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/notifications/config";

/** Static list of the public entry pages — no DB query, so it stays cheap to serve. */
const PUBLIC_PATHS = [
  "/",
  "/jobs",
  "/companies",
  "/learn",
  "/learn/problem-solving",
  "/learn/concepts",
  "/features",
  "/privacy",
  "/terms",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return PUBLIC_PATHS.map((p) => ({ url: `${base}${p === "/" ? "" : p}`, changeFrequency: "daily" }));
}
