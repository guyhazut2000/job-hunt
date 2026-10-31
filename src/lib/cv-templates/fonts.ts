import path from "node:path";

/** OFL fonts with Hebrew + Latin glyphs, shipped with the function (next.config outputFileTracingIncludes). */
export const FONT_DIR = path.join(process.cwd(), "src/lib/cv-templates/fonts");
export const FONT_FILES = {
  sans: {
    regular: "IBMPlexSansHebrew-Regular.ttf",
    semibold: "IBMPlexSansHebrew-SemiBold.ttf",
    bold: "IBMPlexSansHebrew-Bold.ttf",
  },
  serif: { regular: "DavidLibre-Regular.ttf", semibold: "DavidLibre-Bold.ttf", bold: "DavidLibre-Bold.ttf" },
} as const;
/** Font family names written into DOCX (Word substitutes if the font isn't installed). */
export const DOCX_FONT = { sans: "IBM Plex Sans Hebrew", serif: "David Libre" } as const;
export const fontPath = (f: string) => path.join(FONT_DIR, f);
