/**
 * Prepare and approve one application. Network calls go to documented ATS endpoints only.
 * LinkedIn and mailto URLs are never requested. File bytes are read only when an API POST
 * is about to happen, and they are not stored on the application snapshot.
 */
import type { ApplyDelivery, ApplyDraftStatus, Prisma, Profile, Seniority, WorkMode } from "@prisma/client";
import { guardedLLM } from "@/lib/ai";
import { AiLimitError } from "@/lib/ai/errors";
import { requireCvStandard } from "@/lib/cv-standard/server";
import { db } from "@/lib/db";
import { MAX_DOCUMENT_BYTES } from "@/lib/documents/constants";
import { defaultSelection, sanitizeSelection, type AttachableDocument } from "@/lib/documents/picker";
import { getAttachableDocuments } from "@/lib/documents/server";
import { readObject } from "@/lib/documents/storage";
import { logStatusChange } from "@/lib/email/auto-apply";
import { readProfessional } from "@/lib/profile/load";
import { hasScorableProfile, scoreMatch, toCandidate } from "@/lib/profile/score";
import {
  answerPrompt,
  answerSchema,
  flagUnanswered,
  mergeAnswers,
  promptHasSecret,
  questionsForAi,
  type AnswerSource,
} from "./answers";
import { classifyTarget, type DeliveryPlan } from "./classify";
import { loadAshbyFields, loadGreenhouseFields } from "./fetch-form";
import {
  apiBlocked,
  applyUserEdits,
  approveBlock,
  ashbySubmission,
  attachDocuments,
  draftStatus,
  greenhouseBody,
  jsonValue,
  leverPacket,
  mapProfile,
  packetDocuments,
  profilePacket,
  readStoredDocs,
  readStoredFields,
  sentSnapshot,
} from "./fields";
import { boardKeysFromEnv } from "./keys";
import { APPLY_PICKER_RULES } from "./picker";
import {
  APPLY_DEFAULTS,
  automaticAllowed,
  evaluateRules,
  parseSettingsInput,
  toggleBlocked,
  type RuleCode,
} from "./rules";
import { submitAshby, submitGreenhouse, type SubmitResult } from "./submit";
import { nextZonedDay, zonedDayStart } from "./time";
import type { ApplyField, ApplyProfile, SentSnapshot } from "./types";

const GH_MIME = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "application/rtf",
  "text/rtf",
]);

export interface ApplySettingsView {
  minMatchScore: number;
  dailyCap: number;
  fullyAutomatic: boolean;
  blockedCompanyIds: string[];
}

export function viewSettings(
  row: {
    minMatchScore: number;
    dailyCap: number;
    fullyAutomatic: boolean;
    blockedCompanyIds: string[];
  } | null,
): ApplySettingsView {
  return {
    minMatchScore: row?.minMatchScore ?? APPLY_DEFAULTS.minMatchScore,
    dailyCap: row?.dailyCap ?? APPLY_DEFAULTS.dailyCap,
    fullyAutomatic: row?.fullyAutomatic ?? APPLY_DEFAULTS.fullyAutomatic,
    blockedCompanyIds: row?.blockedCompanyIds ?? [],
  };
}

export async function getApplySettings(userId: string): Promise<ApplySettingsView> {
  return viewSettings(await db.applySettings.findUnique({ where: { userId } }));
}

async function writeSettings(userId: string, data: ApplySettingsView) {
  await db.applySettings.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });
}

export async function saveApplySettings(
  userId: string,
  raw: { minMatchScore: unknown; dailyCap: unknown; fullyAutomatic: unknown },
) {
  const current = await getApplySettings(userId);
  const parsed = parseSettingsInput(raw);
  await writeSettings(userId, { ...parsed, blockedCompanyIds: current.blockedCompanyIds });
}

export async function blockCompanyByName(userId: string, name: string): Promise<"ok" | "missing" | "ambiguous"> {
  const q = name.trim();
  if (q.length < 2 || q.length > 120) return "missing";
  const rows = await db.company.findMany({
    where: {
      OR: [{ name: { equals: q, mode: "insensitive" } }, { nameHe: { equals: q, mode: "insensitive" } }],
    },
    select: { id: true },
    take: 2,
  });
  if (rows.length === 0) return "missing";
  if (rows.length > 1) return "ambiguous";
  const current = await getApplySettings(userId);
  await writeSettings(userId, {
    ...current,
    blockedCompanyIds: toggleBlocked(current.blockedCompanyIds, rows[0]!.id, true),
  });
  return "ok";
}

export async function unblockCompany(userId: string, companyId: string) {
  const current = await getApplySettings(userId);
  await writeSettings(userId, {
    ...current,
    blockedCompanyIds: toggleBlocked(current.blockedCompanyIds, companyId, false),
  });
}

function toProfile(user: { name: string | null; email: string }, profile: Profile | null): ApplyProfile {
  const pro = readProfessional(profile);
  const current = pro.experience.find((e) => !e.end) ?? pro.experience[0];
  return {
    name: user.name,
    email: user.email,
    phone: pro.phone,
    location: profile?.location ?? "",
    linkedinUrl: pro.linkedinUrl,
    githubUrl: pro.githubUrl,
    portfolioUrl: pro.portfolioUrl,
    headline: pro.headline,
    summary: pro.summary,
    skills: pro.skillItems.map((s) => ({ name: s.name, years: s.years ?? null })),
    salaryMin: profile?.salaryMin ?? null,
    salaryMax: profile?.salaryMax ?? null,
    availability: profile?.availability ?? null,
    currentCompany: current?.company ?? "",
    currentTitle: current?.title ?? "",
    yearsExperience: profile?.yearsExperience ?? null,
  };
}

async function submittedToday(userId: string, exceptJobId: string): Promise<number> {
  const start = zonedDayStart(new Date());
  return db.applyDraft.count({
    where: {
      userId,
      jobId: { not: exceptJobId },
      status: { in: ["HANDED_OFF", "SUBMITTED"] },
      submittedAt: { gte: start, lt: nextZonedDay(start) },
    },
  });
}

async function matchScore(
  userId: string,
  job: { techStack: string[]; roleCategory: string; seniority: Seniority; location: string; workMode: WorkMode },
) {
  const profile = await db.profile.findUnique({ where: { userId } });
  if (!hasScorableProfile(profile)) return { profile, score: null as number | null };
  return { profile, score: scoreMatch(toCandidate(profile), job).score };
}

const deliveryEnum = (plan: DeliveryPlan): ApplyDelivery =>
  plan === "api" ? "API" : plan === "manual" ? "MANUAL" : "HANDOFF";

async function readRef(userId: string, ref: string) {
  if (ref.startsWith("cv:")) {
    const row = await db.resume.findFirst({ where: { id: ref.slice(3), userId }, include: { file: true } });
    if (!row?.file) return null;
    return { fileName: row.fileName, mimeType: row.mimeType, bytes: Buffer.from(row.file.data) };
  }
  if (ref.startsWith("doc:")) {
    const row = await db.document.findFirst({
      where: { id: ref.slice(4), userId },
      select: { fileName: true, mimeType: true, storageKey: true },
    });
    if (!row) return null;
    const bytes = await readObject(row.storageKey, MAX_DOCUMENT_BYTES);
    if (!bytes) return null;
    return { fileName: row.fileName, mimeType: row.mimeType, bytes };
  }
  return null;
}

async function postPacket(opts: {
  userId: string;
  platform: string;
  boardId: string;
  externalId: string;
  fields: ApplyField[];
}): Promise<SubmitResult> {
  const keys = boardKeysFromEnv();
  const files = opts.fields.filter((f) => f.kind === "file" && f.transmit && f.value);
  const loaded = new Map<string, { fileName: string; mimeType: string; bytes: Buffer }>();
  const reads = await Promise.all(
    files.map(async (field) => ({ field, file: await readRef(opts.userId, field.value) })),
  );
  for (const { field, file } of reads) {
    if (!file) return { ok: false, error: "file_unavailable" };
    if (file.bytes.length > APPLY_PICKER_RULES.maxTotalBytes!) return { ok: false, error: "file_too_large" };
    loaded.set(field.id, file);
  }
  if (opts.platform === "greenhouse") {
    const key = keys.greenhouse[opts.boardId];
    if (!key) return { ok: false, error: "no_key" };
    for (const file of loaded.values()) {
      if (!GH_MIME.has(file.mimeType)) return { ok: false, error: "unsupported_file" };
    }
    const encoded: Record<string, { filename: string; base64: string }> = {};
    for (const [id, file] of loaded) encoded[id] = { filename: file.fileName, base64: file.bytes.toString("base64") };
    return submitGreenhouse({
      board: opts.boardId,
      jobId: opts.externalId,
      apiKey: key,
      body: greenhouseBody(opts.fields, encoded),
    });
  }
  if (opts.platform === "ashby") {
    const key = keys.ashby[opts.boardId];
    if (!key) return { ok: false, error: "no_key" };
    const built = ashbySubmission(opts.fields);
    const uploads = built.files.map((f) => {
      const file = loaded.get(f.fieldId);
      if (!file) return null;
      return { part: f.part, filename: file.fileName, mimeType: file.mimeType, bytes: new Uint8Array(file.bytes) };
    });
    if (uploads.some((u) => !u)) return { ok: false, error: "file_unavailable" };
    return submitAshby({
      apiKey: key,
      jobPostingId: opts.externalId,
      submissions: built.submissions,
      files: uploads.filter((u): u is NonNullable<typeof u> => !!u),
    });
  }
  return { ok: false, error: "no_submit_endpoint" };
}

async function recordApplication(opts: {
  userId: string;
  job: { id: string; title: string; applyUrl: string; company: { name: string } };
  snapshot: SentSnapshot;
  delivery: ApplyDelivery;
  markApplied: boolean;
}): Promise<string> {
  const existing = await db.application.findUnique({
    where: { userId_jobId: { userId: opts.userId, jobId: opts.job.id } },
  });
  const now = new Date();
  const snapshot = opts.snapshot as unknown as Prisma.InputJsonValue;
  if (!existing) {
    const created = await db.application.create({
      data: {
        userId: opts.userId,
        jobId: opts.job.id,
        title: opts.job.title,
        company: opts.job.company.name,
        url: opts.job.applyUrl,
        status: opts.markApplied ? "APPLIED" : "SAVED",
        appliedAt: opts.markApplied ? now : null,
        statusChangedAt: now,
        sentSnapshot: snapshot,
        applyDelivery: opts.delivery,
        applyRecordedAt: now,
      },
    });
    if (opts.markApplied) {
      await logStatusChange(db, {
        userId: opts.userId,
        applicationId: created.id,
        from: null,
        to: "APPLIED",
        source: "MANUAL",
      });
    }
    return created.id;
  }
  const keepDelivery = opts.delivery === "MANUAL" && existing.applyDelivery && existing.applyDelivery !== "MANUAL";
  const promote = opts.markApplied && existing.status === "SAVED";
  await db.application.update({
    where: { id: existing.id },
    data: {
      url: existing.url || opts.job.applyUrl,
      ...(keepDelivery ? {} : { sentSnapshot: snapshot, applyDelivery: opts.delivery, applyRecordedAt: now }),
      ...(promote ? { status: "APPLIED", appliedAt: existing.appliedAt ?? now, statusChangedAt: now } : {}),
    },
  });
  if (promote) {
    await logStatusChange(db, {
      userId: opts.userId,
      applicationId: existing.id,
      from: "SAVED",
      to: "APPLIED",
      source: "MANUAL",
      prevStatusChangedAt: existing.statusChangedAt,
    });
  }
  return existing.id;
}

async function fillAnswers(
  userId: string,
  company: string,
  title: string,
  profile: ApplyProfile,
  fields: ApplyField[],
) {
  const candidates = questionsForAi(fields);
  if (!candidates.length) return { fields, answerSource: "profile" as AnswerSource };
  const ids = new Set(candidates.map((c) => c.id));
  const messages = answerPrompt({ company, title, profile, questions: candidates });
  if (promptHasSecret(messages)) return { fields: flagUnanswered(fields, ids), answerSource: "secret" as AnswerSource };
  const llm = await guardedLLM("apply_answers", userId);
  if (llm.name === "mock") return { fields: flagUnanswered(fields, ids), answerSource: "fallback" as AnswerSource };
  try {
    const raw = await llm.complete(messages, { schema: answerSchema, maxTokens: 1200 });
    const merged = mergeAnswers(fields, JSON.parse(raw), ids);
    return { fields: merged.fields, answerSource: (merged.usedAi ? "ai" : "fallback") as AnswerSource };
  } catch (e) {
    return {
      fields: flagUnanswered(fields, ids),
      answerSource: (e instanceof AiLimitError ? "limited" : "fallback") as AnswerSource,
    };
  }
}

export async function prepareDraft(userId: string, jobId: string): Promise<{ id: string } | null> {
  const job = await db.job.findUnique({
    where: { id: jobId },
    include: { company: { select: { id: true, name: true, atsBoardId: true } } },
  });
  if (!job) return null;
  const existing = await db.applyDraft.findUnique({ where: { userId_jobId: { userId, jobId } } });
  if (existing?.status === "SUBMITTED") return { id: existing.id };

  const [user, profile, settings, docs] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true, email: true } }),
    db.profile.findUnique({ where: { userId } }),
    getApplySettings(userId),
    getAttachableDocuments(userId),
  ]);
  const keys = boardKeysFromEnv();
  let classified = classifyTarget({
    source: job.source,
    applyUrl: job.applyUrl,
    boardId: job.company.atsBoardId,
    keys,
  });
  let fields: ApplyField[] = [];
  let formMode = "packet";
  if (classified.delivery !== "manual" && classified.platform === "greenhouse") {
    const loaded = await loadGreenhouseFields(job.company.atsBoardId ?? "", job.externalId);
    if (loaded) {
      fields = loaded;
      formMode = "ats";
    } else {
      fields = profilePacket();
      classified = { platform: "greenhouse", delivery: "handoff", reason: "form_unavailable" };
    }
  } else if (classified.platform === "lever") {
    fields = leverPacket();
  } else if (classified.platform === "ashby" && classified.delivery === "api") {
    const key = keys.ashby[job.company.atsBoardId ?? ""];
    const loaded = key ? await loadAshbyFields(key, job.externalId) : null;
    if (loaded) {
      fields = loaded;
      formMode = "ats";
    } else {
      fields = profilePacket();
      classified = { platform: "ashby", delivery: "handoff", reason: "form_unavailable" };
    }
  } else if (classified.delivery !== "manual") {
    fields = profilePacket();
  }

  let answerSource: AnswerSource = "profile";
  if (classified.delivery !== "manual") {
    const person = toProfile(user, profile);
    fields = mapProfile(fields, person);
    const filled = await fillAnswers(userId, job.company.name, job.title, person, fields);
    fields = filled.fields;
    answerSource = filled.answerSource;
    const initial = sanitizeSelection(defaultSelection(docs, APPLY_PICKER_RULES), docs, APPLY_PICKER_RULES);
    fields = attachDocuments(fields, initial, docs);
  }

  const manual = classified.delivery === "manual";
  let status: ApplyDraftStatus = draftStatus(fields, manual);
  const delivery = deliveryEnum(classified.delivery);
  let error: string | null = null;
  let externalId: string | null = null;
  let submittedAt: Date | null = null;
  const documents = packetDocuments(
    fields.filter((f) => f.kind === "file" && f.value).map((f) => f.value),
    docs,
  );

  const { score } = await matchScore(userId, job);
  const today = await submittedToday(userId, job.id);
  if (
    settings.fullyAutomatic &&
    classified.delivery === "api" &&
    formMode === "ats" &&
    status === "READY" &&
    !apiBlocked(fields) &&
    automaticAllowed({
      score,
      companyId: job.company.id,
      blockedCompanyIds: settings.blockedCompanyIds,
      submittedToday: today,
      minMatchScore: settings.minMatchScore,
      dailyCap: settings.dailyCap,
    })
  ) {
    const sendingCv = fields.some((f) => f.kind === "file" && f.transmit && f.value.startsWith("cv:"));
    if (sendingCv && !(await requireCvStandard(userId)).ok) {
      error = "cv";
    } else {
      const posted = await postPacket({
        userId,
        platform: classified.platform,
        boardId: job.company.atsBoardId ?? "",
        externalId: job.externalId,
        fields,
      });
      if (posted.ok) {
        status = "SUBMITTED";
        externalId = posted.id ?? null;
        submittedAt = new Date();
      } else {
        status = "FAILED";
        error = posted.error;
      }
    }
  }

  const base = {
    status,
    delivery,
    platform: classified.platform,
    formMode,
    reason: classified.reason,
    fields: jsonValue(fields) as Prisma.InputJsonValue,
    documents: jsonValue(documents) as Prisma.InputJsonValue,
    answerSource,
    error,
    externalId,
    submittedAt,
    ruleOverride: false,
  };
  const draft = existing
    ? await db.applyDraft.update({ where: { id: existing.id }, data: base })
    : await db.applyDraft.create({ data: { userId, jobId, ...base } });

  if (manual || status === "SUBMITTED") {
    const snapshot = sentSnapshot({
      delivery: manual ? "manual" : "api",
      platform: classified.platform,
      reason: classified.reason,
      fields,
      documents,
      recordedAt: (submittedAt ?? new Date()).toISOString(),
    });
    const applicationId = await recordApplication({
      userId,
      job,
      snapshot,
      delivery: manual ? "MANUAL" : "API",
      markApplied: status === "SUBMITTED",
    });
    if (draft.applicationId !== applicationId) {
      await db.applyDraft.update({ where: { id: draft.id }, data: { applicationId } });
    }
  }
  return { id: draft.id };
}

export type ApproveResult =
  | { ok: true; delivery: "api" | "handoff"; url: string; already?: boolean }
  | {
      ok: false;
      error: RuleCode | "needs_input" | "confirm_flags" | "cv" | "manual" | "notfound" | "failed";
      detail?: string;
    };

export async function approveDraft(
  userId: string,
  input: { draftId: string; values: Record<string, string>; refs: string[]; confirmFlags: boolean; override: boolean },
): Promise<ApproveResult> {
  const draft = await db.applyDraft.findFirst({
    where: { id: input.draftId, userId },
    include: { job: { include: { company: { select: { id: true, name: true, atsBoardId: true } } } } },
  });
  if (!draft) return { ok: false, error: "notfound" };
  if (draft.status === "SUBMITTED") return { ok: true, delivery: "api", url: draft.job.applyUrl, already: true };
  if (draft.delivery === "MANUAL" || draft.status === "MANUAL") return { ok: false, error: "manual" };

  const [docs, settings, scored, today] = await Promise.all([
    getAttachableDocuments(userId),
    getApplySettings(userId),
    matchScore(userId, draft.job),
    submittedToday(userId, draft.jobId),
  ]);
  const refs = sanitizeSelection(input.refs, docs, APPLY_PICKER_RULES);
  let fields = applyUserEdits(readStoredFields(draft.fields), input.values);
  fields = attachDocuments(fields, refs, docs);
  const documents = packetDocuments(refs, docs);
  const block = approveBlock(fields, input.confirmFlags);
  const { score } = scored;
  const rules = evaluateRules({
    score,
    companyId: draft.job.company.id,
    blockedCompanyIds: settings.blockedCompanyIds,
    submittedToday: today,
    minMatchScore: settings.minMatchScore,
    dailyCap: settings.dailyCap,
    override: input.override,
  });

  const persist = async (extra: Prisma.ApplyDraftUncheckedUpdateInput) => {
    await db.applyDraft.update({
      where: { id: draft.id },
      data: {
        fields: jsonValue(fields) as Prisma.InputJsonValue,
        documents: jsonValue(documents) as Prisma.InputJsonValue,
        ruleOverride: input.override,
        ...extra,
      },
    });
  };

  if (block || !rules.ok) {
    await persist({ status: block === "needs_input" ? "NEEDS_INPUT" : "READY" });
    return { ok: false, error: block ?? rules.blocks[0]! };
  }

  const canApi = draft.delivery === "API" && draft.formMode === "ats" && !apiBlocked(fields);
  if (canApi) {
    const sendingCv = fields.some((f) => f.kind === "file" && f.transmit && f.value.startsWith("cv:"));
    if (sendingCv && !(await requireCvStandard(userId)).ok) {
      await persist({});
      return { ok: false, error: "cv" };
    }
    const posted = await postPacket({
      userId,
      platform: draft.platform,
      boardId: draft.job.company.atsBoardId ?? "",
      externalId: draft.job.externalId,
      fields,
    });
    if (!posted.ok) {
      await persist({ status: "FAILED", error: posted.error, submittedAt: null });
      return { ok: false, error: "failed", detail: posted.error };
    }
    const when = new Date();
    const snapshot = sentSnapshot({
      delivery: "api",
      platform: draft.platform,
      reason: draft.reason,
      fields,
      documents,
      recordedAt: when.toISOString(),
    });
    const applicationId = await recordApplication({
      userId,
      job: draft.job,
      snapshot,
      delivery: "API",
      markApplied: true,
    });
    await persist({
      status: "SUBMITTED",
      error: null,
      externalId: posted.id ?? null,
      submittedAt: when,
      applicationId,
      delivery: "API",
    });
    return { ok: true, delivery: "api", url: draft.job.applyUrl };
  }

  const when = new Date();
  const reason = draft.delivery === "API" ? "form_unavailable" : draft.reason;
  const snapshot = sentSnapshot({
    delivery: "handoff",
    platform: draft.platform,
    reason,
    fields,
    documents,
    recordedAt: when.toISOString(),
  });
  const applicationId = await recordApplication({
    userId,
    job: draft.job,
    snapshot,
    delivery: "HANDOFF",
    markApplied: false,
  });
  await persist({
    status: "HANDED_OFF",
    delivery: "HANDOFF",
    reason,
    error: null,
    submittedAt: when,
    applicationId,
  });
  return { ok: true, delivery: "handoff", url: draft.job.applyUrl };
}

export async function listQueue(userId: string) {
  return db.applyDraft.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    take: 200,
    include: { job: { select: { id: true, title: true, applyUrl: true, company: { select: { name: true } } } } },
  });
}

export async function loadDraft(userId: string, jobId: string) {
  const draft = await db.applyDraft.findUnique({
    where: { userId_jobId: { userId, jobId } },
    include: { job: { include: { company: { select: { id: true, name: true, slug: true } } } } },
  });
  if (!draft) return null;
  const [settings, docs, profile] = await Promise.all([
    getApplySettings(userId),
    getAttachableDocuments(userId),
    db.profile.findUnique({ where: { userId } }),
  ]);
  const score = hasScorableProfile(profile) ? scoreMatch(toCandidate(profile), draft.job).score : null;
  const rules = evaluateRules({
    score,
    companyId: draft.job.company.id,
    blockedCompanyIds: settings.blockedCompanyIds,
    submittedToday: await submittedToday(userId, jobId),
    minMatchScore: settings.minMatchScore,
    dailyCap: settings.dailyCap,
    override: false,
  });
  return {
    draft,
    fields: readStoredFields(draft.fields),
    documents: readStoredDocs(draft.documents),
    docs,
    settings,
    score,
    rules,
  };
}

export type { AttachableDocument };
