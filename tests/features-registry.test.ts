import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  CATEGORY_LABELS,
  FEATURES,
  FEATURE_CATEGORIES,
  ROUTE_ALLOWLIST,
  changelog,
  hrefPath,
  isNew,
  matchesRoute,
  routeFromPageFile,
  uncoveredRoutes,
} from "@/features";

/**
 * Keeps /features ("מה המערכת יודעת לעשות") honest. If this fails, update src/features/registry.ts
 * (see docs/features.md) — don't just add the route to ROUTE_ALLOWLIST.
 */
const APP = path.resolve(__dirname, "../src/app");
function pageFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === "api" && dir === APP ? [] : pageFiles(p);
    return /^page\.(tsx|ts|jsx|js|mdx)$/.test(e.name) ? [p] : [];
  });
}
const PAGE_ROUTES = pageFiles(APP).map(routeFromPageFile);

describe("route helpers", () => {
  it("maps page files to route patterns", () => {
    expect(routeFromPageFile("/x/src/app/page.tsx")).toBe("/");
    expect(routeFromPageFile("/x/src/app/jobs/[id]/page.tsx")).toBe("/jobs/[id]");
    expect(routeFromPageFile("src/app/(marketing)/about/page.tsx")).toBe("/about");
  });
  it("matches concrete paths to patterns", () => {
    expect(matchesRoute("/jobs/abc", "/jobs/[id]")).toBe(true);
    expect(matchesRoute("/jobs", "/jobs/[id]")).toBe(false);
    expect(matchesRoute("/", "/")).toBe(true);
    expect(hrefPath("/jobs?view=map#x")).toBe("/jobs");
  });
});

describe("feature registry", () => {
  it("found the app's pages", () => {
    expect(PAGE_ROUTES.length).toBeGreaterThan(10);
    expect(PAGE_ROUTES).toContain("/jobs");
  });

  it("covers every page route (add an entry to src/features/registry.ts for new pages)", () => {
    const missing = uncoveredRoutes(PAGE_ROUTES);
    expect(
      missing,
      `These pages have no entry in src/features/registry.ts: ${missing.join(", ")}. ` +
        "Add or extend a feature entry (routes: [...]) — see docs/features.md.",
    ).toEqual([]);
  });

  it("only lists routes that exist (remove or fix stale routes)", () => {
    const stale = FEATURES.flatMap((f) => f.routes.filter((r) => !PAGE_ROUTES.includes(r)).map((r) => `${f.id}: ${r}`));
    expect(stale).toEqual([]);
    const staleAllow = Object.keys(ROUTE_ALLOWLIST).filter((r) => !PAGE_ROUTES.includes(r));
    expect(staleAllow).toEqual([]);
  });

  it("links point at real pages", () => {
    const bad = FEATURES.filter((f) => f.href).filter(
      (f) => !PAGE_ROUTES.some((r) => matchesRoute(hrefPath(f.href!), r)),
    );
    expect(bad.map((f) => `${f.id}: ${f.href}`)).toEqual([]);
  });

  it("every entry is complete and well-formed", () => {
    const ids = new Set<string>();
    for (const f of FEATURES) {
      const where = `feature "${f.id}"`;
      expect(f.id, where).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(ids.has(f.id), `${where}: duplicate id`).toBe(false);
      ids.add(f.id);
      expect(f.name.trim().length, `${where}: name`).toBeGreaterThan(2);
      expect(f.description.trim().length, `${where}: description`).toBeGreaterThan(15);
      expect(/[\u0590-\u05FF]/.test(f.name + f.description), `${where}: name/description should be in Hebrew`).toBe(
        true,
      );
      expect(FEATURE_CATEGORIES, `${where}: category`).toContain(f.category);
      expect(f.added, `${where}: added`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(Date.parse(f.added)), `${where}: added`).toBe(false);
      for (const u of f.updates ?? []) expect(u.date, `${where}: update date`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      if (f.status === "planned") {
        expect(f.routes, `${where}: planned features have no live routes yet`).toEqual([]);
      } else {
        expect(f.howTo?.trim().length ?? 0, `${where}: howTo`).toBeGreaterThan(5);
        expect(f.routes.length > 0 || !!f.href, `${where}: needs routes or href`).toBe(true);
      }
    }
  });

  it("every category has a Hebrew label", () => {
    for (const c of FEATURE_CATEGORIES) expect(CATEGORY_LABELS[c]).toMatch(/\S/);
  });

  it("builds a newest-first changelog and a 14-day 'new' badge", () => {
    const log = changelog();
    expect(log.length).toBeGreaterThanOrEqual(FEATURES.length);
    for (let i = 1; i < log.length; i++) expect(log[i - 1].date >= log[i].date).toBe(true);
    const f = { ...FEATURES[0], status: "live" as const, added: "2026-10-20" };
    expect(isNew(f, new Date("2026-10-30T10:00:00Z"))).toBe(true);
    expect(isNew(f, new Date("2026-11-10T10:00:00Z"))).toBe(false);
    expect(isNew({ ...f, status: "planned" }, new Date("2026-10-21T10:00:00Z"))).toBe(false);
  });
});
