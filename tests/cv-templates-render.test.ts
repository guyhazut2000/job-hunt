import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { demoContent } from "@/lib/cv-templates/content";
import { renderCvDocx } from "@/lib/cv-templates/docx";
import { renderCvPdf } from "@/lib/cv-templates/pdf";
import { defaultLayout } from "@/lib/cv-templates/sections";
import { TEMPLATES, TEMPLATE_IDS } from "@/lib/cv-templates/templates";

// Set CV_SAMPLES_DIR to also write the files (used for visual QA, not in CI).
const out = process.env.CV_SAMPLES_DIR;

describe("CV renderers smoke", () => {
  for (const id of TEMPLATE_IDS)
    for (const lang of ["he", "en"] as const) {
      it(`${id} ${lang}: PDF + DOCX`, async () => {
        const tpl = TEMPLATES[id];
        const content = demoContent(lang);
        const layout = defaultLayout(
          tpl.defaults,
          content.custom.map((c) => c.id),
        );
        const pdf = await renderCvPdf({ content, layout, tpl, lang });
        expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
        expect(pdf.length).toBeGreaterThan(5_000);
        expect(pdf.length).toBeLessThan(1_500_000);
        const docx = await renderCvDocx({ content, layout, tpl, lang });
        expect(docx.subarray(0, 2).toString()).toBe("PK");
        expect(docx.length).toBeLessThan(2_000_000);
        if (out) {
          mkdirSync(out, { recursive: true });
          writeFileSync(path.join(out, `${id}-${lang}.pdf`), pdf);
          writeFileSync(path.join(out, `${id}-${lang}.docx`), docx);
        }
      }, 30_000);
    }
});
