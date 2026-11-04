/**
 * Regression for the prod crash on /cv/standard (Nov 2026): on Vercel the real-PDF page check threw
 * `Cannot find module …/pdfkit/js/standard-fonts/Helvetica.cjs` and took the whole page down.
 * Real-shaped profiles (incl. legacy + partial rows with no cached cvStandard) must never throw.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const st = vi.hoisted(() => ({ profile: null as Record<string, unknown> | null, updates: 0, fitThrows: true }));

vi.mock("@/lib/db", () => ({
  db: {
    user: { findUnique: async () => ({ name: "Test User", email: "t@example.com" }) },
    profile: {
      findUnique: async () => st.profile,
      update: async () => {
        st.updates++;
        return {};
      },
    },
    tailoredCv: { findFirst: async () => null },
    cvLayout: { findUnique: async () => null, findFirst: async () => null, findMany: async () => [] },
  },
}));
vi.mock("@/lib/cv-standard/fit", async (orig) => {
  const real = await orig<typeof import("@/lib/cv-standard/fit")>();
  return {
    ...real,
    fitCvPdf: async (...a: Parameters<typeof real.fitCvPdf>) => {
      if (st.fitThrows)
        throw Object.assign(
          new Error("Cannot find module '/var/task/node_modules/pdfkit/js/standard-fonts/Helvetica.cjs'"),
          { code: "MODULE_NOT_FOUND" },
        );
      return real.fitCvPdf(...a);
    },
  };
});

const { checkCvStandard, requireCvStandard } = await import("@/lib/cv-standard/server");
const { toCheckView } = await import("@/app/cv/standard/view");

const exp = [
  {
    title: "Backend Developer",
    company: "Acme",
    start: "2021-01",
    end: null,
    bullets: ["Built a payments API serving 2M requests a day", "Cut p95 latency by 40%"],
  },
];
// Prisma list columns are never NULL — an empty row has [] everywhere.
const ROW = Object.fromEntries(
  "skills experience skillItems education languages projects volunteering customSections targetRoles targetSeniorities regions workModes companyTypes wantedTech avoidTech"
    .split(" ")
    .map((k) => [k, [] as unknown[]]),
);
const PROFILES: Record<string, Record<string, unknown>> = {
  current: {
    cvStandard: null,
    yearsExperience: 5,
    headline: "Backend developer",
    summary: "Backend developer with 5 years building APIs.",
    skillItems: [{ name: "TypeScript", category: "language" }],
    experience: exp,
    education: [{ degree: "B.Sc CS", school: "TAU", start: "2016", end: "2019" }],
  },
  // Legacy row: plain-string skills, no skillItems, stale cache from an older hash format.
  legacy: {
    cvStandard: { hash: "old", passed: true },
    yearsExperience: null,
    skills: ["Node", "SQL"],
    skillItems: [],
    experience: exp,
    education: [],
  },
  // Partial row: only a headline and one job without bullets.
  partial: {
    cvStandard: "garbage",
    headline: "Dev",
    experience: [{ title: "Dev", company: "X" }],
  },
};

describe("CV standard never crashes when the PDF page check fails", () => {
  beforeEach(() => {
    st.updates = 0;
    st.fitThrows = true;
  });
  for (const [name, profile] of Object.entries(PROFILES)) {
    it(`${name} profile: returns an error state instead of throwing`, async () => {
      st.profile = { userId: "u1", ...ROW, ...profile };
      const c = await checkCvStandard("u1");
      expect(c.fitError).toBe(true);
      expect(c.report.results.find((r) => r.id === "onePage")?.status).toBe("pending");
      expect(c.stored.passed).toBe(false);
      expect(st.updates).toBe(0); // a failed check is never cached
      const v = toCheckView(c);
      expect(v.fitError).toBe(true);
      expect(JSON.parse(JSON.stringify(v))).toBeTruthy(); // serializable for the client
      const g = await requireCvStandard("u1");
      expect(g.ok).toBe(c.report.contentPassed); // infra failure doesn't lock the user out
    });
  }
});

describe("Vercel tracing ships pdfkit's dynamic font files to every route", () => {
  it("includes pdfkit standard fonts + our fonts for all routes", async () => {
    const cfg = (await import("../next.config")).default as {
      outputFileTracingIncludes?: Record<string, string[]>;
    };
    const all = cfg.outputFileTracingIncludes?.["/**"] ?? [];
    expect(all).toContain("./node_modules/pdfkit/js/standard-fonts/**");
    expect(all).toContain("./src/lib/cv-templates/fonts/**");
  });
});
