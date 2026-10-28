import type { MetadataRoute } from "next";

/** Minimal web app manifest so iPhone users can "Add to Home Screen" and receive web push. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "job-hunt",
    short_name: "job-hunt",
    description: "חיפוש עבודה בהייטק בישראל",
    start_url: "/jobs",
    display: "standalone",
    dir: "rtl",
    lang: "he",
    background_color: "#f4efe6",
    theme_color: "#c2461e",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
