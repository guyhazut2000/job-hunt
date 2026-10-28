import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { auth } from "@/auth";
import { aiConfig } from "@/lib/ai/config";
import { prismaAiStore } from "@/lib/ai/store";
import { chatUserContext, companyInfo, companyNames, explainMatch, searchJobs } from "@/lib/chat/data";
import { chatRequestSchema, handleChatTurn } from "@/lib/chat/handler";
import { parseIntent, shownJobIds } from "@/lib/chat/intent";
import { chatIsLive } from "@/lib/chat/live";
import { chatSystemPrompt } from "@/lib/chat/prompt";
import { prismaChatRepo } from "@/lib/chat/repo";
import { chatTools } from "@/lib/chat/tools";
import { db } from "@/lib/db";
import { getLocale } from "@/lib/i18n";

export const maxDuration = 60;

export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ error: "auth" }, { status: 401 });
  const parsed = chatRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid" }, { status: 400 });

  const locale = await getLocale();
  const cfg = aiConfig();
  const live = chatIsLive();
  const ctx = { userId, locale };
  const user = live ? await chatUserContext(userId) : { hasProfile: true, hasPlace: true };

  return handleChatTurn(parsed.data, {
    userId,
    locale,
    system: chatSystemPrompt({ locale, ...user }),
    model: live ? createGoogleGenerativeAI({ apiKey: cfg.apiKey! })(cfg.model) : null,
    modelName: `gemini:${cfg.model}`,
    tools: chatTools(ctx),
    route: async (text, history) => parseIntent(text, await companyNames(), shownJobIds(history)),
    run: (intent) =>
      intent.tool === "search_jobs"
        ? searchJobs(intent.input, ctx)
        : intent.tool === "explain_match"
          ? explainMatch(intent.input, ctx)
          : companyInfo(intent.input, ctx),
    store: prismaAiStore,
    cfg,
    repo: prismaChatRepo,
    recentTurns: () =>
      db.aiUsage.count({ where: { userId, feature: "chat", createdAt: { gte: new Date(Date.now() - 60_000) } } }),
  });
}
