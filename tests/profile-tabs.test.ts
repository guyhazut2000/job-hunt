import { describe, expect, it } from "vitest";
import { legacyProfileHref, profileHref, resolveProfileView } from "@/lib/profile/tabs";

describe("profile & documents tabs", () => {
  it("defaults to the profile tab, professional section", () => {
    expect(resolveProfileView({})).toEqual({ tab: "profile", section: "pro" });
    expect(resolveProfileView({ tab: "nope", section: "nope" })).toEqual({ tab: "profile", section: "pro" });
  });
  it("reads the new tab/section params", () => {
    expect(resolveProfileView({ tab: "documents" }).tab).toBe("documents");
    expect(resolveProfileView({ tab: "profile", section: "prefs" })).toEqual({ tab: "profile", section: "prefs" });
    expect(resolveProfileView({ tab: ["documents", "profile"] }).tab).toBe("documents");
  });
  it("maps the old ?tab= values", () => {
    expect(resolveProfileView({ tab: "pro" })).toEqual({ tab: "profile", section: "pro" });
    expect(resolveProfileView({ tab: "prefs" })).toEqual({ tab: "profile", section: "prefs" });
    expect(resolveProfileView({ tab: "cvs" }).tab).toBe("documents");
  });
  it("builds canonical links", () => {
    expect(profileHref("documents")).toBe("/profile?tab=documents");
    expect(profileHref("profile")).toBe("/profile?tab=profile");
    expect(profileHref("profile", "prefs")).toBe("/profile?tab=profile&section=prefs");
    expect(legacyProfileHref("cvs")).toBe("/profile?tab=documents");
    expect(legacyProfileHref("prefs")).toBe("/profile?tab=profile&section=prefs");
    // every built link resolves back to the same view
    for (const href of [profileHref("documents"), profileHref("profile", "prefs"), profileHref("profile")]) {
      const sp = Object.fromEntries(new URL(href, "http://x").searchParams);
      const v = resolveProfileView(sp);
      expect(profileHref(v.tab, v.section)).toBe(href);
    }
  });
});
