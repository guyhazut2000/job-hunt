"use server";
/** Work journal actions (docs/work-journal.md). Nothing reaches the profile without an explicit "add". */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { LIMITS } from "@/lib/cv-standard/rules";
import { answersSchema, isDay, israelDayOf, MAX_ENTRY_CHARS } from "@/lib/journal/core";
import {
  addBulletToRole,
  analyzeEntry,
  journalBullets,
  journalRoles,
  toView,
  type JournalEntryView,
} from "@/lib/journal/server";
import { requireUser } from "@/lib/session";

const PATH = "/cv/journal";

const entryInput = z.object({
  id: z.string().max(40).optional().nullable(),
  roleKey: z.string().max(400),
  day: z.string().refine(isDay),
  text: z.string().trim().min(10).max(MAX_ENTRY_CHARS),
});

export type SaveEntryResult = { ok: true; entry: JournalEntryView } | { ok: false; error: "invalid" | "notFound" };

export async function saveEntryAction(input: z.input<typeof entryInput>): Promise<SaveEntryResult> {
  const user = await requireUser(PATH);
  const parsed = entryInput.safeParse(input);
  if (!parsed.success || parsed.data.day > israelDayOf(new Date(Date.now() + 86_400_000)))
    return { ok: false, error: "invalid" };
  const { roles } = await journalRoles(user.id);
  const role = roles.find((r) => r.key === parsed.data.roleKey);
  if (roles.length && !role) return { ok: false, error: "invalid" };
  const data = { roleKey: role?.key ?? "", roleLabel: role?.label ?? "", day: parsed.data.day, text: parsed.data.text };
  let id = parsed.data.id ?? null;
  if (id) {
    const old = await db.workJournalEntry.findFirst({ where: { id, userId: user.id } });
    if (!old) return { ok: false, error: "notFound" };
    const changed = old.text !== data.text;
    await db.workJournalEntry.update({ where: { id }, data: changed ? { ...data, answers: [] } : data });
    if (!changed) {
      revalidatePath(PATH);
      return { ok: true, entry: toView((await db.workJournalEntry.findUnique({ where: { id } }))!) };
    }
  } else {
    id = (await db.workJournalEntry.create({ data: { userId: user.id, ...data } })).id;
  }
  const entry = await analyzeEntry(user.id, id);
  revalidatePath(PATH);
  return entry ? { ok: true, entry } : { ok: false, error: "notFound" };
}

export async function reanalyzeAction(id: string): Promise<JournalEntryView | null> {
  const user = await requireUser(PATH);
  const e = await analyzeEntry(user.id, String(id));
  revalidatePath(PATH);
  return e;
}

export async function saveAnswersAction(
  id: string,
  answers: { q: string; a: string }[],
): Promise<JournalEntryView | null> {
  const user = await requireUser(PATH);
  const parsed = answersSchema.safeParse(answers.map((x) => ({ q: x.q.trim(), a: x.a.trim() })).filter((x) => x.a));
  if (!parsed.success) return null;
  const e = await db.workJournalEntry.findFirst({ where: { id: String(id), userId: user.id } });
  if (!e) return null;
  const saved = await db.workJournalEntry.update({ where: { id: e.id }, data: { answers: parsed.data } });
  revalidatePath(PATH);
  return toView(saved);
}

export async function deleteEntryAction(id: string): Promise<boolean> {
  const user = await requireUser(PATH);
  const r = await db.workJournalEntry.deleteMany({ where: { id: String(id), userId: user.id } });
  revalidatePath(PATH);
  return r.count > 0;
}

const bulletsInput = z.object({
  roleKey: z.string().max(400),
  from: z.string().refine(isDay).nullable().optional(),
  to: z.string().refine(isDay).nullable().optional(),
  jobId: z.string().max(40).nullable().optional(),
});

export async function suggestBulletsAction(input: z.input<typeof bulletsInput>) {
  const user = await requireUser(PATH);
  const parsed = bulletsInput.safeParse(input);
  if (!parsed.success) return null;
  return journalBullets(user.id, parsed.data);
}

export async function acceptBulletAction(
  roleKey: string,
  text: string,
): Promise<"added" | "exists" | "no-role" | "invalid"> {
  const user = await requireUser(PATH);
  const t = String(text ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (t.length < 5 || t.length > LIMITS.bulletMaxChars) return "invalid";
  const r = await addBulletToRole(user.id, String(roleKey), t);
  if (r === "added") {
    revalidatePath("/profile");
    revalidatePath("/cv/standard");
  }
  return r;
}

const settingsInput = z.object({
  reminderOn: z.boolean(),
  frequency: z.enum(["daily", "weekly"]),
  weekday: z.number().int().min(0).max(6),
  hour: z.number().int().min(6).max(22),
});

export async function saveReminderAction(input: z.input<typeof settingsInput>): Promise<boolean> {
  const user = await requireUser(PATH);
  const parsed = settingsInput.safeParse(input);
  if (!parsed.success) return false;
  await db.workJournalSettings.upsert({
    where: { userId: user.id },
    create: { userId: user.id, ...parsed.data },
    update: parsed.data,
  });
  revalidatePath(PATH);
  return true;
}
