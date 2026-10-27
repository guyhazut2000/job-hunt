import { describe, expect, it } from "vitest";
import { filtersToQuery, filtersToWhere, parseFilters } from "@/lib/jobs/filters";
import { canUseAiReview } from "@/lib/billing";

describe("job filters", () => {
  it("drops invalid values from untrusted params", () => {
    const f = parseFilters({ role: "hacker", seniority: "GOD", workMode: "REMOTE", page: "-3", q: "  react " });
    expect(f).toMatchObject({ role: undefined, seniority: undefined, workMode: "REMOTE", page: 1, q: "react" });
  });
  it("builds a prisma where clause", () => {
    const where = filtersToWhere(parseFilters({ role: "backend", tech: "Go", location: "Haifa" }));
    expect(where).toMatchObject({
      isActive: true,
      roleCategory: "backend",
      techStack: { has: "Go" },
      location: { contains: "Haifa", mode: "insensitive" },
    });
  });
  it("serializes back to a query string without defaults", () => {
    expect(filtersToQuery({ role: "qa", page: 1 })).toBe("?role=qa");
    expect(filtersToQuery({ page: 2 })).toBe("?page=2");
  });
});

describe("billing", () => {
  it("limits free AI reviews", () => {
    expect(canUseAiReview("FREE", 2)).toBe(true);
    expect(canUseAiReview("FREE", 3)).toBe(false);
    expect(canUseAiReview("PRO", 999)).toBe(true);
  });
});
