import { describe, expect, it } from "vitest";
import { GRAPH, prerequisitePath } from "@/lib/learning/graph";
import { LEARN_CATEGORIES } from "@/lib/learning/types";
import { CATEGORY_HUE, categoryTone, levelFromDepth, matchesQuery, monogram } from "@/lib/learning/ui";

describe("levelFromDepth", () => {
  it("buckets prerequisite depth", () => {
    expect(levelFromDepth(0)).toBe("beginner");
    expect(levelFromDepth(1)).toBe("beginner");
    expect(levelFromDepth(2)).toBe("intermediate");
    expect(levelFromDepth(3)).toBe("intermediate");
    expect(levelFromDepth(4)).toBe("advanced");
    expect(levelFromDepth(12)).toBe("advanced");
  });

  it("puts foundations below the tools built on them", () => {
    const depth = (id: string) => prerequisitePath(id).filter((x) => x !== id).length;
    const ids = GRAPH.nodes.map((n) => n.id);
    const leaf = ids.find((id) => GRAPH.byId.get(id)!.prerequisites.length === 0)!;
    expect(levelFromDepth(depth(leaf))).toBe("beginner");
    if (GRAPH.byId.has("kubernetes")) expect(levelFromDepth(depth("kubernetes"))).not.toBe("beginner");
  });
});

describe("monogram", () => {
  it("takes two glyphs and keeps language suffixes", () => {
    expect(monogram("Kubernetes")).toBe("Ku");
    expect(monogram("CI/CD")).toBe("CI");
    expect(monogram("C++")).toBe("C++");
    expect(monogram("C#")).toBe("C#");
    expect(monogram("Node.js")).toBe("No");
  });

  it("never returns an empty string for a real node", () => {
    for (const n of GRAPH.nodes) expect(monogram(n.label).length).toBeGreaterThan(0);
  });
});

describe("matchesQuery", () => {
  const k8s = { id: "kubernetes", label: "Kubernetes", aliases: ["k8s"] };
  it("matches label, alias and id case-insensitively", () => {
    expect(matchesQuery("", k8s)).toBe(true);
    expect(matchesQuery("  ", k8s)).toBe(true);
    expect(matchesQuery("KUBER", k8s)).toBe(true);
    expect(matchesQuery("K8s", k8s)).toBe(true);
    expect(matchesQuery("docker", k8s)).toBe(false);
  });
});

describe("categoryTone", () => {
  it("covers every category with a light tile and dark text", () => {
    for (const c of LEARN_CATEGORIES) {
      expect(CATEGORY_HUE[c]).toBeTypeOf("number");
      const t = categoryTone(c);
      expect(t.background).toMatch(/^oklch\(0\.935 /);
      expect(t.color).toMatch(/^oklch\(0\.4 /);
    }
  });
});
