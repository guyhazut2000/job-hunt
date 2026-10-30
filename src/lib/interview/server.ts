import type { Prisma } from "@prisma/client";
import { guardedLLM } from "@/lib/ai";
import { AiLimitError, type AiLimitReason } from "@/lib/ai/errors";
import { resolveTarget } from "@/lib/cv-tailor/server";
import { db } from "@/lib/db";
import { loadHiringProcess } from "@/lib/hiring/server";
import { readProfessional } from "@/lib/profile/load";
import { MAX_ANSWER_CHARS, nextStep } from "./flow";
import {
  FEEDBACK_MAX_TOKENS,
  feedbackPrompt,
  feedbackSchema,
  heuristicFeedback,
  normalizeFeedback,
  overallScore,
} from "./grade";
import { normalizePlan, offlinePlan, PLAN_MAX_TOKENS, PLAN_SIZE, planPrompt, planSchema, seedOf } from "./plan";
import type { Feedback, InterviewContext, InterviewMode, Lang, PlannedQuestion, PlanSource, Turn } from "./types";

export interface ResolvedInterviewTarget {
  ctx: InterviewContext;
  jobId: string | null;
  applicationId: string | null;
  companyId: string | null;
}

/** Job / application the user owns → interview context (posting, hiring stages, concepts, background). */
export async function loadInterviewTarget(
  userId: string,
  ref: { jobId?: string | null; applicationId?: string | null },
): Promise<ResolvedInterviewTarget | null> {
  const resolved = await resolveTarget(userId, ref);
  if (!resolved) return null;
  const { target, jobId, applicationId } = resolved;
  const job = jobId ? await db.job.findUnique({ where: { id: jobId }, select: { companyId: true } }) : null;
  const companyId = job?.companyId ?? null;
  const [hiring, concepts, profile] = await Promise.all([
    companyId ? loadHiringProcess({ companyId, jobId, userId }) : null,
    db.concept.findMany({
      where: {
        userId,
        OR: [
          ...(companyId ? [{ companyId }] : []),
          { name: { in: target.techStack, mode: "insensitive" as const } },
          { status: "LEARNING" },
        ],
      },
      select: { name: true, companyId: true },
      orderBy: { lastOpenedAt: "desc" },
      take: 30,
    }),
    db.profile.findUnique({ where: { userId } }),
  ]);
  const stages = (hiring?.mine?.stages?.length ? hiring.mine.stages : (hiring?.official?.stages ?? [])).map((s) => ({
    kind: s.kind,
    title: s.title,
  }));
  const pro = readProfessional(profile);
  const background = [
    profile?.headline ?? "",
    ...pro.experience.slice(0, 3).map((e) => [e.title, e.company].filter(Boolean).join(" @ ")),
  ]
    .filter(Boolean)
    .join("; ");
  const sortedConcepts = [
    ...concepts.filter((c) => companyId && c.companyId === companyId),
    ...concepts.filter((c) => !(companyId && c.companyId === companyId)),
  ].map((c) => c.name);
  return {
    jobId,
    applicationId,
    companyId,
    ctx: {
      title: target.title,
      company: target.company,
      description: target.description,
      techStack: target.techStack,
      stages,
      concepts: [...new Set(sortedConcepts)].slice(0, 12),
      background,
    },
  };
}

export interface PlanResult {
  plan: PlannedQuestion[];
  source: PlanSource;
  reason?: AiLimitReason;
}

/** HR / TECH: one guarded AI call (cached per target + variant). PROBLEM: always our own problem set. */
export async function planInterview(
  userId: string,
  mode: InterviewMode,
  ctx: InterviewContext,
  lang: Lang,
  seed: number,
): Promise<PlanResult> {
  const offline = offlinePlan(mode, ctx, lang, seed);
  if (mode === "PROBLEM") return { plan: offline, source: "offline" };
  const llm = await guardedLLM("interview_plan", userId);
  if (llm.name === "mock") return { plan: offline, source: "offline" };
  try {
    const messages = planPrompt(mode, ctx, lang);
    // The variant line makes a repeat session get fresh questions instead of the cached plan.
    messages.push({ role: "user", content: `variant ${seed % 1000}` });
    const raw = await llm.complete(messages, { schema: planSchema, maxTokens: PLAN_MAX_TOKENS });
    const plan = normalizePlan(JSON.parse(raw), offline, PLAN_SIZE[mode]);
    return plan ? { plan, source: "ai" } : { plan: offline, source: "offline" };
  } catch (e) {
    if (e instanceof AiLimitError) return { plan: offline, source: "limited", reason: e.reason };
    return { plan: offline, source: "offline" };
  }
}

export async function createInterviewSession(
  userId: string,
  opts: { jobId?: string | null; applicationId?: string | null; mode: InterviewMode; language: Lang },
): Promise<{ id: string; reason?: AiLimitReason } | null> {
  const target = await loadInterviewTarget(userId, opts);
  if (!target) return null;
  const previous = await db.interviewSession.count({
    where: {
      userId,
      mode: opts.mode,
      ...(target.applicationId ? { applicationId: target.applicationId } : { jobId: target.jobId }),
    },
  });
  const seed = seedOf(`${target.jobId ?? target.applicationId}:${opts.mode}`) + previous;
  const { plan, source, reason } = await planInterview(userId, opts.mode, target.ctx, opts.language, seed);
  const session = await db.interviewSession.create({
    data: {
      userId,
      jobId: target.jobId,
      applicationId: target.applicationId,
      title: target.ctx.title.slice(0, 200),
      company: target.ctx.company.slice(0, 200),
      mode: opts.mode,
      language: opts.language,
      plan: plan as unknown as Prisma.InputJsonValue,
      source,
      messages: { create: { role: "interviewer", kind: "question", content: plan[0].q, questionIndex: 0 } },
    },
    select: { id: true },
  });
  return { id: session.id, reason };
}

export const readPlan = (v: Prisma.JsonValue): PlannedQuestion[] =>
  Array.isArray(v) ? (v as unknown as PlannedQuestion[]) : [];
export const readFeedback = (v: Prisma.JsonValue | null): Feedback | null =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as unknown as Feedback) : null;

async function ownedActive(userId: string, id: string) {
  const s = await db.interviewSession.findFirst({
    where: { id, userId },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  return s;
}

export type SessionWithMessages = NonNullable<Awaited<ReturnType<typeof ownedActive>>>;

const toTurns = (s: SessionWithMessages): Turn[] =>
  s.messages.map((m) => ({
    role: m.role as Turn["role"],
    kind: m.kind as Turn["kind"],
    content: m.content,
    questionIndex: m.questionIndex,
  }));

/** Save an answer (or a skip) and add the interviewer's next line; finishes the session after the last question. */
export async function advanceSession(
  userId: string,
  id: string,
  input: { answer: string } | { skip: true },
): Promise<{ ok: boolean; done: boolean; reason?: AiLimitReason }> {
  const s = await ownedActive(userId, id);
  if (!s || s.status !== "active") return { ok: false, done: s?.status === "done" };
  const plan = readPlan(s.plan);
  const mode = s.mode as InterviewMode;
  const lang = (s.language === "en" ? "en" : "he") as Lang;
  const i = s.questionIndex;
  const current = s.messages.filter((m) => m.questionIndex === i);
  let step: ReturnType<typeof nextStep>;
  if ("skip" in input) {
    await db.interviewMessage.create({
      data: { sessionId: id, role: "candidate", kind: "skip", content: "", questionIndex: i },
    });
    step = i + 1 < plan.length ? { kind: "next", index: i + 1 } : { kind: "done" };
  } else {
    const answer = input.answer.trim().slice(0, MAX_ANSWER_CHARS);
    if (!answer) return { ok: false, done: false };
    const asked = current.filter((m) => m.kind === "followup").map((m) => m.content);
    const soFar = current
      .filter((m) => m.kind === "answer")
      .map((m) => m.content)
      .join("\n");
    await db.interviewMessage.create({
      data: { sessionId: id, role: "candidate", kind: "answer", content: answer, questionIndex: i },
    });
    step = nextStep(plan, mode, lang, i, asked, answer, soFar);
  }
  if (step.kind === "followup") {
    await db.interviewMessage.create({
      data: { sessionId: id, role: "interviewer", kind: "followup", content: step.text, questionIndex: i },
    });
    await db.interviewSession.update({ where: { id }, data: { followUps: { increment: 1 } } });
    return { ok: true, done: false };
  }
  if (step.kind === "next") {
    await db.$transaction([
      db.interviewMessage.create({
        data: {
          sessionId: id,
          role: "interviewer",
          kind: "question",
          content: plan[step.index].q,
          questionIndex: step.index,
        },
      }),
      db.interviewSession.update({ where: { id }, data: { questionIndex: step.index, followUps: 0 } }),
    ]);
    return { ok: true, done: false };
  }
  const r = await finishSession(userId, id);
  return { ok: true, done: true, reason: r?.reason };
}

/** One batched AI call grades the whole transcript; offline rubric on mock / limit / bad output. */
export async function finishSession(
  userId: string,
  id: string,
): Promise<{ feedback: Feedback; source: PlanSource; reason?: AiLimitReason } | null> {
  const s = await ownedActive(userId, id);
  if (!s) return null;
  const existing = readFeedback(s.feedback);
  if (s.status === "done" && existing)
    return { feedback: existing, source: (s.feedbackSource ?? "offline") as PlanSource };
  const plan = readPlan(s.plan);
  const mode = s.mode as InterviewMode;
  const lang = (s.language === "en" ? "en" : "he") as Lang;
  const turns = toTurns(s);
  const offline = heuristicFeedback(mode, plan, turns, lang);
  let feedback = offline;
  let source: PlanSource = "offline";
  let reason: AiLimitReason | undefined;
  const answered = turns.some((t) => t.kind === "answer");
  if (answered) {
    const llm = await guardedLLM("interview_feedback", userId);
    if (llm.name !== "mock") {
      try {
        const raw = await llm.complete(feedbackPrompt(mode, s, plan, turns, lang), {
          schema: feedbackSchema,
          maxTokens: FEEDBACK_MAX_TOKENS,
        });
        const ai = normalizeFeedback(JSON.parse(raw), mode, offline, lang);
        if (ai) {
          feedback = ai;
          source = "ai";
        }
      } catch (e) {
        if (e instanceof AiLimitError) {
          source = "limited";
          reason = e.reason;
        }
      }
    }
  }
  await db.interviewSession.update({
    where: { id },
    data: {
      status: "done",
      endedAt: new Date(),
      feedback: feedback as unknown as Prisma.InputJsonValue,
      feedbackSource: source,
      score: answered ? overallScore(feedback) : null,
    },
  });
  return { feedback, source, reason };
}

export async function loadSession(userId: string, id: string) {
  return ownedActive(userId, id);
}
