import { describe, expect, it } from "vitest";
import {
  BULK_MAX,
  followUpDue,
  quickNextStatuses,
  statusCheckDays,
  statusCheckDedupeKey,
  statusCheckDue,
  statusPatch,
  type FollowUpContact,
} from "@/lib/outreach/assistant";
import { outreachAssistantStrings } from "@/lib/i18n/outreach-assistant";

/** #95: less manual status friction on /outreach, without reading or automating LinkedIn. */
const NOW = new Date("2026-11-03T10:00:00Z");
const at = (daysAgo: number) => new Date(Date.UTC(2026, 10, 3 - daysAgo, 10));
const contact = (over: Partial<FollowUpContact> = {}): FollowUpContact => ({
  status: "SENT",
  sentAt: at(3),
  statusAt: at(3),
  createdAt: at(3),
  followedUpAt: null,
  ...over,
});

describe("did-they-accept check", () => {
  it("fires halfway to the nudge, and never together with it", () => {
    expect(statusCheckDays(5)).toBe(2);
    expect(statusCheckDays(2)).toBe(1);
    expect(statusCheckDue(contact({ sentAt: at(1) }), 5, NOW)).toBeNull();
    expect(statusCheckDue(contact({ sentAt: at(2) }), 5, NOW)).toMatchObject({ days: 2 });
    expect(statusCheckDue(contact({ sentAt: at(4) }), 5, NOW)).toMatchObject({ days: 4 });
    // On the nudge day the nudge takes over.
    const c = contact({ sentAt: at(5) });
    expect(statusCheckDue(c, 5, NOW)).toBeNull();
    expect(followUpDue(c, 5, NOW)?.kind).toBe("nudge");
  });
  it("only for requests still marked sent and not followed up", () => {
    for (const status of ["ACCEPTED", "REPLIED", "REFERRED", "NOT_CONTACTED"] as const)
      expect(statusCheckDue(contact({ status }), 5, NOW)).toBeNull();
    expect(statusCheckDue(contact({ followedUpAt: at(0) }), 5, NOW)).toBeNull();
  });
  it("dedupes per contact and send day, separately from the follow-up key", () => {
    expect(statusCheckDedupeKey("c1", at(3))).toBe("outreach:c1:check:2026-10-31");
    expect(statusCheckDedupeKey("c1", at(3))).not.toBe(statusCheckDedupeKey("c2", at(3)));
  });
  it("has Hebrew and English notification copy with every placeholder filled", () => {
    for (const l of ["he", "en"] as const) {
      expect(outreachAssistantStrings[l].notifyCheckTitle).toContain("{name}");
      expect(outreachAssistantStrings[l].notifyCheck).toMatch(/\{days\}[\s\S]*\{name\}[\s\S]*\{company\}/);
    }
  });
});

describe("one-tap next steps", () => {
  it("offers the likely next statuses, most likely first", () => {
    expect(quickNextStatuses("NOT_CONTACTED")).toEqual(["SENT"]);
    expect(quickNextStatuses("SENT")).toEqual(["ACCEPTED", "REPLIED"]);
    expect(quickNextStatuses("ACCEPTED")).toEqual(["REPLIED"]);
    expect(quickNextStatuses("REPLIED")).toEqual(["REFERRED"]);
    expect(quickNextStatuses("REFERRED")).toEqual([]);
  });
  it("a bulk update keeps each contact's first sent time", () => {
    const sent = at(4);
    expect(statusPatch({ sentAt: sent }, "ACCEPTED", NOW)).toEqual({ status: "ACCEPTED", statusAt: NOW });
    expect(statusPatch({ sentAt: null }, "ACCEPTED", NOW)).toEqual({ status: "ACCEPTED", statusAt: NOW, sentAt: NOW });
    expect(BULK_MAX).toBeGreaterThanOrEqual(50);
  });
});
