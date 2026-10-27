import { describe, expect, it } from "vitest";
import { BACK_TO_TOP_THRESHOLD, backToTopBehavior, isScrollContainer, shouldShowBackToTop } from "@/lib/ui/back-to-top";

describe("back to top", () => {
  it("shows only after scrolling past the threshold", () => {
    expect(BACK_TO_TOP_THRESHOLD).toBe(400);
    expect(shouldShowBackToTop(0)).toBe(false);
    expect(shouldShowBackToTop(400)).toBe(false);
    expect(shouldShowBackToTop(401)).toBe(true);
    expect(shouldShowBackToTop(150, 100)).toBe(true);
    expect(shouldShowBackToTop(Number.NaN)).toBe(false);
  });

  it("respects prefers-reduced-motion", () => {
    expect(backToTopBehavior(true)).toBe("auto");
    expect(backToTopBehavior(false)).toBe("smooth");
  });

  it("detects a scrollable container", () => {
    expect(isScrollContainer({ scrollHeight: 2000, clientHeight: 600 }, "auto")).toBe(true);
    expect(isScrollContainer({ scrollHeight: 2000, clientHeight: 600 }, "scroll")).toBe(true);
    expect(isScrollContainer({ scrollHeight: 2000, clientHeight: 600 }, "visible")).toBe(false);
    expect(isScrollContainer({ scrollHeight: 600, clientHeight: 600 }, "auto")).toBe(false);
  });
});
