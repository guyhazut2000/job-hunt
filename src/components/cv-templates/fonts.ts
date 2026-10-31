import localFont from "next/font/local";

/** Same OFL fonts as the PDF/DOCX export, so the preview matches the file. */
export const cvSans = localFont({
  src: [
    { path: "../../lib/cv-templates/fonts/IBMPlexSansHebrew-Regular.ttf", weight: "400" },
    { path: "../../lib/cv-templates/fonts/IBMPlexSansHebrew-SemiBold.ttf", weight: "600" },
    { path: "../../lib/cv-templates/fonts/IBMPlexSansHebrew-Bold.ttf", weight: "700" },
  ],
  display: "swap",
  // The fallback-metrics step of next/font cannot parse these TTFs during `next build` (null name table match).
  adjustFontFallback: false,
  variable: "--font-cv-sans",
});
export const cvSerif = localFont({
  src: [
    { path: "../../lib/cv-templates/fonts/DavidLibre-Regular.ttf", weight: "400" },
    { path: "../../lib/cv-templates/fonts/DavidLibre-Bold.ttf", weight: "700" },
  ],
  display: "swap",
  // The fallback-metrics step of next/font cannot parse these TTFs during `next build` (null name table match).
  adjustFontFallback: false,
  variable: "--font-cv-serif",
});
