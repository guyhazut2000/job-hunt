import { describe, expect, it } from "vitest";
import { loginPath, safeNextPath } from "@/lib/safe-next";

describe("safeNextPath", () => {
  it("keeps same-site paths with query strings", () => {
    expect(safeNextPath("/digest/abc")).toBe("/digest/abc");
    expect(safeNextPath("/jobs?q=react&view=map")).toBe("/jobs?q=react&view=map");
  });

  it.each([
    undefined,
    null,
    "",
    "https://evil.com",
    "//evil.com",
    "/\\evil.com",
    "/\\/evil.com",
    "javascript:alert(1)",
    "/foo\nbar",
    `/${"a".repeat(600)}`,
  ])("rejects %s", (v) => {
    expect(safeNextPath(v)).toBeUndefined();
  });
});

describe("loginPath", () => {
  it("encodes the return path", () => {
    expect(loginPath("/interview/x1?limit=1")).toBe("/login?next=%2Finterview%2Fx1%3Flimit%3D1");
  });
  it("falls back to plain /login", () => {
    expect(loginPath()).toBe("/login");
    expect(loginPath("//evil.com")).toBe("/login");
    expect(loginPath("/login")).toBe("/login");
  });
});
