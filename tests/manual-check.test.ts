import { describe, expect, it } from "vitest";
import { CORE_MANUAL_SLUGS, isoWeekKey, MAX_LISTED, planManualCheck } from "@/lib/companies/manual-check";

const co = (slug: string, name = slug.toUpperCase()) => ({ slug, name });
const none = { slugs: new Set<string>(), names: new Set<string>() };

describe("isoWeekKey", () => {
  it.each([
    ["2026-10-29T10:00:00Z", "2026-W44"],
    ["2026-01-01T00:00:00Z", "2026-W01"],
    ["2027-01-01T00:00:00Z", "2026-W53"],
    ["2024-12-30T00:00:00Z", "2025-W01"],
  ])("%s → %s", (d, k) => expect(isoWeekKey(new Date(d))).toBe(k));
});

describe("planManualCheck", () => {
  it("returns nothing when no company is manual", () => {
    expect(planManualCheck([], none, "he")).toBeNull();
  });
  it("lists the user's own companies first, then the core list, then +N more", () => {
    const manual = [co("apple"), co("meta"), co("teva"), co("rafael"), co("misc1"), co("misc2")];
    const plan = planManualCheck(manual, { slugs: new Set(["rafael"]), names: new Set(["teva"]) }, "en", [
      "meta",
      "apple",
    ])!;
    expect(plan.url).toBe("/companies?sync=manual");
    expect(plan.title).toContain("6 careers sites");
    expect(plan.yours.sort()).toEqual(["rafael", "teva"]);
    const [yours, others] = plan.body.split("\n");
    expect(yours).toBe("From your applications: RAFAEL, TEVA.");
    expect(others).toBe("Also worth a look: META, APPLE, +2 more.");
  });
  it("caps the names it shows", () => {
    const manual = Array.from({ length: 30 }, (_, i) => co(`c${i}`));
    const plan = planManualCheck(
      manual,
      none,
      "he",
      manual.map((c) => c.slug),
    )!;
    const shown = plan.body.split("\n")[0];
    expect(shown.split(",").length).toBe(MAX_LISTED + 1);
    expect(shown).toContain("ועוד 22");
  });
  it("seeds a core list of the bot-protected big employers", () => {
    expect(CORE_MANUAL_SLUGS).toEqual(expect.arrayContaining(["apple", "meta", "check-point"]));
    expect(CORE_MANUAL_SLUGS).not.toContain("amdocs");
  });
});
