import { beforeEach, describe, expect, it, vi } from "vitest";

const st = vi.hoisted(() => ({
  ok: false,
  prev: { status: "SAVED", statusChangedAt: new Date() } as { status: string; statusChangedAt: Date } | null,
  updates: 0,
}));

vi.mock("@/lib/session", () => ({ requireUser: async () => ({ id: "u1" }), requireAdmin: async () => ({ id: "a" }) }));
vi.mock("@/lib/cv-standard/server", () => ({ requireCvStandard: async () => ({ ok: st.ok, stored: null }) }));
vi.mock("@/lib/db", () => ({
  db: {
    application: {
      findFirst: async () => st.prev,
      updateMany: async () => {
        st.updates++;
        return { count: 1 };
      },
    },
  },
}));
vi.mock("@/lib/email/auto-apply", () => ({ logStatusChange: async () => {} }));
vi.mock("@/lib/analytics", () => ({ track: () => {} }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/auth", () => ({ signIn: async () => {}, signOut: async () => {} }));
vi.mock("next-auth", () => ({ AuthError: class extends Error {} }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined, set: () => {} }) }));
vi.mock("@/lib/ai", () => ({ guardedLLM: async () => null }));

const { updateApplicationStatus } = await import("@/app/actions");

describe("APPLIED gate (#94)", () => {
  beforeEach(() => {
    st.ok = false;
    st.updates = 0;
    st.prev = { status: "SAVED", statusChangedAt: new Date() };
  });
  it("blocks SAVED → APPLIED when the CV fails the standard", async () => {
    expect(await updateApplicationStatus("a1", "APPLIED")).toEqual({ blocked: "cv" });
    expect(st.updates).toBe(0);
  });
  it("blocks skipping straight to INTERVIEW too", async () => {
    expect(await updateApplicationStatus("a1", "INTERVIEW")).toEqual({ blocked: "cv" });
  });
  it("allows REJECTED and moves of already-sent applications", async () => {
    await updateApplicationStatus("a1", "REJECTED");
    st.prev = { status: "APPLIED", statusChangedAt: new Date() };
    await updateApplicationStatus("a1", "INTERVIEW");
    expect(st.updates).toBe(2);
  });
  it("allows SAVED → APPLIED when the CV passes", async () => {
    st.ok = true;
    expect(await updateApplicationStatus("a1", "APPLIED")).toBeUndefined();
    expect(st.updates).toBe(1);
  });
});
