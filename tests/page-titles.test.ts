import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PAGE_TITLES } from "@/lib/i18n/titles";

const HEBREW = /[\u0590-\u05FF]/;

function pages(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return pages(p);
    return name === "page.tsx" ? [p] : [];
  });
}

describe("page titles", () => {
  it("every title has a Hebrew and an English version", () => {
    for (const [key, t] of Object.entries(PAGE_TITLES)) {
      expect(HEBREW.test(t.he), `${key} he`).toBe(true);
      expect(t.en.trim(), `${key} en`).not.toBe("");
    }
  });

  it("no page ships a hard-coded English tab title", () => {
    const offenders = pages(join(process.cwd(), "src/app")).filter((p) =>
      /export const metadata(: Metadata)? = \{ title: "[A-Za-z]/.test(readFileSync(p, "utf8")),
    );
    expect(offenders).toEqual([]);
  });
});
