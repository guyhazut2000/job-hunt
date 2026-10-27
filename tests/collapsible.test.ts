import { describe, expect, it } from "vitest";
import { COLLAPSE_MAX_DESKTOP, COLLAPSE_MAX_MOBILE, collapseLimit, needsCollapse } from "@/lib/ui/collapsible";

describe("collapsible text", () => {
  it("uses the mobile limit below md and the desktop limit from md", () => {
    expect(collapseLimit(375)).toBe(COLLAPSE_MAX_MOBILE);
    expect(collapseLimit(767)).toBe(260);
    expect(collapseLimit(768)).toBe(COLLAPSE_MAX_DESKTOP);
    expect(collapseLimit(1280)).toBe(320);
  });

  it("only collapses content taller than the limit", () => {
    expect(needsCollapse(200, 260)).toBe(false);
    expect(needsCollapse(261, 260)).toBe(false);
    expect(needsCollapse(400, 260)).toBe(true);
  });
});
