"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { track } from "@/lib/analytics";
import { db } from "@/lib/db";
import { getLocale } from "@/lib/i18n";
import { EMPTY_OFFER } from "@/lib/offers/calc";
import { MAX_CONTRACT_CHARS, type ScanResult } from "@/lib/closing/analysis";
import { canUndo, newBatchId, parseAcceptance, pickArchivable, type Acceptance } from "@/lib/closing/archive";
import { assignmentInputSchema, israelLocalToDate } from "@/lib/closing/assignments";
import { ITEM_IDS, parseChecklist, setItem } from "@/lib/closing/checklist";
import { refereeInputSchema } from "@/lib/closing/referees";
import { scanContract } from "@/lib/closing/server";
import { addItem, parseTransition, removeItem, toggleItem, transitionSchema } from "@/lib/closing/transition";
import { requireUser } from "@/lib/session";

/**
 * Final stage (#111): home assignments, referees, contract checklist + scan, transition plan, accept/undo.
 * Nothing here sends a message; drafts are rendered for the user to copy.
 */

const MAX_OFFERS = 20;
const id64 = z.string().min(1).max(64);
const json = (v: unknown) => v as Prisma.InputJsonValue;
const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" ? v : undefined;
};

function revalidateClosing(offerId?: string) {
  revalidatePath("/closing");
  if (offerId) revalidatePath(`/closing/${offerId}`);
}

async function ownApplication(userId: string, applicationId: string) {
  return db.application.findFirst({
    where: { id: applicationId, userId },
    select: { id: true, title: true, company: true },
  });
}

// ───────────────────────── offers ─────────────────────────

/** Open the final stage for an application in OFFER status: creates a saved offer linked to it. */
export async function startClosingFromApp(fd: FormData): Promise<void> {
  const user = await requireUser("/closing");
  const appId = id64.safeParse(str(fd, "applicationId"));
  if (!appId.success) redirect("/closing");
  const app = await ownApplication(user.id, appId.data);
  if (!app) redirect("/closing");
  const existing = await db.jobOffer.findFirst({
    where: { userId: user.id, applicationId: app.id },
    select: { id: true },
  });
  if (existing) redirect(`/closing/${existing.id}`);
  if ((await db.jobOffer.count({ where: { userId: user.id } })) >= MAX_OFFERS) redirect("/closing?limit=1");
  const data = { ...EMPTY_OFFER, label: app.company.slice(0, 80), company: app.company.slice(0, 120) };
  const offer = await db.jobOffer.create({
    data: { userId: user.id, label: data.label || "Offer", data: json(data), applicationId: app.id },
  });
  await db.offerClosing.create({ data: { userId: user.id, offerId: offer.id } });
  track("offer_saved");
  redirect(`/closing/${offer.id}`);
}

async function ownClosing(userId: string, offerId: string) {
  return db.offerClosing.findFirst({ where: { offerId, userId } });
}

// ───────────────────────── contract checklist ─────────────────────────

const itemPatch = z.object({
  offerId: id64,
  itemId: z.string().refine((s) => ITEM_IDS.includes(s)),
  status: z.enum(["todo", "ok", "concern"]).optional(),
  note: z.string().max(1000).optional(),
});

export async function saveChecklistItem(input: z.input<typeof itemPatch>): Promise<{ ok: boolean }> {
  const user = await requireUser();
  const p = itemPatch.safeParse(input);
  if (!p.success) return { ok: false };
  const c = await ownClosing(user.id, p.data.offerId);
  if (!c) return { ok: false };
  const patch: { status?: "todo" | "ok" | "concern"; note?: string } = {};
  if (p.data.status) patch.status = p.data.status;
  if (p.data.note !== undefined) patch.note = p.data.note;
  const next = setItem(parseChecklist(c.checklist), p.data.itemId, patch);
  await db.offerClosing.update({ where: { id: c.id }, data: { checklist: json(next) } });
  track("contract_checked", { item: p.data.itemId, status: patch.status ?? null });
  revalidateClosing(p.data.offerId);
  return { ok: true };
}

export type ScanState = { ok: true; result: ScanResult } | { error: "short" | "invalid" } | undefined;

export async function runContractScan(_prev: ScanState, fd: FormData): Promise<ScanState> {
  const user = await requireUser();
  const offerId = id64.safeParse(str(fd, "offerId"));
  const text = (str(fd, "text") ?? "").slice(0, MAX_CONTRACT_CHARS);
  if (!offerId.success) return { error: "invalid" };
  if (text.trim().length < 80) return { error: "short" };
  const c = await ownClosing(user.id, offerId.data);
  if (!c) return { error: "invalid" };
  const lang = await getLocale();
  const result = await scanContract(user.id, text, lang);
  // Only the result (verbatim quotes) is stored, never the full pasted contract.
  await db.offerClosing.update({ where: { id: c.id }, data: { analysis: json(result) } });
  track("contract_scanned", { source: result.source });
  revalidateClosing(offerId.data);
  return { ok: true, result };
}

// ───────────────────────── transition ─────────────────────────

const dayOrEmpty = z
  .string()
  .max(10)
  .refine((s) => s === "" || /^\d{4}-\d{2}-\d{2}$/.test(s));

const noticeForm = z.object({
  offerId: id64,
  currentStart: dayOrEmpty.default(""),
  payBasis: z.enum(["monthly", "hourly"]).default("monthly"),
  contractNoticeDays: z
    .string()
    .max(4)
    .default("")
    .transform((s) => (s.trim() === "" ? null : Number(s)))
    .refine((n) => n === null || (Number.isInteger(n) && n >= 0 && n <= 365)),
  noticeDate: dayOrEmpty.default(""),
  newStart: dayOrEmpty.default(""),
  employer: z.string().trim().max(120).default(""),
  manager: z.string().trim().max(120).default(""),
});

export async function saveNoticeInputs(fd: FormData): Promise<void> {
  const user = await requireUser();
  const p = noticeForm.safeParse(Object.fromEntries(fd));
  if (!p.success) return;
  const c = await ownClosing(user.id, p.data.offerId);
  if (!c) return;
  const { offerId, ...fields } = p.data;
  const prev = transitionSchema.parse(c.transition && typeof c.transition === "object" ? c.transition : {});
  await db.offerClosing.update({ where: { id: c.id }, data: { transition: json({ ...prev, ...fields }) } });
  track("transition_saved", { part: "notice" });
  revalidateClosing(offerId);
}

const listOp = z.object({
  offerId: id64,
  list: z.enum(["handover", "firstDay"]),
  op: z.enum(["toggle", "add", "remove"]),
  itemId: z.string().max(40).optional(),
  done: z.boolean().optional(),
  text: z.string().max(300).optional(),
});

export async function updateTransitionList(input: z.input<typeof listOp>): Promise<{ ok: boolean }> {
  const user = await requireUser();
  const p = listOp.safeParse(input);
  if (!p.success) return { ok: false };
  const c = await ownClosing(user.id, p.data.offerId);
  if (!c) return { ok: false };
  const lang = await getLocale();
  const view = parseTransition(c.transition, lang);
  let items = view[p.data.list];
  if (p.data.op === "toggle" && p.data.itemId) items = toggleItem(items, p.data.itemId, !!p.data.done);
  if (p.data.op === "add" && p.data.text) items = addItem(items, p.data.text, p.data.list === "handover" ? "h" : "f");
  if (p.data.op === "remove" && p.data.itemId) items = removeItem(items, p.data.itemId);
  const stored = transitionSchema.parse(c.transition && typeof c.transition === "object" ? c.transition : {});
  // Persist the (possibly default) list so later language switches don't reset the user's edits.
  await db.offerClosing.update({
    where: { id: c.id },
    data: { transition: json({ ...stored, [p.data.list]: items }) },
  });
  revalidateClosing(p.data.offerId);
  return { ok: true };
}

const planForm = z.object({
  offerId: id64,
  d30: z.string().max(3000).default(""),
  d60: z.string().max(3000).default(""),
  d90: z.string().max(3000).default(""),
});

export async function savePlan(fd: FormData): Promise<void> {
  const user = await requireUser();
  const p = planForm.safeParse(Object.fromEntries(fd));
  if (!p.success) return;
  const c = await ownClosing(user.id, p.data.offerId);
  if (!c) return;
  const stored = transitionSchema.parse(c.transition && typeof c.transition === "object" ? c.transition : {});
  const { offerId, ...plan } = p.data;
  await db.offerClosing.update({ where: { id: c.id }, data: { transition: json({ ...stored, plan }) } });
  track("transition_saved", { part: "plan" });
  revalidateClosing(offerId);
}

// ───────────────────────── accept / undo ─────────────────────────

export type AcceptState = { ok: true } | { error: "invalid" | "confirm" | "other" } | undefined;

/**
 * Mark the offer accepted, archive every other open application (status untouched), optionally pause job
 * alerts, and store an undo record. One transaction.
 */
export async function acceptOffer(_prev: AcceptState, fd: FormData): Promise<AcceptState> {
  const user = await requireUser();
  const offerId = id64.safeParse(str(fd, "offerId"));
  if (!offerId.success) return { error: "invalid" };
  if (str(fd, "confirm") !== "on") return { error: "confirm" };
  const pause = str(fd, "pause") === "on";
  const offer = await db.jobOffer.findFirst({
    where: { id: offerId.data, userId: user.id },
    select: { id: true, applicationId: true },
  });
  if (!offer) return { error: "invalid" };
  const other = await db.jobOffer.findFirst({
    where: { userId: user.id, acceptedAt: { not: null }, id: { not: offer.id } },
    select: { id: true },
  });
  if (other) return { error: "other" };

  const now = new Date();
  const apps = await db.application.findMany({
    where: { userId: user.id, archivedAt: null },
    select: { id: true, status: true, archivedAt: true },
  });
  const toArchive = pickArchivable(apps, offer.applicationId).map((a) => a.id);
  const batch = toArchive.length ? newBatchId(now) : null;

  let highMatchWas: boolean | null = null;
  let savedSearchIds: string[] = [];
  if (pause) {
    const pref = await db.notificationPreference.findUnique({
      where: { userId: user.id },
      select: { highMatchEnabled: true },
    });
    highMatchWas = pref ? pref.highMatchEnabled : null;
    savedSearchIds = (
      await db.savedSearch.findMany({ where: { userId: user.id, active: true }, select: { id: true } })
    ).map((s) => s.id);
  }
  const acceptance: Acceptance = {
    acceptedAt: now.toISOString(),
    batch,
    archivedIds: toArchive,
    paused: { highMatchWas: pause ? highMatchWas : null, savedSearchIds },
    undoneAt: null,
  };

  await db.$transaction([
    db.jobOffer.update({ where: { id: offer.id }, data: { acceptedAt: now } }),
    ...(toArchive.length
      ? [
          db.application.updateMany({
            where: { id: { in: toArchive }, userId: user.id, archivedAt: null },
            data: { archivedAt: now, archiveBatch: batch },
          }),
        ]
      : []),
    ...(pause && highMatchWas
      ? [db.notificationPreference.update({ where: { userId: user.id }, data: { highMatchEnabled: false } })]
      : []),
    ...(savedSearchIds.length
      ? [db.savedSearch.updateMany({ where: { id: { in: savedSearchIds }, userId: user.id }, data: { active: false } })]
      : []),
    db.offerClosing.upsert({
      where: { offerId: offer.id },
      create: { userId: user.id, offerId: offer.id, acceptance: json(acceptance) },
      update: { acceptance: json(acceptance) },
    }),
  ]);
  track("offer_accepted", { archived: toArchive.length, paused: pause });
  revalidateClosing(offer.id);
  revalidatePath("/dashboard");
  return { ok: true };
}

/** Undo the accept step: unarchive this batch, restore paused alerts, clear acceptedAt. */
export async function undoAccept(fd: FormData): Promise<void> {
  const user = await requireUser();
  const offerId = id64.safeParse(str(fd, "offerId"));
  if (!offerId.success) return;
  const c = await ownClosing(user.id, offerId.data);
  const acc = parseAcceptance(c?.acceptance);
  if (!c || !acc || !canUndo(acc, new Date())) return;
  await db.$transaction([
    db.jobOffer.updateMany({ where: { id: offerId.data, userId: user.id }, data: { acceptedAt: null } }),
    ...(acc.batch
      ? [
          db.application.updateMany({
            where: { userId: user.id, archiveBatch: acc.batch },
            data: { archivedAt: null, archiveBatch: null },
          }),
        ]
      : []),
    ...(acc.paused.highMatchWas
      ? [db.notificationPreference.updateMany({ where: { userId: user.id }, data: { highMatchEnabled: true } })]
      : []),
    ...(acc.paused.savedSearchIds.length
      ? [
          db.savedSearch.updateMany({
            where: { id: { in: acc.paused.savedSearchIds }, userId: user.id },
            data: { active: true },
          }),
        ]
      : []),
    db.offerClosing.update({
      where: { id: c.id },
      data: { acceptance: json({ ...acc, undoneAt: new Date().toISOString() }) },
    }),
  ]);
  track("offer_accept_undone");
  revalidateClosing(offerId.data);
  revalidatePath("/dashboard");
}

// ───────────────────────── home assignments ─────────────────────────

function assignmentData(d: z.infer<typeof assignmentInputSchema>) {
  const submitted = d.status === "SUBMITTED" || d.status === "FEEDBACK";
  return {
    title: d.title,
    description: d.description ?? null,
    link: d.link ?? null,
    receivedAt: israelLocalToDate(d.receivedAt ?? null),
    dueAt: israelLocalToDate(d.dueAt ?? null),
    estimatedHours: d.estimatedHours ?? null,
    status: d.status,
    submittedLink: d.submittedLink ?? null,
    notes: d.notes ?? null,
    submitted,
  };
}

const formObj = (fd: FormData) => {
  const o: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (typeof v === "string") o[k] = v;
  if (o.estimatedHours === "") delete o.estimatedHours;
  return o;
};

export async function saveAssignment(fd: FormData): Promise<void> {
  const user = await requireUser();
  const o = formObj(fd);
  const p = assignmentInputSchema.safeParse(o);
  const back =
    o.back === "app" ? `/closing/assignments?app=${encodeURIComponent(o.applicationId ?? "")}` : "/closing/assignments";
  if (!p.success) redirect(`${back}${back.includes("?") ? "&" : "?"}error=1`);
  const app = await ownApplication(user.id, p.data.applicationId);
  if (!app) redirect("/closing/assignments?error=1");
  const { submitted, ...data } = assignmentData(p.data);
  const id = o.id ? id64.safeParse(o.id) : null;
  if (id?.success) {
    const prev = await db.homeAssignment.findFirst({
      where: { id: id.data, userId: user.id },
      select: { submittedAt: true },
    });
    if (!prev) redirect("/closing/assignments?error=1");
    await db.homeAssignment.update({
      where: { id: id.data },
      data: { ...data, applicationId: app.id, submittedAt: submitted ? (prev.submittedAt ?? new Date()) : null },
    });
  } else {
    await db.homeAssignment.create({
      data: { ...data, userId: user.id, applicationId: app.id, submittedAt: submitted ? new Date() : null },
    });
  }
  track("assignment_saved", { status: p.data.status });
  revalidatePath("/closing/assignments");
  revalidatePath("/closing");
  redirect(back);
}

export async function deleteAssignment(fd: FormData): Promise<void> {
  const user = await requireUser();
  const id = id64.safeParse(str(fd, "id"));
  if (id.success) await db.homeAssignment.deleteMany({ where: { id: id.data, userId: user.id } });
  revalidatePath("/closing/assignments");
  revalidatePath("/closing");
}

// ───────────────────────── referees ─────────────────────────

export async function saveReferee(fd: FormData): Promise<void> {
  const user = await requireUser();
  const o = formObj(fd);
  const p = refereeInputSchema.safeParse(o);
  if (!p.success)
    redirect(`/closing/references?error=${encodeURIComponent(String(p.error.issues[0]?.path[0] ?? "name"))}`);
  const id = o.id ? id64.safeParse(o.id) : null;
  if (id?.success) {
    const res = await db.referee.updateMany({ where: { id: id.data, userId: user.id }, data: p.data });
    if (res.count === 0) redirect("/closing/references?error=name");
  } else {
    if ((await db.referee.count({ where: { userId: user.id } })) >= 50) redirect("/closing/references?error=limit");
    await db.referee.create({ data: { ...p.data, userId: user.id } });
  }
  track("referee_saved", { consent: p.data.consent });
  revalidatePath("/closing/references");
  revalidatePath("/closing");
  redirect("/closing/references");
}

export async function deleteReferee(fd: FormData): Promise<void> {
  const user = await requireUser();
  const id = id64.safeParse(str(fd, "id"));
  if (id.success) await db.referee.deleteMany({ where: { id: id.data, userId: user.id } });
  revalidatePath("/closing/references");
  revalidatePath("/closing");
}

export async function linkReferee(fd: FormData): Promise<void> {
  const user = await requireUser();
  const refereeId = id64.safeParse(str(fd, "refereeId"));
  const applicationId = id64.safeParse(str(fd, "applicationId"));
  if (!refereeId.success || !applicationId.success) return;
  const [ref, app] = await Promise.all([
    db.referee.findFirst({ where: { id: refereeId.data, userId: user.id }, select: { id: true } }),
    ownApplication(user.id, applicationId.data),
  ]);
  if (!ref || !app) return;
  const expectedCallAt = israelLocalToDate(str(fd, "expectedCallAt") || null);
  await db.refereeLink.upsert({
    where: { refereeId_applicationId: { refereeId: ref.id, applicationId: app.id } },
    create: { refereeId: ref.id, applicationId: app.id, expectedCallAt },
    update: { expectedCallAt },
  });
  revalidatePath("/closing/references");
  revalidatePath("/closing");
}

const linkMark = z.object({
  linkId: id64,
  field: z.enum(["briefedAt", "calledAt", "thankedAt"]),
  on: z.enum(["1", "0"]),
});

export async function markRefereeLink(fd: FormData): Promise<void> {
  const user = await requireUser();
  const p = linkMark.safeParse(formObj(fd));
  if (!p.success) return;
  const link = await db.refereeLink.findFirst({
    where: { id: p.data.linkId, referee: { userId: user.id } },
    select: { id: true, refereeId: true },
  });
  if (!link) return;
  const at = p.data.on === "1" ? new Date() : null;
  await db.refereeLink.update({ where: { id: link.id }, data: { [p.data.field]: at } });
  if (at) await db.referee.update({ where: { id: link.refereeId }, data: { lastContactedAt: at } });
  revalidatePath("/closing/references");
  revalidatePath("/closing");
}

export async function unlinkReferee(fd: FormData): Promise<void> {
  const user = await requireUser();
  const linkId = id64.safeParse(str(fd, "linkId"));
  if (!linkId.success) return;
  await db.refereeLink.deleteMany({ where: { id: linkId.data, referee: { userId: user.id } } });
  revalidatePath("/closing/references");
  revalidatePath("/closing");
}
