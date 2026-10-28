import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { auth } from "@/auth";
import { aiConfig } from "@/lib/ai/config";
import { prismaAiStore } from "@/lib/ai/store";
import { db } from "@/lib/db";
import { getLocale } from "@/lib/i18n";
import { GRAPH, knownSkillIds, prerequisitePath } from "@/lib/learning/graph";
import { loadStageContent, tutorIsLive } from "@/lib/learning/hub";
import {
  handleTutorTurn,
  offlineTutorReply,
  tutorLevel,
  tutorRequestSchema,
  tutorSystemPrompt,
  type TutorRepo,
} from "@/lib/learning/tutor";
import { hasScorableProfile, toCandidate } from "@/lib/profile/score";

export const maxDuration = 60;

const repo: TutorRepo = {
  async thread(userId, skill, stage, threadId) {
    if (threadId) {
      const t = await db.tutorThread.findFirst({ where: { id: threadId, userId, skill, stage }, select: { id: true } });
      if (t) {
        await db.tutorThread.update({ where: { id: t.id }, data: { updatedAt: new Date() } });
        return t;
      }
    }
    return db.tutorThread.create({ data: { userId, skill, stage }, select: { id: true } });
  },
  async history(threadId, limit) {
    const rows = await db.tutorMessage.findMany({
      where: { threadId },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { role: true, content: true },
    });
    return rows.reverse();
  },
  async add(threadId, role, content) {
    await db.tutorMessage.create({ data: { threadId, role, content: content.slice(0, 8000) } });
  },
};

export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ error: "auth" }, { status: 401 });
  const parsed = tutorRequestSchema.safeParse(await req.json().catch(() => null));
  const node = parsed.success ? GRAPH.byId.get(parsed.data.skill) : undefined;
  if (!parsed.success || !node) return Response.json({ error: "invalid" }, { status: 400 });
  const { stage } = parsed.data;

  const locale = await getLocale();
  const cfg = aiConfig();
  const live = tutorIsLive();
  const [loaded, profile, progress, turns] = await Promise.all([
    loadStageContent(node, stage, locale, userId),
    db.profile.findUnique({ where: { userId } }),
    db.skillProgress.findMany({ where: { userId, status: "DONE" }, select: { skill: true } }),
    db.tutorMessage.count({ where: { thread: { userId, skill: node.id, stage }, role: "assistant" } }),
  ]);
  const known = knownSkillIds(
    hasScorableProfile(profile) ? toCandidate(profile).skills : [],
    progress.map((p) => p.skill),
  );
  const prereqs = prerequisitePath(node.id).filter((id) => id !== node.id);
  const level = tutorLevel(stage, prereqs.filter((id) => known.has(id)).length, prereqs.length);

  return handleTutorTurn(parsed.data, {
    userId,
    node,
    locale,
    system: tutorSystemPrompt({ node, stage, locale, level, content: loaded.content }),
    model: live ? createGoogleGenerativeAI({ apiKey: cfg.apiKey! })(cfg.model) : null,
    modelName: `gemini:${cfg.model}`,
    store: prismaAiStore,
    cfg,
    repo,
    recentTutorCalls: () =>
      db.aiUsage.count({
        where: { userId, feature: "tutor_chat", createdAt: { gte: new Date(Date.now() - 60_000) } },
      }),
    offlineReply: offlineTutorReply(locale, loaded.content, turns),
  });
}
