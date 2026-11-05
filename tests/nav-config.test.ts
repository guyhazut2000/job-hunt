import { describe, expect, it } from "vitest";
import { navigationStrings } from "@/lib/i18n/navigation";
import {
  MORE_SECTION_IDS,
  activeMobileId,
  activePrimaryId,
  activeTargetId,
  hubStrip,
  mobileBarLinks,
  moreSections,
  navItemIds,
  primaryLinks,
  type MoreSectionId,
  type NavRole,
} from "@/lib/nav/config";

const ROLES: NavRole[] = ["guest", "user", "admin"];

function hrefs(role: NavRole, surface: "desktop" | "mobile"): string[] {
  return moreSections(role, surface).flatMap((section) => section.items.map((item) => item.href));
}

function sectionIds(role: NavRole, surface: "desktop" | "mobile"): MoreSectionId[] {
  return moreSections(role, surface).map((section) => section.id);
}

describe("primary destinations", () => {
  it("gives signed-in users the five hubs and nothing else", () => {
    for (const role of ["user", "admin"] as const) {
      expect(primaryLinks(role).map((link) => link.href)).toEqual([
        "/jobs",
        "/companies",
        "/dashboard",
        "/profile",
        "/learn",
      ]);
      expect(primaryLinks(role)).toHaveLength(5);
    }
  });

  it("keeps the guest bar light: jobs, companies, learn, features", () => {
    expect(primaryLinks("guest").map((link) => link.href)).toEqual(["/jobs", "/companies", "/learn", "/features"]);
    expect(primaryLinks("guest").some((link) => link.href === "/dashboard" || link.href === "/profile")).toBe(false);
  });

  it("marks the hub, not a single page, as the current primary link", () => {
    expect(activePrimaryId("user", "/jobs/step-up")).toBe("jobs");
    expect(activePrimaryId("user", "/jobs/abc")).toBe("jobs");
    expect(activePrimaryId("user", "/referrals")).toBe("companies");
    expect(activePrimaryId("user", "/outreach")).toBe("companies");
    expect(activePrimaryId("user", "/closing")).toBe("tracker");
    expect(activePrimaryId("user", "/salary/offers")).toBe("tracker");
    expect(activePrimaryId("user", "/cv/ats")).toBe("documents");
    expect(activePrimaryId("user", "/profile")).toBe("documents");
    expect(activePrimaryId("user", "/learn/gaps")).toBe("prep");
    expect(activePrimaryId("user", "/interview/abc")).toBe("prep");
    expect(activePrimaryId("user", "/prep/manager")).toBe("prep");
    expect(activePrimaryId("guest", "/features")).toBe("features");
    expect(activePrimaryId("user", "/features")).toBeNull();
    expect(activePrimaryId("user", "/stats")).toBeNull();
  });

  it("never lights two primary links at once", () => {
    const paths = ["/jobs/step-up", "/companies/acme", "/salary", "/cv/linkedin", "/learn/me", "/features", "/coach"];
    for (const role of ROLES) {
      for (const path of paths) {
        const hits = primaryLinks(role).filter((link) => activePrimaryId(role, path) === link.id);
        expect(hits.length).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("secondary hub tabs", () => {
  it("shows jobs siblings and does not mark search active on ranking or the map", () => {
    const ranking = hubStrip("/jobs/ranking", "", "user");
    expect(ranking?.hubId).toBe("jobs");
    expect(ranking?.tabs.map((tab) => tab.id)).toEqual(["jobs-search", "jobs-map", "jobs-ranking", "jobs-step-up"]);
    expect(ranking?.activeId).toBe("jobs-ranking");

    expect(hubStrip("/jobs/step-up", "", "user")?.activeId).toBe("jobs-step-up");
    expect(hubStrip("/jobs", "", "user")?.activeId).toBe("jobs-search");
    expect(hubStrip("/jobs", "view=map", "user")?.activeId).toBe("jobs-map");
    expect(hubStrip("/jobs", "?view=map&company=acme", "user")?.activeId).toBe("jobs-map");
  });

  it("leaves job detail without a strip, while the jobs primary link stays current", () => {
    expect(hubStrip("/jobs/abc", "", "user")).toBeNull();
    expect(activePrimaryId("user", "/jobs/abc")).toBe("jobs");
  });

  it("hides signed-in-only jobs tabs from guests, and still shows search and map", () => {
    expect(hubStrip("/jobs", "", "guest")?.tabs.map((tab) => tab.id)).toEqual(["jobs-search", "jobs-map"]);
  });

  it("groups companies, outreach and referrals, and skips a one-tab strip for guests", () => {
    expect(hubStrip("/companies", "", "user")?.tabs.map((tab) => tab.href)).toEqual([
      "/companies",
      "/outreach",
      "/referrals",
    ]);
    expect(hubStrip("/referrals", "", "user")?.activeId).toBe("companies-referrals");
    expect(hubStrip("/companies/acme", "", "user")?.activeId).toBe("companies-list");
    expect(hubStrip("/companies", "", "guest")).toBeNull();
  });

  it("groups the tracker and keeps salary's own pages on the salary tab", () => {
    expect(hubStrip("/closing/references", "", "user")?.activeId).toBe("tracker-closing");
    expect(hubStrip("/salary/negotiate", "", "user")?.activeId).toBe("tracker-salary");
    expect(hubStrip("/salary", "", "guest")).toBeNull();
  });

  it("shows the documents strip on CV tools, not on the profile page that already has tabs", () => {
    const ats = hubStrip("/cv/ats", "", "user");
    expect(ats?.hubId).toBe("documents");
    expect(ats?.activeId).toBe("documents-ats");
    expect(ats?.tabs.map((tab) => tab.href)).toEqual([
      "/profile",
      "/cv/standard",
      "/cv",
      "/cv/tailor",
      "/cv/ats",
      "/cv/linkedin",
    ]);
    expect(hubStrip("/cv", "", "user")?.activeId).toBe("documents-templates");
    expect(hubStrip("/cv/templates/hitech", "", "user")?.activeId).toBe("documents-templates");
    expect(hubStrip("/cv/tailor/job-1", "", "user")?.activeId).toBe("documents-tailor");
    expect(hubStrip("/cv/tailor/job-1/print", "", "user")).toBeNull();
    expect(hubStrip("/profile", "", "user")).toBeNull();
    expect(hubStrip("/profile/review/cv-1", "", "user")?.activeId).toBe("documents-profile");
  });

  it("groups prep siblings and lets the longest prefix win", () => {
    const gaps = hubStrip("/learn/gaps", "", "user");
    expect(gaps?.hubId).toBe("prep");
    expect(gaps?.activeId).toBe("prep-gaps");
    expect(hubStrip("/learn/problem-solving/practice", "", "user")?.activeId).toBe("prep-problem-solving");
    expect(hubStrip("/learn/system-design/ai", "", "user")?.activeId).toBe("prep-system-design");
    expect(hubStrip("/learn/system-design/ai", "", "guest")?.activeId).toBe("prep-system-design");
    expect(hubStrip("/learn/react", "", "user")?.activeId).toBe("prep-learn");
    expect(hubStrip("/learn/me", "", "user")?.activeId).toBe("prep-me");
    expect(hubStrip("/prep/manager", "", "user")?.activeId).toBe("prep-manager");
    expect(hubStrip("/prep/app-1", "", "user")?.activeId).toBeNull();
    expect(hubStrip("/interview/session-1", "", "user")?.activeId).toBe("prep-interview");
    expect(hubStrip("/learn", "", "guest")?.tabs.map((tab) => tab.id)).toEqual([
      "prep-learn",
      "prep-system-design",
      "prep-problem-solving",
    ]);
  });
});

describe("More menu sections", () => {
  it("drops hub destinations from the signed-in desktop menu", () => {
    const allowed = new Set(["/stats", "/coach", "/digest", "/chat", "/features", "/admin"]);
    for (const role of ["user", "admin"] as const) {
      for (const href of hrefs(role, "desktop")) expect(allowed.has(href)).toBe(true);
      expect(hrefs(role, "desktop")).not.toContain("/salary");
      expect(hrefs(role, "desktop")).not.toContain("/learn/gaps");
      expect(hrefs(role, "desktop")).not.toContain("/closing");
      expect(hrefs(role, "desktop")).not.toContain("/cv/ats");
      expect(sectionIds(role, "desktop")).not.toContain("prep");
    }
    expect(sectionIds("user", "desktop")).toEqual(["progress", "tools"]);
    expect(sectionIds("admin", "desktop")).toEqual(["progress", "tools", "admin"]);
    expect(sectionIds("user", "mobile")).not.toContain("admin");
    expect(sectionIds("admin", "mobile")).toContain("admin");
    expect(sectionIds("guest", "desktop")).not.toContain("admin");
    expect(sectionIds("guest", "mobile")).not.toContain("admin");
  });

  it("puts prep in the mobile sheet only when it is not already on the bottom bar", () => {
    expect(sectionIds("user", "mobile")[0]).toBe("prep");
    expect(moreSections("user", "mobile")[0]?.items.map((item) => item.href)).toEqual([
      "/learn",
      "/learn/me",
      "/learn/gaps",
      "/learn/system-design",
      "/learn/problem-solving",
      "/learn/concepts",
      "/prep/manager",
      "/interview",
    ]);
    expect(sectionIds("guest", "mobile")).not.toContain("prep");
    expect(sectionIds("guest", "desktop")).toEqual(["tools"]);
    expect(hrefs("guest", "desktop")).toEqual(["/salary"]);
    expect(hrefs("guest", "mobile")).toEqual(["/features", "/salary"]);
  });

  it("highlights the matching more item, including nested digest pages", () => {
    const progress = moreSections("user", "desktop").find((section) => section.id === "progress");
    expect(activeTargetId(progress!.items, "/digest/day-1")).toBe("digest");
    expect(activeTargetId(progress!.items, "/coach")).toBe("coach");
    const prep = moreSections("user", "mobile").find((section) => section.id === "prep");
    expect(activeTargetId(prep!.items, "/learn/gaps")).toBe("prep-gaps");
    expect(activeTargetId(prep!.items, "/learn/gaps")).not.toBe("prep-learn");
  });
});

describe("mobile bottom bar", () => {
  it("stays within four destinations so More makes five", () => {
    for (const role of ROLES) expect(mobileBarLinks(role).length).toBeLessThanOrEqual(4);
    expect(mobileBarLinks("user").map((link) => link.id)).toEqual(["jobs", "companies", "tracker", "documents"]);
    expect(mobileBarLinks("admin").map((link) => link.id)).toEqual(["jobs", "companies", "tracker", "documents"]);
    expect(mobileBarLinks("guest").map((link) => link.id)).toEqual(["jobs", "companies", "prep"]);
  });

  it("lights the bar item for a hub, and More when the page only lives in the sheet", () => {
    expect(activeMobileId("user", "/jobs/step-up")).toBe("jobs");
    expect(activeMobileId("user", "/cv/ats")).toBe("documents");
    expect(activeMobileId("user", "/closing")).toBe("tracker");
    expect(activeMobileId("user", "/learn/gaps")).toBe("more");
    expect(activeMobileId("user", "/stats")).toBe("more");
    expect(activeMobileId("guest", "/learn/gaps")).toBe("prep");
    expect(activeMobileId("guest", "/salary")).toBe("more");
    expect(activeMobileId("guest", "/features")).toBe("more");
    expect(activeMobileId("admin", "/admin")).toBe("more");
    expect(activeMobileId("user", "/admin")).toBeNull();
  });
});

describe("navigation copy", () => {
  it("has a Hebrew and an English label for every destination and section", () => {
    const he = navigationStrings("he");
    const en = navigationStrings("en");
    for (const id of navItemIds()) {
      expect(he.items[id as keyof typeof he.items]?.trim().length, id).toBeGreaterThan(0);
      expect(en.items[id as keyof typeof en.items]?.trim().length, id).toBeGreaterThan(0);
    }
    for (const id of MORE_SECTION_IDS) {
      expect(he.sections[id]).toMatch(/[\u0590-\u05FF]/);
      expect(en.sections[id]).not.toMatch(/[\u0590-\u05FF]/);
    }
    expect(he.items.jobs).toMatch(/[\u0590-\u05FF]/);
    expect(en.items.jobs).toBe("Jobs");
    expect(he.sections.progress).toBe("התקדמות");
    expect(en.sections.progress).toBe("Progress");
  });
});
