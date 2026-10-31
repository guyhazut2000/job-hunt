import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ONBOARDING_STEPS,
  advanceStored,
  currentStep,
  missingParts,
  profileIncomplete,
  shouldAutoStartOnboarding,
  shouldOnboard,
} from "@/lib/profile/onboarding";
import { dictionaries } from "@/lib/i18n/dictionaries";

const full = {
  headline: "Backend developer",
  summary: "",
  skills: ["Go"],
  skillItems: [],
  experience: [{ company: "Acme" }],
  education: [],
  targetRoles: ["backend"],
};

describe("onboarding: incomplete profile", () => {
  it("lists every part for a missing / empty profile", () => {
    expect(missingParts(null)).toEqual(["about", "skills", "background", "goals"]);
    expect(missingParts({ skills: [], experience: [], education: [], targetRoles: [] })).toEqual([
      "about",
      "skills",
      "background",
      "goals",
    ]);
  });
  it("is complete with an about line, skills, background and a goal", () => {
    expect(profileIncomplete(full)).toBe(false);
    // v1 desiredRole and v2 skillItems count too
    expect(
      profileIncomplete({ ...full, targetRoles: [], desiredRole: "backend", skills: [], skillItems: [{ name: "Go" }] }),
    ).toBe(false);
  });
  it("flags each missing part", () => {
    expect(missingParts({ ...full, headline: " " })).toEqual(["about"]);
    expect(missingParts({ ...full, experience: [] })).toEqual(["background"]);
    expect(missingParts({ ...full, experience: [], education: [{ institution: "TAU" }] })).toEqual([]);
    expect(missingParts({ ...full, targetRoles: [] })).toEqual(["goals"]);
  });
});

describe("onboarding: when to send the user there", () => {
  it("only for incomplete profiles that never finished or skipped it", () => {
    expect(shouldOnboard(null)).toBe(true);
    expect(shouldOnboard({ ...full, headline: "" })).toBe(true);
    expect(shouldOnboard(full)).toBe(false);
    expect(shouldOnboard({ ...full, headline: "", onboardedAt: new Date() })).toBe(false);
  });
  it("auto-redirects only before the wizard was ever opened", () => {
    expect(shouldAutoStartOnboarding({ skills: [] })).toBe(true);
    expect(shouldAutoStartOnboarding({ skills: [], onboardingStep: 2 })).toBe(false);
  });
});

describe("onboarding: resumable steps", () => {
  it("an explicit ?step= wins and is clamped", () => {
    expect(currentStep("3", 1)).toBe(3);
    expect(currentStep("9", 1)).toBe(ONBOARDING_STEPS);
    expect(currentStep("0", 2)).toBe(2);
    expect(currentStep("abc", null)).toBe(1);
  });
  it("without ?step= resumes at the stored step", () => {
    expect(currentStep(undefined, 3)).toBe(3);
    expect(currentStep(undefined, null)).toBe(1);
    expect(currentStep(undefined, 12)).toBe(ONBOARDING_STEPS);
  });
  it("the stored step only moves forward", () => {
    expect(advanceStored(null, 1)).toBe(1);
    expect(advanceStored(2, 3)).toBe(3);
    expect(advanceStored(3, 2)).toBeNull();
    expect(advanceStored(3, 3)).toBeNull();
  });
  it("both locales have a label per step", () => {
    for (const d of Object.values(dictionaries)) expect(d.pv2.onboarding.steps).toHaveLength(ONBOARDING_STEPS);
  });
});

// ── finishOnboarding (server action) ──
const h = vi.hoisted(() => ({ upserts: [] as unknown[], redirects: [] as string[] }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((to: string) => {
    h.redirects.push(to);
    throw new Error("NEXT_REDIRECT");
  }),
}));
vi.mock("@/lib/session", () => ({ requireUser: vi.fn(async () => ({ id: "u1" })) }));
vi.mock("@/lib/db", () => ({
  db: { profile: { upsert: vi.fn(async (a: unknown) => h.upserts.push(a)) } },
}));

describe("finishOnboarding", () => {
  beforeEach(() => {
    h.upserts.length = 0;
    h.redirects.length = 0;
  });
  const run = async (template?: string) => {
    const { finishOnboarding } = await import("@/app/onboarding/actions");
    const fd = new FormData();
    if (template) fd.set("template", template);
    await expect(finishOnboarding(fd)).rejects.toThrow("NEXT_REDIRECT");
  };
  it("stores the picked template, marks onboarding done and goes to the matches", async () => {
    await run("creative");
    const a = h.upserts[0] as { update: Record<string, unknown> };
    expect(a.update.cvTemplate).toBe("creative");
    expect(a.update.onboardingStep).toBe(ONBOARDING_STEPS);
    expect(a.update.onboardedAt).toBeInstanceOf(Date);
    expect(h.redirects).toEqual(["/jobs?welcome=1"]);
  });
  it("ignores an unknown template id", async () => {
    await run("../../etc");
    const a = h.upserts[0] as { update: Record<string, unknown> };
    expect("cvTemplate" in a.update).toBe(false);
  });
});
