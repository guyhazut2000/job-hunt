import { Prisma } from "@prisma/client";
import { SYNC_FAILING_THRESHOLD } from "@/lib/companies/status";
import { db } from "@/lib/db";
import type { Locale } from "@/lib/i18n/dictionaries";
import { fill, notificationStrings } from "@/lib/i18n/notifications";
import { notify } from "./create";

/** Only failures this recent are alerted (an old, forgotten outage doesn't page anyone on deploy). */
const RECENT_MS = 2 * 24 * 60 * 60 * 1000;
const LIST_COMPANIES = 5;

/**
 * Stays the same for a whole failing streak: the last successful sync (a success resets the streak
 * and moves it). So each outage of a company is alerted once, however many scans fail.
 */
export function streakKey(c: { lastSyncedAt: Date | null }): string {
  return c.lastSyncedAt ? c.lastSyncedAt.toISOString() : "never";
}

export interface FailingCompany {
  id: string;
  name: string;
  slug: string;
  syncFailures: number;
  lastSyncError: string | null;
}

export function buildAdminAlert(
  locale: Locale,
  companies: FailingCompany[],
): { title: string; body: string; url: string } {
  const s = notificationStrings(locale);
  const lines = companies
    .slice(0, LIST_COMPANIES)
    .map((c) => `• ${c.name} (${c.syncFailures}×): ${(c.lastSyncError ?? "").slice(0, 120)}`);
  if (companies.length > LIST_COMPANIES) lines.push(fill(s.matchMore, { n: companies.length - LIST_COMPANIES }));
  return {
    title:
      companies.length === 1
        ? fill(s.scanFailAdminOne, { company: companies[0].name })
        : fill(s.scanFailAdminTitle, { n: companies.length }),
    body: lines.join("\n"),
    url: "/admin",
  };
}

export function buildFollowerAlert(locale: Locale, c: FailingCompany): { title: string; body: string; url: string } {
  const s = notificationStrings(locale);
  return {
    title: fill(s.scanFailTitle, { company: c.name }),
    body: fill(s.scanFailBody, { n: c.syncFailures }),
    // Same-site only (the open route refuses external URLs); the company page links its careers page.
    url: `/companies/${c.slug}`,
  };
}

export interface ScanFailureRunSummary {
  newlyFailing: number;
  admins: number;
  followers: number;
}

/**
 * SCAN_FAILED alerts: when an AUTO company's feed has failed SYNC_FAILING_THRESHOLD scans in a row,
 * admins get one grouped notification per run and the company's followers one each — once per
 * failing streak (ScanFailureAlert row, race-safe through its unique key).
 */
export async function runScanFailureAlerts(now = new Date()): Promise<ScanFailureRunSummary> {
  const failing = await db.company.findMany({
    where: {
      syncMode: "AUTO",
      atsProvider: { not: "MANUAL" },
      atsBoardId: { not: null },
      syncFailures: { gte: SYNC_FAILING_THRESHOLD },
      lastSyncErrorAt: { gte: new Date(now.getTime() - RECENT_MS) },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      syncFailures: true,
      lastSyncError: true,
      lastSyncedAt: true,
    },
  });
  const summary: ScanFailureRunSummary = { newlyFailing: 0, admins: 0, followers: 0 };
  if (!failing.length) return summary;

  const fresh: FailingCompany[] = [];
  for (const c of failing) {
    try {
      await db.scanFailureAlert.create({
        data: { companyId: c.id, streakKey: streakKey(c), error: c.lastSyncError?.slice(0, 500) },
      });
      fresh.push(c);
    } catch (e) {
      // Already alerted for this streak (or a concurrent run got it first).
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue;
      throw e;
    }
  }
  summary.newlyFailing = fresh.length;
  if (!fresh.length) return summary;

  const admins = await db.user.findMany({
    where: { role: "ADMIN" },
    select: { id: true, locale: true },
  });
  for (const a of admins) {
    const locale: Locale = a.locale === "en" ? "en" : "he";
    const created = await notify(
      a.id,
      {
        kind: "SCAN_FAILED",
        ...buildAdminAlert(locale, fresh),
        data: { companyIds: fresh.map((c) => c.id) },
        dedupeKey: `scanfail:admin:${now.toISOString()}`,
      },
      { now },
    );
    if (created) summary.admins++;
  }

  const adminIds = new Set(admins.map((a) => a.id));
  const follows = await db.companyFollow.findMany({
    where: { companyId: { in: fresh.map((c) => c.id) } },
    select: { userId: true, companyId: true, user: { select: { locale: true } } },
  });
  const byId = new Map(failing.map((c) => [c.id, c]));
  for (const f of follows) {
    // Admins already got the grouped alert for this run.
    if (adminIds.has(f.userId)) continue;
    const c = byId.get(f.companyId)!;
    const locale: Locale = f.user.locale === "en" ? "en" : "he";
    const created = await notify(
      f.userId,
      {
        kind: "SCAN_FAILED",
        ...buildFollowerAlert(locale, c),
        data: { companyId: c.id },
        dedupeKey: `scanfail:${c.id}:${streakKey(c)}`,
      },
      { now },
    );
    if (created) summary.followers++;
  }
  return summary;
}
