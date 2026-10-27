"use server";

import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ApplicationStatus, AtsProvider } from "@prisma/client";
import { signIn, signOut } from "@/auth";
import { generateCvSuggestions } from "@/lib/ai/cv-suggestions";
import type { CvSuggestion } from "@/lib/ai/types";
import { track } from "@/lib/analytics";
import { canUseAiReview, createCheckoutUrl } from "@/lib/billing";
import { db } from "@/lib/db";
import { getDictionary, LOCALE_COOKIE } from "@/lib/i18n";
import { ingestAll } from "@/lib/ingestion/run";
import { requireAdmin, requireUser } from "@/lib/session";
import { slugify } from "@/lib/taxonomy";

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
      redirectTo: String(formData.get("next") || "/jobs"),
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
  await db.application.updateMany({
    where: { id, userId: user.id },
    data: { status, ...(status === "APPLIED" ? { appliedAt: new Date() } : {}) },
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
): Promise<{ error?: string; provider?: string; suggestions?: CvSuggestion[] }> {
  const user = await requireUser();
  const { locale, t } = await getDictionary();
  const [job, resume, dbUser] = await Promise.all([
    db.job.findUnique({ where: { id: jobId } }),
    db.resume.findFirst({ where: { userId: user.id, isPrimary: true } }),
    db.user.findUniqueOrThrow({ where: { id: user.id } }),
  ]);
  if (!job) return { error: "Job not found" };
  if (!resume) return { error: t.jobs.cvTipsNeedCv };
  // TODO(billing): count usage per month in a table; currently only enforced by plan flag.
  if (!canUseAiReview(dbUser.plan, 0)) return { error: t.pricing.billingDisabled };
  const res = await generateCvSuggestions({ resumeText: resume.text, job, locale });
  track("cv_suggestions_generated", { provider: res.provider });
  return res;
}

export async function startCheckout() {
  const user = await requireUser();
  track("upgrade_clicked");
  const url = await createCheckoutUrl(user.id);
  redirect(url ?? "/pricing?billing=disabled");
}

export async function adminSyncAll() {
  await requireAdmin();
  await ingestAll();
  revalidatePath("/admin");
  revalidatePath("/jobs");
}

const companySchema = z.object({
  name: z.string().trim().min(1).max(100),
  provider: z.enum(["GREENHOUSE", "LEVER", "COMEET"]),
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
    },
    update: { atsProvider: provider as AtsProvider, atsBoardId: boardId },
  });
  revalidatePath("/admin");
}
