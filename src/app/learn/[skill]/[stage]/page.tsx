import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, LayoutDashboard, Sparkles } from "lucide-react";
import { auth } from "@/auth";
import { RegenerateButton } from "@/components/learning/hub/RegenerateButton";
import { StageTopics } from "@/components/learning/hub/StageTopics";
import { StageWorkspace } from "@/components/learning/hub/StageWorkspace";
import { WORKSPACE_TABS, type WorkspaceTab } from "@/lib/learning/types";
import type { TutorMessage } from "@/components/learning/hub/TutorChat";
import { SkillMonogram } from "@/components/learning/SkillVisuals";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { aiConfig } from "@/lib/ai/config";
import { prismaAiStore } from "@/lib/ai/store";
import { db } from "@/lib/db";
import { getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/dictionaries";
import { fmt, learningStrings } from "@/lib/i18n/learning";
import { learningHubStrings, type LearningHubStrings } from "@/lib/i18n/learning-hub";
import { GRAPH } from "@/lib/learning/graph";
import { loadStageContent, REGEN_PER_STAGE, tutorIsLive } from "@/lib/learning/hub";
import { stageFeedback } from "@/lib/learning/feedback-server";
import { isStage, parsePractice, type Rating } from "@/lib/learning/progress";
import { STAGES, type SkillNode, type Stage } from "@/lib/learning/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Params = {
  params: Promise<{ skill: string; stage: string }>;
  searchParams: Promise<{ tab?: string }>;
};

export async function generateMetadata({ params }: Params) {
  const { skill, stage } = await params;
  const n = GRAPH.byId.get(skill);
  return { title: n && isStage(stage) ? `${n.label} · ${stage} practice` : "Practice" };
}

/** Generated (or cached / curated) content + the interactive tabs. Streams in behind a skeleton. */
async function Workspace({
  node,
  stage,
  locale,
  userId,
  tab,
  t,
}: {
  node: SkillNode;
  stage: Stage;
  locale: Locale;
  userId: string | null;
  tab: WorkspaceTab;
  t: LearningHubStrings;
}) {
  const loaded = await loadStageContent(node, stage, locale, userId);
  const [row, reviews, thread, used, feedback] = userId
    ? await Promise.all([
        db.stageProgress.findUnique({ where: { userId_skill_stage: { userId, skill: node.id, stage } } }),
        db.questionReview.findMany({
          where: { userId, skill: node.id, stage },
          select: { questionId: true, rating: true, dueAt: true },
        }),
        db.tutorThread.findFirst({
          where: { userId, skill: node.id, stage },
          orderBy: { updatedAt: "desc" },
          select: {
            id: true,
            messages: { orderBy: { createdAt: "desc" }, take: 40, select: { id: true, role: true, content: true } },
          },
        }),
        tutorIsLive() ? prismaAiStore.countCalls(new Date(Date.now() - 86_400_000), userId) : Promise.resolve(null),
        stageFeedback(userId, node.id, stage),
      ])
    : [null, [], null, null, {}];
  const priors = Object.fromEntries(
    reviews.map((r) => [r.questionId, { rating: r.rating as Rating, dueAt: r.dueAt.toISOString() }]),
  );
  const messages: TutorMessage[] = (thread?.messages ?? [])
    .reverse()
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ id: m.id, role: m.role as "user" | "assistant", parts: [{ type: "text", text: m.content }] }));
  const sourceLabel =
    loaded.source === "ai" ? t.sourceAi : loaded.source === "static" ? t.sourceStatic : t.sourceGeneric;

  return (
    <div className="flex flex-col gap-4">
      <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs">
        <span className="inline-flex items-center gap-1.5">
          <Sparkles className="size-3.5" aria-hidden />
          {sourceLabel}
        </span>
        {userId && loaded.source === "ai" && loaded.stored && loaded.regenCount < REGEN_PER_STAGE && tutorIsLive() && (
          <RegenerateButton skill={node.id} stage={stage} t={t} />
        )}
      </div>
      <StageWorkspace
        skill={node.id}
        stage={stage}
        content={loaded.content}
        practice={parsePractice(row?.practice)}
        priors={priors}
        feedback={feedback}
        tutor={
          userId
            ? {
                threadId: thread?.id ?? null,
                messages,
                remaining: used == null ? null : Math.max(0, aiConfig().userDailyLimit - used),
                offline: !tutorIsLive(),
              }
            : null
        }
        loggedIn={!!userId}
        initialTab={tab}
        t={t}
      />
    </div>
  );
}

function WorkspaceSkeleton({ t }: { t: LearningHubStrings }) {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <div role="status" aria-live="polite" className="bg-accent/40 flex flex-col gap-1 rounded-xl border p-4">
        <p className="inline-flex items-center gap-2 font-semibold">
          <Sparkles className="size-4 motion-safe:animate-pulse" aria-hidden />
          {t.generatingTitle}
        </p>
        <p className="text-muted-foreground text-sm">{t.generatingLead}</p>
      </div>
      <Skeleton className="h-11 w-full rounded-xl sm:w-96" />
      {Array.from({ length: 2 }, (_, i) => (
        <div key={i} className="bg-card flex flex-col gap-3 rounded-xl border p-5">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/6" />
          <Skeleton className="h-16 w-full rounded-lg" />
        </div>
      ))}
    </div>
  );
}

export default async function StagePage({ params, searchParams }: Params) {
  const [{ skill, stage }, sp] = await Promise.all([params, searchParams]);
  const node = GRAPH.byId.get(skill);
  if (!node || !isStage(stage)) notFound();
  const [{ locale }, session] = await Promise.all([getDictionary(), auth()]);
  const s = learningStrings(locale);
  const t = learningHubStrings(locale);
  const userId = session?.user?.id ?? null;
  const tab: WorkspaceTab = (WORKSPACE_TABS as readonly string[]).includes(sp.tab ?? "")
    ? (sp.tab as WorkspaceTab)
    : "practice";
  const row = userId
    ? await db.stageProgress.findUnique({ where: { userId_skill_stage: { userId, skill: node.id, stage } } })
    : null;
  const idx = STAGES.indexOf(stage);
  const prev = STAGES[idx - 1];
  const next = STAGES[idx + 1];
  const href = (st: Stage) => `/learn/${node.id}/${st}`;

  return (
    <div className="flex flex-col gap-6">
      <nav className="-mt-2 flex flex-wrap items-center justify-between gap-2 text-sm">
        <Link
          href={`/learn/${node.id}`}
          className="text-muted-foreground hover:text-foreground inline-flex min-h-11 items-center gap-1.5"
        >
          <ArrowRight className="size-4 ltr:rotate-180" aria-hidden />
          <bdi dir="ltr">{node.label}</bdi>
        </Link>
        {userId && (
          <Link
            href="/learn/me"
            className="text-primary inline-flex min-h-11 items-center gap-1.5 font-semibold hover:underline"
          >
            <LayoutDashboard className="size-4" aria-hidden />
            {t.backToMine}
          </Link>
        )}
      </nav>

      <header className="bg-card motion-safe:animate-rise -mt-3 flex flex-col gap-5 rounded-2xl border p-4 sm:p-6">
        <div className="flex items-start gap-3.5">
          <SkillMonogram label={node.label} category={node.category} />
          <div className="flex min-w-0 flex-col gap-1">
            <p className="kicker">{t.wsKicker}</p>
            <h1 className="text-2xl leading-tight font-black sm:text-3xl">
              <bdi dir="ltr">{node.label}</bdi>
              <span className="text-muted-foreground font-bold"> · {s.stage[stage]}</span>
            </h1>
            <p className="text-muted-foreground text-sm">{fmt(t.stageOf, { n: idx + 1 })}</p>
          </div>
        </div>
        {/* Stage switcher */}
        <ol className="grid grid-cols-3 gap-1.5" aria-label={s.path}>
          {STAGES.map((st, i) => (
            <li key={st} className="min-w-0">
              <Link
                href={href(st)}
                aria-current={st === stage ? "step" : undefined}
                className={
                  st === stage
                    ? "bg-primary text-primary-foreground flex min-h-11 items-center justify-center gap-1 rounded-lg px-2 text-center text-xs font-semibold sm:text-sm"
                    : "hover:bg-secondary text-foreground/75 flex min-h-11 items-center justify-center gap-1 rounded-lg border px-2 text-center text-xs sm:text-sm"
                }
              >
                <span className="font-mono">{i + 1}</span>
                <span className="truncate">{s.stage[st]}</span>
              </Link>
            </li>
          ))}
        </ol>
        <div className="border-t pt-4">
          <StageTopics
            key={`${node.id}-${stage}`}
            skill={node.id}
            stage={stage}
            topics={node.stages[stage]}
            initialDone={row?.topicsDone ?? []}
            initialStageDone={row?.status === "DONE"}
            loggedIn={!!userId}
            t={t}
          />
          {!userId && (
            <Button asChild size="lg" className="mt-4 w-full rounded-full sm:w-fit">
              <Link href={`/login?next=${encodeURIComponent(href(stage))}`}>{t.loginToPractice}</Link>
            </Button>
          )}
        </div>
      </header>

      <Suspense key={`${node.id}-${stage}-${locale}`} fallback={<WorkspaceSkeleton t={t} />}>
        <Workspace node={node} stage={stage} locale={locale} userId={userId} tab={tab} t={t} />
      </Suspense>

      <nav className="flex flex-wrap items-center justify-between gap-3 border-t pt-5" aria-label={s.path}>
        {prev ? (
          <Button asChild variant="outline" className="min-h-11 rounded-full">
            <Link href={href(prev)}>
              <ArrowRight className="size-4 ltr:rotate-180" aria-hidden />
              {t.prevStage}
            </Link>
          </Button>
        ) : (
          <span />
        )}
        {next ? (
          <Button asChild className="min-h-11 rounded-full">
            <Link href={href(next)}>
              {t.nextStage}
              <ArrowLeft className="size-4 ltr:rotate-180" aria-hidden />
            </Link>
          </Button>
        ) : (
          <Button asChild variant="outline" className="min-h-11 rounded-full">
            <Link href={userId ? "/learn/me" : `/learn/${node.id}`}>
              <Check className="size-4" aria-hidden />
              {userId ? t.backToMine : node.label}
            </Link>
          </Button>
        )}
      </nav>
    </div>
  );
}
