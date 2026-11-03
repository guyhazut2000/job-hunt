import "server-only";
import type { ContactCategory, ContactStatus } from "@prisma/client";
import { db } from "@/lib/db";
import {
  DEFAULT_PREFS,
  followUpDue,
  statusCheckDue,
  goalProgress,
  pickQueue,
  QUEUE_AUDIENCE,
  type FollowUpDue,
  type GoalProgress,
  type OutreachPrefsInput,
  type QueueSource,
} from "./assistant";
import { outreachContext } from "./context";
import { followUpTemplate, type FollowUpMessage } from "./followup";
import { linkedinPeopleSearchUrl } from "./links";
import { templateMessage, type OutreachLang, type OutreachMessage } from "./messages";

const DAY = 86_400_000;
/** Don't suggest a company the user already wrote to in this window. */
const RECENT_DAYS = 21;

export interface QueueItem {
  key: string;
  source: QueueSource;
  category: ContactCategory;
  company: { id: string; name: string; slug: string };
  job: { id: string; title: string } | null;
  linkedin: string;
  messages: Record<OutreachLang, OutreachMessage>;
}

export interface TrackerContact {
  id: string;
  name: string;
  title: string | null;
  linkedinUrl: string | null;
  category: ContactCategory;
  status: ContactStatus;
  notes: string | null;
  sentAt: string | null;
  statusAt: string | null;
  followedUpAt: string | null;
  company: { id: string; name: string; slug: string } | null;
  job: { id: string; title: string } | null;
  /** Outbound LinkedIn people search for this person when no profile URL was saved. */
  searchUrl: string | null;
  /** Marked as a referral contact on /referrals (#92). */
  insider: boolean;
  due: { kind: FollowUpDue["kind"]; days: number; drafts: Record<OutreachLang, FollowUpMessage> } | null;
  /** Halfway to the nudge with no status change: ask "did they accept?" (#95). */
  check: boolean;
}

export interface OutreachDashboard {
  prefs: OutreachPrefsInput;
  progress: GoalProgress;
  queue: QueueItem[];
  contacts: TrackerContact[];
  dueCount: number;
}

export async function loadPrefs(userId: string): Promise<OutreachPrefsInput> {
  const p = await db.outreachPrefs.findUnique({ where: { userId } });
  return p ? { dailyGoal: p.dailyGoal, followUpDays: p.followUpDays, queueSize: p.queueSize } : DEFAULT_PREFS;
}

export async function loadOutreachDashboard(userId: string, now = new Date()): Promise<OutreachDashboard> {
  const [prefs, profile, user, contacts, apps] = await Promise.all([
    loadPrefs(userId),
    db.profile.findUnique({ where: { userId } }),
    db.user.findUnique({ where: { id: userId }, select: { name: true } }),
    db.contact.findMany({
      // Referral-only contacts (#92, manual/CSV, never messaged) live on /referrals.
      where: { userId, NOT: { insider: true, sentAt: null, status: "NOT_CONTACTED" } },
      orderBy: [{ updatedAt: "desc" }],
      take: 300,
      include: {
        company: { select: { id: true, name: true, slug: true } },
        job: { select: { id: true, title: true, applyUrl: true, techStack: true } },
      },
    }),
    db.application.findMany({
      where: { userId, status: { in: ["SAVED", "APPLIED"] }, job: { isActive: true } },
      orderBy: { updatedAt: "desc" },
      take: 60,
      select: {
        status: true,
        updatedAt: true,
        job: { select: { id: true, companyId: true } },
      },
    }),
  ]);

  const sent = contacts.flatMap((c) => (c.sentAt ? [c.sentAt] : []));
  const progress = goalProgress(sent, prefs.dailyGoal, now);

  // Queue: saved/applied jobs first, then fresh jobs in the user's target roles.
  const recent = new Set(
    contacts
      .filter((c) => c.companyId && (c.sentAt ?? c.createdAt).getTime() > now.getTime() - RECENT_DAYS * DAY)
      .map((c) => c.companyId!),
  );
  const cands = apps.flatMap((a) =>
    a.job
      ? [
          {
            source: (a.status === "APPLIED" ? "applied" : "saved") as QueueSource,
            companyId: a.job.companyId,
            jobId: a.job.id,
            at: a.updatedAt.getTime(),
          },
        ]
      : [],
  );
  if (new Set(cands.map((c) => c.companyId)).size < prefs.queueSize + recent.size) {
    const roles = profile?.targetRoles?.length ? profile.targetRoles : null;
    const fresh = await db.job.findMany({
      where: {
        isActive: true,
        // Interns/students aren't the user's level; null seniority (unknown) stays in.
        NOT: { seniority: "INTERN" },
        ...(roles ? { roleCategory: { in: roles } } : {}),
      },
      orderBy: { postedAt: "desc" },
      take: 60,
      select: { id: true, companyId: true, postedAt: true },
    });
    for (const j of fresh)
      cands.push({ source: "fresh", companyId: j.companyId, jobId: j.id, at: j.postedAt.getTime() });
  }
  const picked = pickQueue(cands, recent, prefs.queueSize);
  const jobs = picked.length
    ? await db.job.findMany({
        where: { id: { in: picked.flatMap((p) => (p.jobId ? [p.jobId] : [])) } },
        select: {
          id: true,
          title: true,
          applyUrl: true,
          techStack: true,
          roleCategory: true,
          company: { select: { id: true, name: true, slug: true } },
        },
      })
    : [];
  const byId = new Map(jobs.map((j) => [j.id, j]));
  const queue: QueueItem[] = picked.flatMap((p) => {
    const job = p.jobId ? byId.get(p.jobId) : undefined;
    if (!job) return [];
    const category = QUEUE_AUDIENCE[p.source];
    const ctx = outreachContext(job.company, job, profile, user?.name);
    return [
      {
        key: `${p.source}:${job.id}`,
        source: p.source,
        category,
        company: job.company,
        job: { id: job.id, title: job.title },
        linkedin: linkedinPeopleSearchUrl(job.company.name, category, job.roleCategory),
        messages: { he: templateMessage(category, ctx, "he"), en: templateMessage(category, ctx, "en") },
      },
    ];
  });

  const tracker: TrackerContact[] = contacts.map((c) => {
    const due = followUpDue(c, prefs.followUpDays, now);
    const check = !due && !!statusCheckDue(c, prefs.followUpDays, now);
    const ctx = c.company ? outreachContext(c.company, c.job, profile, user?.name) : null;
    const searchUrl =
      !c.linkedinUrl && c.company
        ? (() => {
            const u = new URL("https://www.linkedin.com/search/results/people/");
            u.searchParams.set("keywords", `${c.name} ${c.company.name}`);
            return u.toString();
          })()
        : null;
    return {
      id: c.id,
      name: c.name,
      title: c.title,
      linkedinUrl: c.linkedinUrl,
      category: c.category,
      status: c.status,
      notes: c.notes,
      sentAt: c.sentAt?.toISOString() ?? null,
      statusAt: c.statusAt?.toISOString() ?? null,
      followedUpAt: c.followedUpAt?.toISOString() ?? null,
      company: c.company,
      job: c.job ? { id: c.job.id, title: c.job.title } : null,
      searchUrl,
      insider: c.insider,
      due:
        due && ctx
          ? {
              kind: due.kind,
              days: due.days,
              drafts: {
                he: followUpTemplate(due.kind, c.category, ctx, "he"),
                en: followUpTemplate(due.kind, c.category, ctx, "en"),
              },
            }
          : null,
      check,
    };
  });
  // Due follow-ups first, then "did they accept?" checks, then by most recent activity.
  tracker.sort((a, b) => Number(!!b.due) - Number(!!a.due) || Number(b.check) - Number(a.check));
  return { prefs, progress, queue, contacts: tracker, dueCount: tracker.filter((c) => c.due).length };
}
