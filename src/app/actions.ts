"use server";

import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import type { ApplicationStatus, AtsProvider } from "@prisma/client";
import { signIn, signOut } from "@/auth";
import { safeNextPath } from "@/lib/safe-next";
import { guardedLLM } from "@/lib/ai";
import { generateCvSuggestions } from "@/lib/ai/cv-suggestions";
import type { CvSuggestion } from "@/lib/ai/types";
import { track } from "@/lib/analytics";
import { db } from "@/lib/db";
import { logStatusChange } from "@/lib/email/auto-apply";
import { getDictionary, LOCALE_COOKIE } from "@/lib/i18n";
import { aiLimitMessage } from "@/lib/i18n/ai";
import { SUPPORTED_PROVIDERS } from "@/lib/ingestion/registry";
import { ingestAll } from "@/lib/ingestion/run";
import { safeHttpUrl } from "@/lib/companies/status";
import { addCandidateAsManual, ingestDiscovered, runDiscovery } from "@/lib/discovery/run";
import { requireAdmin, requireUser } from "@/lib/session";
import { slugify } from "@/lib/taxonomy";
import { baseDomain } from "@/lib/discovery/domain";
import { parseSuggestion, SUGGEST_DAILY_LIMIT, suggestedBy, USER_PRIORITY, USER_SOURCE } from "@/lib/discovery/suggest";

export type FormState = { error?: string; ok?: string } | undefined;

export async function setLocale(formData: FormData) {
  const locale = formData.get("locale") === "en" ? "en" : "he";
  (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  revalidatePath("/", "layout");
}

const registerSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(200),
});

export async function register(_: FormState, formData: FormData): Promise<FormState> {
  const { t } = await getDictionary();
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues.some((i) => i.path[0] === "password") ? t.auth.weak : t.auth.invalid };
  }
  const { name, email, password } = parsed.data;
  if (await db.user.findUnique({ where: { email } })) return { error: t.auth.exists };
  await db.user.create({
    data: { name, email, passwordHash: await bcrypt.hash(password, 10), profile: { create: { skills: [] } } },
  });
  track("signup");
  formData.set("next", "/onboarding");
  return login(undefined, formData);
}

export async function login(_: FormState, formData: FormData): Promise<FormState> {
  const { t } = await getDictionary();
  try {
    await signIn("credentials", {
      email: String(formData.get("email") ?? "").toLowerCase(),
      password: String(formData.get("password") ?? ""),
      redirectTo: safeNextPath(String(formData.get("next") ?? "")) ?? "/jobs",
    });
  } catch (e) {
    if (e instanceof AuthError) return { error: t.auth.invalid };
    throw e; // NEXT_REDIRECT on success
  }
  return undefined;
}

export async function logout() {
  await signOut({ redirectTo: "/" });
}

export async function saveJob(jobId: string) {
  const user = await requireUser();
  const job = await db.job.findUniqueOrThrow({ where: { id: jobId }, include: { company: true } });
  await db.application.upsert({
    where: { userId_jobId: { userId: user.id, jobId } },
    create: { userId: user.id, jobId, title: job.title, company: job.company.name, url: job.applyUrl },
    update: {},
  });
  track("job_saved", { jobId });
  revalidatePath("/dashboard");
  revalidatePath(`/jobs/${jobId}`);
}

const STATUSES: ApplicationStatus[] = ["SAVED", "APPLIED", "SCREENING", "INTERVIEW", "OFFER", "REJECTED"];

export async function updateApplicationStatus(id: string, status: ApplicationStatus) {
  const user = await requireUser();
  if (!STATUSES.includes(status)) throw new Error("Invalid status");
  const prev = await db.application.findFirst({
    where: { id, userId: user.id },
    select: { status: true, statusChangedAt: true },
  });
  if (!prev) return;
  await db.application.updateMany({
    where: { id, userId: user.id },
    data: { status, statusChangedAt: new Date(), ...(status === "APPLIED" ? { appliedAt: new Date() } : {}) },
  });
  // Timeline entry; also makes later, older emails unable to override this manual change.
  await logStatusChange(db, {
    userId: user.id,
    applicationId: id,
    from: prev.status,
    to: status,
    source: "MANUAL",
    prevStatusChangedAt: prev.statusChangedAt,
  });
  track("application_status_changed", { status });
  revalidatePath("/dashboard");
}

export async function removeApplication(id: string) {
  const user = await requireUser();
  await db.application.deleteMany({ where: { id, userId: user.id } });
  revalidatePath("/dashboard");
}

const manualSchema = z.object({
  title: z.string().trim().min(1).max(150),
  company: z.string().trim().min(1).max(100),
  url: z.union([z.literal(""), z.string().url().max(500)]).optional(),
});

export async function addManualApplication(formData: FormData) {
  const user = await requireUser();
  const parsed = manualSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  await db.application.create({
    data: { userId: user.id, title: parsed.data.title, company: parsed.data.company, url: parsed.data.url || null },
  });
  revalidatePath("/dashboard");
}

export async function getCvSuggestions(
  jobId: string,
): Promise<{ error?: string; notice?: string; cached?: boolean; provider?: string; suggestions?: CvSuggestion[] }> {
  const user = await requireUser();
  const { locale, t } = await getDictionary();
  const [job, resume] = await Promise.all([
    db.job.findUnique({ where: { id: jobId } }),
    db.resume.findFirst({ where: { userId: user.id, isPrimary: true } }),
  ]);
  if (!job) return { error: "Job not found" };
  if (!resume) return { error: t.jobs.cvTipsNeedCv };
  // Same limits for everyone: the AI guard (per-user daily cap, app-wide caps, cache) applies.
  const provider = await guardedLLM("cv_tips", user.id);
  const res = await generateCvSuggestions({ resumeText: resume.text, job, locale }, provider);
  track("cv_suggestions_generated", { provider: res.provider, cached: !!provider.cached });
  return {
    ...res,
    cached: !!provider.cached,
    ...(provider.limited ? { notice: aiLimitMessage(provider.limited, locale) } : {}),
  };
}

export async function adminSyncAll() {
  await requireAdmin();
  // Same time budget as the cron route so the action returns before the function limit.
  await ingestAll({ timeBudgetMs: 230_000 });
  revalidatePath("/admin");
  revalidatePath("/jobs");
}

const companySchema = z.object({
  name: z.string().trim().min(1).max(100),
  provider: z.enum(SUPPORTED_PROVIDERS as [AtsProvider, ...AtsProvider[]]),
  boardId: z.string().trim().min(1).max(200),
  website: z.union([z.literal(""), z.string().url()]).optional(),
});

export async function adminAddCompany(formData: FormData) {
  await requireAdmin();
  const parsed = companySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const { name, provider, boardId, website } = parsed.data;
  await db.company.upsert({
    where: { slug: slugify(name) },
    create: {
      slug: slugify(name),
      name,
      atsProvider: provider as AtsProvider,
      atsBoardId: boardId,
      website: website || null,
      syncMode: "AUTO",
      addedVia: "admin",
    },
    update: { atsProvider: provider as AtsProvider, atsBoardId: boardId, syncMode: "AUTO" },
  });
  revalidatePath("/admin");
  revalidatePath("/companies");
}

/** An optional http(s) URL; LinkedIn and other non-company pages are rejected (see safeHttpUrl). */
const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .optional()
  .transform((v, ctx) => {
    if (!v) return null;
    const url = safeHttpUrl(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    if (!url) ctx.addIssue({ code: "custom", message: "invalid url" });
    return url;
  });

const manualCompanySchema = z.object({
  name: z.string().trim().min(1).max(100),
  website: optionalUrl,
  careersUrl: optionalUrl,
  notesHe: z.string().trim().max(1000).optional(),
  notesEn: z.string().trim().max(1000).optional(),
});

/** Add (or update) a company the user checks by hand: no feed, just its careers site and notes. */
export async function adminAddManualCompany(_: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const { t } = await getDictionary();
  const parsed = manualCompanySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: t.admin.invalidManual };
  const { name, website, careersUrl, notesHe, notesEn } = parsed.data;
  if (!website && !careersUrl) return { error: t.admin.invalidManual };
  const slug = slugify(name);
  if (!slug) return { error: t.admin.invalidManual };
  const fields = {
    name,
    website: website ?? careersUrl,
    careersUrl: careersUrl ?? website,
    notesHe: notesHe || null,
    notesEn: notesEn || null,
  };
  const existing = await db.company.findUnique({ where: { slug }, select: { id: true } });
  if (existing) {
    // Keep its feed configuration; the admin can switch it to manual explicitly.
    await db.company.update({ where: { id: existing.id }, data: fields });
  } else {
    await db.company.create({
      data: { slug, ...fields, atsProvider: "MANUAL", syncMode: "MANUAL", addedVia: "admin" },
    });
  }
  revalidatePath("/admin");
  revalidatePath("/companies");
  return { ok: t.admin.savedManual };
}

/** Flip a company between automatic sync and manual checking. Jobs already pulled stay as they are. */
export async function adminSetSyncMode(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("companyId") ?? "");
  const mode = formData.get("mode") === "AUTO" ? "AUTO" : "MANUAL";
  const company = await db.company.findUnique({ where: { id }, select: { atsBoardId: true, atsProvider: true } });
  if (!company) return;
  // AUTO needs a configured board; otherwise it would silently never sync.
  if (mode === "AUTO" && (!company.atsBoardId || company.atsProvider === "MANUAL")) return;
  await db.company.update({
    where: { id },
    data: { syncMode: mode, ...(mode === "AUTO" ? { syncFailures: 0 } : {}) },
  });
  revalidatePath("/admin");
  revalidatePath("/companies");
}

export async function adminRunDiscovery() {
  await requireAdmin();
  const started = Date.now();
  await runDiscovery({ trigger: "admin", timeBudgetMs: 200_000 });
  await ingestDiscovered(started + 230_000).catch(() => 0);
  revalidatePath("/admin");
  revalidatePath("/companies");
}

export async function adminApproveCandidate(formData: FormData) {
  await requireAdmin();
  const candidate = await db.startupCandidate.findUnique({ where: { id: String(formData.get("candidateId") ?? "") } });
  if (!candidate || candidate.status !== "PENDING") return;
  await addCandidateAsManual(candidate, "admin");
  revalidatePath("/admin");
  revalidatePath("/companies");
}

export async function adminRejectCandidate(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("candidateId") ?? "");
  await db.startupCandidate.updateMany({ where: { id, status: "PENDING" }, data: { status: "REJECTED" } });
  revalidatePath("/admin");
}

export type SuggestState = { ok?: true; error?: "invalid" | "exists" | "queued" | "limit" } | undefined;

/**
 * A signed-in user suggests a missing company (name + its own site). It lands in the discovery queue as
 * a USER candidate; the next discovery run detects its ATS (AUTO / review) like any other candidate.
 */
export async function suggestCompany(_: SuggestState, formData: FormData): Promise<SuggestState> {
  const user = await requireUser();
  const s = parseSuggestion(formData.get("name"), formData.get("url"));
  if (!s) return { error: "invalid" };
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recent = await db.startupCandidate.count({
    where: { source: USER_SOURCE, sourceUrl: suggestedBy(user.id), createdAt: { gte: since } },
  });
  if (recent >= SUGGEST_DAILY_LIMIT) return { error: "limit" };
  const base = baseDomain(s.domain);
  const listed = await db.company.findFirst({
    where: {
      OR: [
        { slug: slugify(s.name) },
        { website: { contains: base, mode: "insensitive" } },
        { careersUrl: { contains: base, mode: "insensitive" } },
      ],
    },
    select: { id: true },
  });
  if (listed) return { error: "exists" };
  if (await db.startupCandidate.findUnique({ where: { domain: s.domain }, select: { id: true } })) {
    return { error: "queued" };
  }
  await db.startupCandidate.create({
    data: {
      domain: s.domain,
      name: s.name,
      website: s.website,
      source: USER_SOURCE,
      sourceUrl: suggestedBy(user.id),
      priority: USER_PRIORITY,
    },
  });
  track("company_suggested");
  revalidatePath("/admin");
  return { ok: true };
}
