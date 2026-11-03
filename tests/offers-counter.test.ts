import { describe, expect, it } from "vitest";
import { counterOfferDraft, reasonLines } from "@/lib/offers/counter";
import { salaryHubStrings } from "@/lib/i18n/salary-hub";

const base = {
  name: "גיא",
  company: "Wix",
  role: "Backend Engineer",
  recruiter: "דנה",
  offered: 30000,
  ask: 34000,
  reasons: "6 שנות ניסיון ב-Kafka\nהובלתי מעבר ל-Kubernetes",
  extras: "",
  deadline: "יום חמישי",
};

describe("counterOfferDraft", () => {
  it("builds a Hebrew draft with all the pieces", () => {
    const d = counterOfferDraft(base, salaryHubStrings.he.negotiate.letter, "he");
    expect(d).toContain("היי דנה,");
    expect(d).toContain("Backend Engineer ב-Wix");
    expect(d).toContain("• 6 שנות ניסיון ב-Kafka");
    expect(d).toMatch(/34,000/);
    expect(d).toContain("עד יום חמישי");
    expect(d.trim().endsWith("גיא")).toBe(true);
  });
  it("degrades without optional fields", () => {
    const d = counterOfferDraft(
      { ...base, recruiter: "", offered: 0, ask: 0, reasons: "", deadline: "" },
      salaryHubStrings.en.negotiate.letter,
      "en",
    );
    expect(d.startsWith("Hi,")).toBe(true);
    expect(d).not.toContain("{");
    expect(d).toContain("look forward");
  });
  it("splits reasons but keeps numbers with commas", () => {
    expect(reasonLines("a; b\n- c, d")).toEqual(["a", "b", "c", "d"]);
    expect(reasonLines("offer of 1,000")).toEqual(["offer of 1,000"]);
  });
});
