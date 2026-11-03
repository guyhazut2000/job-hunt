import { describe, expect, it } from "vitest";
import { dispositionFilename, exportOutcome, shouldTranslate } from "@/lib/cv-templates/export-status";
import { cvTemplateStrings } from "@/lib/i18n/cv-templates";

describe("CV export outcome (#95)", () => {
  it("never reports an error page as a downloaded CV", () => {
    expect(exportOutcome(401, null)).toBe("exportSignedOut");
    expect(exportOutcome(500, null)).toBe("exportFailed");
    expect(exportOutcome(400, null)).toBe("exportFailed");
  });
  it("tells the user when the translation didn't happen", () => {
    expect(exportOutcome(200, "limited")).toBe("translateLimited");
    expect(exportOutcome(200, "error")).toBe("translateFailed");
    for (const t of ["translated", "none", "off", null]) expect(exportOutcome(200, t)).toBe("done");
  });
  it("keeps Hebrew file names from filename*", () => {
    const h = `attachment; filename="cv-hitech-he.pdf"; filename*=UTF-8''${encodeURIComponent("גיא חזות – hitech (he).pdf")}`;
    expect(dispositionFilename(h, "x.pdf")).toBe("גיא חזות – hitech (he).pdf");
    expect(dispositionFilename('attachment; filename="a.docx"', "x")).toBe("a.docx");
    expect(dispositionFilename("attachment; filename*=UTF-8''%E0%A4%A", "x")).toBe("x");
    expect(dispositionFilename(null, "x.pdf")).toBe("x.pdf");
  });
  it("into English always checks for leftover Hebrew; into Hebrew only from an English CV; never for demo", () => {
    expect(shouldTranslate("en", "en", false)).toBe(true);
    expect(shouldTranslate("he", "en", false)).toBe(true);
    expect(shouldTranslate("en", "he", false)).toBe(true);
    expect(shouldTranslate("he", "he", false)).toBe(false);
    expect(shouldTranslate("he", "en", true)).toBe(false);
  });
  it("has every message in Hebrew and English", () => {
    for (const l of ["he", "en"] as const)
      for (const k of ["translateLimited", "translateFailed", "exportFailed", "exportSignedOut", "exportDone"] as const)
        expect(cvTemplateStrings(l).editor[k]).toBeTruthy();
  });
});
