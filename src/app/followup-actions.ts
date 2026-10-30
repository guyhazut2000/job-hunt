"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { track } from "@/lib/analytics";
import { isEmail, type DraftLang, type FollowUpDraft } from "@/lib/followup/draft";
import { defaultLang, draftFacts, generateDraft, recruiterForApplication } from "@/lib/followup/server";
import { DAY_MS, FOLLOW_UP_MAX, SNOOZE_OPTIONS } from "@/lib/followup/timing";

/** Stored per language so switching language and back keeps the user's edits. */
type StoredDrafts = Partial<Record<DraftLang, FollowUpDraft>>;

export type DraftResult =
  | { ok: true; draft: FollowUpDraft; defaultLang: DraftLang; toSource: "saved" | "email" | null; sent: number }
  | { ok: false; error: "not_found" | "max" };

const langSchema = z.enum(["he", "en"]);

async function loadApp(userId: string, id: string) {
  return db.application.findFirst({
    where: { id, userId },
    include: { job: { select: { title: true, description: true, techStack: true } } },
  });
}

const readStored = (v: unknown): StoredDrafts => (v && typeof v === "object" && !Array.isArray(v) ? (v as StoredDrafts) : {});

/**
 * The draft for this application's next follow-up. Generated once per round + language (one guarded
 * AI call, template fallback) and then kept, so reopening never spends another AI call.
 */
export async function getFollowUpDraft(id: string, lang?: DraftLang, regenerate = false): Promise<DraftResult> {
  const user = await requireUser();
  const app = await loadApp(user.id, id);
  if (!app) return { ok: false, error: "not_found" };
  if (app.followUpCount >= FOLLOW_UP_MAX) return { ok: false, error: "max" };
  const round = (app.followUpCount + 1) as 1 | 2;
  const def = defaultLang(app);
  const want = lang ? langSchema.parse(lang) : (Object.values(readStored(app.followUpDraft)).find((d) => d?.round === round)?.lang ?? def);
  const stored = readStored(app.followUpDraft);
  const recruiter = await recruiterForApplication(user.id, app.id);
  const to = app.followUpTo ?? recruiter?.email ?? null;
  const toSource = app.followUpTo ? ("saved" as const) : recruiter ? ("email" as const) : null;
  const have = stored[want];
  if (have && have.round === round && !regenerate)
    return { ok: true, draft: { ...have, to }, defaultLang: def, toSource, sent: app.followUpCount };
  const facts = await draftFacts(user.id, app, want, recruiter?.firstName ?? null);
  const draft = await generateDraft(user.id, facts, want, to);
  await db.application.updateMany({
    where: { id: app.id, userId: user.id },
    data: { followUpDraft: { ...stored, [want]: draft } as unknown as Prisma.InputJsonValue },
  });
  track("followup_draft", { source: draft.source, lang: want, round });
  return { ok: true, draft, defaultLang: def, toSource, sent: app.followUpCount };
}

const editSchema = z.object({
  lang: langSchema,
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(5000),
  to: z.string().trim().max(200).optional().default(""),
});

/** Save the user's edits (and recipient) so they survive closing the dialog. */
export async function saveFollowUpDraft(id: string, input: z.input<typeof editSchema>) {
  const user = await requireUser();
  const v = editSchema.parse(input);
  const app = await loadApp(user.id, id);
  if (!app || app.followUpCount >= FOLLOW_UP_MAX) return { ok: false as const };
  const stored = readStored(app.followUpDraft);
  const round = (app.followUpCount + 1) as 1 | 2;
  const to = isEmail(v.to) ? v.to : null;
  const prev = stored[v.lang];
  const changed = !prev || prev.subject !== v.subject || prev.body !== v.body;
  const draft: FollowUpDraft = {
    round,
    lang: v.lang,
    subject: v.subject,
    body: v.body,
    source: changed ? "edited" : prev!.source,
    to,
  };
  await db.application.updateMany({
    where: { id, userId: user.id },
    data: {
      followUpDraft: { ...stored, [v.lang]: draft } as unknown as Prisma.InputJsonValue,
      followUpTo: to,
    },
  });
  return { ok: true as const };
}

/**
 * The user sent the follow-up himself (we never send mail). Logs it in the timeline, resets the
 * timer and moves to the next round. Idempotent: a double click can't log the same round twice.
 */
export async function markFollowUpSent(id: string, input: { lang: DraftLang; subject?: string; source?: string }) {
  const user = await requireUser();
  const lang = langSchema.parse(input.lang);
  const app = await db.application.findFirst({
    where: { id, userId: user.id },
    select: { id: true, followUpCount: true, status: true },
  });
  if (!app || app.followUpCount >= FOLLOW_UP_MAX) return { ok: false as const };
  const round = app.followUpCount + 1;
  const now = new Date();
  try {
    await db.$transaction([
      db.applicationFollowUp.create({
        data: {
          userId: user.id,
          applicationId: id,
          round,
          language: lang,
          subject: input.subject?.slice(0, 200) ?? null,
          source: input.source?.slice(0, 20) ?? null,
          sentAt: now,
        },
      }),
      db.application.updateMany({
        where: { id, userId: user.id, followUpCount: app.followUpCount },
        data: {
          followUpCount: round,
          lastFollowUpAt: now,
          followUpSnoozedUntil: null,
          followUpDraft: Prisma.DbNull,
        },
      }),
    ]);
  } catch (e) {
    if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
  }
  track("followup_sent", { round });
  revalidatePath("/dashboard");
  return { ok: true as const, round };
}

/** "Remind me later" — 3 or 7 days. */
export async function snoozeFollowUp(id: string, days: number) {
  const user = await requireUser();
  const d = (SNOOZE_OPTIONS as readonly number[]).includes(days) ? days : 3;
  await db.application.updateMany({
    where: { id, userId: user.id },
    data: { followUpSnoozedUntil: new Date(Date.now() + d * DAY_MS) },
  });
  revalidatePath("/dashboard");
}

/** "Don't remind me" for this application (reversible). */
export async function setFollowUpOff(id: string, off: boolean) {
  const user = await requireUser();
  await db.application.updateMany({ where: { id, userId: user.id }, data: { followUpOff: !!off } });
  revalidatePath("/dashboard");
}

/** Mark/unmark "no response" (ghosted). The status stays; reminders stop. */
export async function setNoResponse(id: string, on: boolean) {
  const user = await requireUser();
  await db.application.updateMany({
    where: { id, userId: user.id },
    data: { noResponseAt: on ? new Date() : null },
  });
  revalidatePath("/dashboard");
}
