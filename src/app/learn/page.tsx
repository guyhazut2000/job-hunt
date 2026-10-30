import Link from "next/link";
import {
  ArrowLeft,
  Check,
  LayoutDashboard,
  Lightbulb,
  MessagesSquare,
  Puzzle,
  Route,
  Sparkles,
  TrendingUp,
  UserRound,
} from "lucide-react";
import { auth } from "@/auth";
import { LearnExplorer, type ExplorerSkill } from "@/components/learning/LearnExplorer";
import { ProgressRing, SkillCard, SkillMonogram, type LearnStatus } from "@/components/learning/SkillVisuals";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { getDictionary } from "@/lib/i18n";
import { fmt, learningStrings } from "@/lib/i18n/learning";
import { learningHubStrings } from "@/lib/i18n/learning-hub";
import { problemSolvingStrings } from "@/lib/i18n/problem-solving";
import { crossJobImpact, GRAPH, knownSkillIds, TRACKS, trackOrder } from "@/lib/learning/graph";
import { demandMap, getProgress } from "@/lib/learning/server";
import { LEARN_CATEGORIES } from "@/lib/learning/types";
import { hasScorableProfile, toCandidate } from "@/lib/profile/score";
import { cn } from "@/lib/utils";
import { conceptStrings } from "@/lib/i18n/concepts";
import { interviewStrings } from "@/lib/i18n/interview";
import { localizedTitle } from "@/lib/i18n/titles";

export const dynamic = "force-dynamic";
export const generateMetadata = localizedTitle("learn");

const SCORE_SELECT = { techStack: true, roleCategory: true, seniority: true, location: true, workMode: true } as const;
/** Jobs sampled for "recommended for you" impact (newest active). Bounded to keep the page fast. */
const IMPACT_SAMPLE = 300;

export default async function LearnPage() {
  const [{ locale }, session] = await Promise.all([getDictionary(), auth()]);
  const s = learningStrings(locale);
  const userId = session?.user?.id;
  const hub = learningHubStrings(locale);
  const cs = conceptStrings(locale);
  const iv = interviewStrings(locale);
  const ps = problemSolvingStrings(locale);
  const [demand, progress, profile] = await Promise.all([
    demandMap(),
    getProgress(userId),
    userId ? db.profile.findUnique({ where: { userId } }) : null,
  ]);
  const statusOf = new Map(progress.map((p) => [p.skill, p.status]));
  const status = (id: string): LearnStatus => statusOf.get(id) ?? "NONE";
  const done = progress.filter((p) => p.status === "DONE").length;
  const learning = progress.length - done;

  const cardLabels = { status: s.status, hoursPill: s.hoursPill, demandPill: s.demandPill };
  const toCard = (id: string): ExplorerSkill => {
    const n = GRAPH.byId.get(id)!;
    return {
      id: n.id,
      label: n.label,
      aliases: n.aliases,
      category: n.category,
      categoryLabel: s.category[n.category],
      hours: n.hours,
      demand: demand.get(n.id) ?? 0,
      status: status(n.id),
    };
  };

  // Full grid: most in-demand first, then alphabetical.
  const skills = GRAPH.nodes
    .map((n) => toCard(n.id))
    .sort((a, b) => b.demand - a.demand || a.label.localeCompare(b.label));
  const categories = LEARN_CATEGORIES.map((id) => ({
    id,
    label: s.category[id],
    count: skills.filter((x) => x.category === id).length,
  })).filter((c) => c.count > 0);

  // Personal sections.
  const candidate = hasScorableProfile(profile) ? toCandidate(profile) : null;
  const known = knownSkillIds(
    candidate?.skills ?? [],
    progress.filter((p) => p.status === "DONE").map((p) => p.skill),
  );
  const continuing = progress.filter((p) => p.status === "LEARNING" && GRAPH.byId.has(p.skill)).map((p) => p.skill);

  let recommended: { card: ExplorerSkill; gain: number | null }[] = [];
  let recommendedByImpact = false;
  if (candidate) {
    const ready = GRAPH.nodes.filter(
      (n) => !known.has(n.id) && !statusOf.has(n.id) && n.prerequisites.every((p) => known.has(p)),
    );
    // Prefer jobs in the user's target roles so suggestions fit their direction; widen if too few.
    const sample = (roles?: string[]) =>
      db.job.findMany({
        where: { isActive: true, ...(roles?.length ? { roleCategory: { in: roles } } : {}) },
        select: SCORE_SELECT,
        orderBy: { postedAt: "desc" },
        take: IMPACT_SAMPLE,
      });
    let jobs = await sample(candidate.targetRoles);
    if (jobs.length < 20 && candidate.targetRoles.length) jobs = await sample();
    const scored = ready
      .filter((n) => (demand.get(n.id) ?? 0) > 0)
      .map((n) => ({ n, impact: crossJobImpact(candidate, jobs, n.label) }));
    recommendedByImpact = scored.some((x) => x.impact.jobs > 0);
    recommended = scored
      .sort(
        (a, b) =>
          b.impact.jobs * b.impact.avgGain - a.impact.jobs * a.impact.avgGain ||
          (demand.get(b.n.id) ?? 0) - (demand.get(a.n.id) ?? 0),
      )
      .slice(0, 4)
      .map((x) => ({ card: toCard(x.n.id), gain: x.impact.jobs || null }));
  }

  const tracks = TRACKS.map((tr) => {
    const order = trackOrder(tr.skills);
    const doneCount = order.filter((id) => known.has(id)).length;
    const nextId = order.find((id) => !known.has(id));
    return { id: tr.id, order, doneCount, nextId };
  });

  return (
    <div className="flex flex-col gap-10 md:gap-14">
      {/* Hero */}
      <header className="motion-safe:animate-rise flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <p className="kicker inline-flex items-center gap-1.5">
            <Route className="size-3.5" aria-hidden />
            {s.nav}
          </p>
          <h1 className="text-display max-w-[16ch] font-black">{s.title}</h1>
          <p className="text-foreground/80 max-w-[60ch] text-lg leading-relaxed">{s.heroLead}</p>
        </div>
        <dl className="flex flex-wrap gap-x-8 gap-y-3">
          {[
            [GRAPH.nodes.length, s.statSkills],
            [TRACKS.length, s.statTracks],
            ...(userId
              ? ([
                  [learning, s.statLearning],
                  [done, s.statDone],
                ] as const)
              : []),
          ].map(([n, label]) => (
            <div key={label} className="flex items-baseline gap-2">
              <dt className="sr-only">{label}</dt>
              <dd className="font-heading text-3xl leading-none font-black tabular-nums">{n}</dd>
              <span aria-hidden className="text-muted-foreground text-sm">
                {label}
              </span>
            </div>
          ))}
        </dl>
      </header>

      <Link
        href="/learn/problem-solving"
        data-testid="ps-entry"
        className="group bg-card hover:bg-secondary/60 flex min-h-16 items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 transition-colors sm:px-6"
      >
        <span className="flex min-w-0 items-center gap-3">
          <Puzzle className="text-primary size-6 shrink-0" aria-hidden />
          <span className="flex min-w-0 flex-col">
            <span className="font-bold">{ps.navShort}</span>
            <span className="text-foreground/75 text-sm">{ps.entryLead}</span>
          </span>
        </span>
        <ArrowLeft className="size-5 shrink-0 ltr:rotate-180" aria-hidden />
      </Link>

      {/* Personal: logged out / no profile / continue + recommended */}
      {!userId ? (
        <aside className="bg-card flex flex-col items-start gap-4 rounded-xl border p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex items-start gap-3">
            <span className="bg-accent text-accent-foreground grid size-10 shrink-0 place-items-center rounded-full">
              <Sparkles className="size-5" aria-hidden />
            </span>
            <div className="flex flex-col gap-1">
              <h2 className="text-lg font-bold">{s.loggedOutTitle}</h2>
              <p className="text-foreground/75 max-w-[60ch] text-sm leading-relaxed">{s.loggedOutBody}</p>
            </div>
          </div>
          <Button asChild className="shrink-0 rounded-full px-5">
            <Link href="/login?next=/learn">{s.loginCta}</Link>
          </Button>
        </aside>
      ) : (
        <>
          <Link
            href="/learn/me"
            className="group bg-primary text-primary-foreground flex min-h-16 items-center justify-between gap-3 rounded-2xl px-4 py-3.5 shadow-sm transition-transform hover:-translate-y-0.5 motion-reduce:transition-none sm:px-6"
          >
            <span className="flex min-w-0 items-center gap-3">
              <LayoutDashboard className="size-6 shrink-0" aria-hidden />
              <span className="flex min-w-0 flex-col">
                <span className="font-bold">{hub.navMine}</span>
                <span className="text-primary-foreground/85 text-sm">{hub.dashLead}</span>
              </span>
            </span>
            <ArrowLeft className="size-5 shrink-0 ltr:rotate-180" aria-hidden />
          </Link>
          <Link
            href="/learn/concepts"
            data-testid="concepts-entry"
            className="group bg-card hover:bg-secondary/60 flex min-h-16 items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 transition-colors sm:px-6"
          >
            <span className="flex min-w-0 items-center gap-3">
              <Lightbulb className="text-primary size-6 shrink-0" aria-hidden />
              <span className="flex min-w-0 flex-col">
                <span className="font-bold">{cs.entryTitle}</span>
                <span className="text-foreground/75 text-sm">{cs.entryLead}</span>
              </span>
            </span>
            <ArrowLeft className="size-5 shrink-0 ltr:rotate-180" aria-hidden />
          </Link>
          <Link
            href="/interview"
            data-testid="interview-entry"
            className="group bg-card hover:bg-secondary/60 flex min-h-16 items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 transition-colors sm:px-6"
          >
            <span className="flex min-w-0 items-center gap-3">
              <MessagesSquare className="text-primary size-6 shrink-0" aria-hidden />
              <span className="flex min-w-0 flex-col">
                <span className="font-bold">{iv.learnCard}</span>
                <span className="text-foreground/75 text-sm">{iv.learnCardLead}</span>
              </span>
            </span>
            <ArrowLeft className="size-5 shrink-0 ltr:rotate-180" aria-hidden />
          </Link>
          {continuing.length > 0 && (
            <section aria-labelledby="continue" className="flex flex-col gap-4">
              <h2 id="continue" className="text-2xl font-bold">
                {s.continueTitle}
              </h2>
              <ul className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {continuing.map((id) => (
                  <li key={id} className="min-w-0">
                    <SkillCard skill={toCard(id)} labels={cardLabels} />
                  </li>
                ))}
              </ul>
            </section>
          )}
          {candidate ? (
            recommended.length > 0 && (
              <section aria-labelledby="recommended" className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <h2 id="recommended" className="inline-flex items-center gap-2 text-2xl font-bold">
                    <Sparkles className="text-primary size-5" aria-hidden />
                    {s.recommendedTitle}
                  </h2>
                  <p className="text-muted-foreground text-sm">
                    {recommendedByImpact ? s.recommendedIntro : s.recommendedDemandIntro}
                  </p>
                </div>
                <ul className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-4">
                  {recommended.map(({ card, gain }) => (
                    <li key={card.id} className="min-w-0">
                      <SkillCard
                        skill={card}
                        labels={cardLabels}
                        footer={
                          gain ? (
                            <span className="text-fit bg-fit-soft/60 -mx-4 -mb-4 flex items-center gap-1.5 rounded-b-xl border-t border-current/10 px-4 py-2 text-xs font-semibold">
                              <TrendingUp className="size-3.5" aria-hidden />
                              {fmt(s.recommendedGain, { n: gain })}
                            </span>
                          ) : undefined
                        }
                      />
                    </li>
                  ))}
                </ul>
              </section>
            )
          ) : (
            <aside className="bg-card flex flex-col items-start gap-4 rounded-xl border p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="bg-secondary grid size-10 shrink-0 place-items-center rounded-full">
                  <UserRound className="size-5" aria-hidden />
                </span>
                <div className="flex flex-col gap-1">
                  <h2 className="text-lg font-bold">{s.noProfileTitle}</h2>
                  <p className="text-foreground/75 text-sm">{s.noProfileBody}</p>
                </div>
              </div>
              <Button asChild variant="outline" className="shrink-0 rounded-full px-5">
                <Link href="/profile">{s.profileCta}</Link>
              </Button>
            </aside>
          )}
        </>
      )}

      {/* Tracks */}
      <section aria-labelledby="tracks" className="flex flex-col gap-4">
        <h2 id="tracks" className="text-2xl font-bold">
          {s.tracks}
        </h2>
        <ul className="grid gap-3 md:grid-cols-2">
          {tracks.map((tr) => {
            const total = tr.order.length;
            const next = tr.nextId ? GRAPH.byId.get(tr.nextId)! : null;
            return (
              <li key={tr.id} className="bg-card flex min-w-0 flex-col gap-4 rounded-xl border p-4 sm:p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <h3 className="text-lg leading-snug font-bold">{s.track[tr.id] ?? tr.id}</h3>
                    <p className="text-muted-foreground text-xs">
                      {userId
                        ? `${fmt(s.trackProgress, { done: tr.doneCount, total })} · ${fmt(s.skillsCount, { n: total })}`
                        : fmt(s.skillsCount, { n: total })}
                    </p>
                  </div>
                  {userId && (
                    <ProgressRing
                      value={tr.doneCount / total}
                      size={44}
                      stroke={4}
                      label={fmt(s.trackProgress, { done: tr.doneCount, total })}
                    >
                      <span className="font-mono text-[0.7rem] font-medium tabular-nums" dir="ltr">
                        {tr.doneCount}/{total}
                      </span>
                    </ProgressRing>
                  )}
                </div>
                {/* ordered steps; a thin connector reads as a path, wraps on narrow screens */}
                <ol className="flex flex-wrap items-center gap-x-1 gap-y-2">
                  {tr.order.map((id, i) => {
                    const n = GRAPH.byId.get(id)!;
                    const have = known.has(id);
                    const isNext = id === tr.nextId;
                    return (
                      <li key={id} className="flex items-center gap-1">
                        {i > 0 && <span aria-hidden className="bg-border h-px w-2.5" />}
                        <Link
                          href={`/learn/${id}`}
                          className={cn(
                            "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-2.5 text-[0.8rem] font-medium transition-colors",
                            have
                              ? "border-fit/25 bg-fit-soft text-accent-foreground"
                              : isNext
                                ? "border-primary/50 bg-card text-foreground ring-primary/15 ring-2"
                                : "bg-card text-foreground/80 hover:border-foreground/30",
                          )}
                        >
                          {have ? (
                            <Check className="size-3.5" aria-label={s.status.DONE} />
                          ) : (
                            <span className="text-muted-foreground font-mono text-[0.65rem]">{i + 1}</span>
                          )}
                          <bdi dir="ltr">{n.label}</bdi>
                        </Link>
                      </li>
                    );
                  })}
                </ol>
                <div className="mt-auto border-t pt-3">
                  {next ? (
                    <Link
                      href={`/learn/${next.id}`}
                      className="group text-primary inline-flex min-h-10 items-center gap-2 text-sm font-semibold"
                    >
                      <SkillMonogram label={next.label} category={next.category} size="sm" />
                      <span className="group-hover:underline">
                        {fmt(tr.doneCount ? s.trackNext : s.trackStart, { skill: next.label })}
                      </span>
                      <ArrowLeft
                        className="size-4 transition-transform group-hover:-translate-x-0.5 ltr:rotate-180 ltr:group-hover:translate-x-0.5"
                        aria-hidden
                      />
                    </Link>
                  ) : (
                    <p className="text-fit inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold">
                      <Check className="size-4" aria-hidden />
                      {s.trackDone}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* All skills: search + filter */}
      <section aria-labelledby="all-skills" className="flex flex-col gap-4">
        <h2 id="all-skills" className="text-2xl font-bold">
          {s.allSkills}
        </h2>
        <LearnExplorer
          skills={skills}
          categories={categories}
          labels={{
            searchLabel: s.searchLabel,
            searchPlaceholder: s.searchPlaceholder,
            filterLabel: s.filterLabel,
            filterAll: s.filterAll,
            clearFilters: s.clearFilters,
            noResults: s.noResults,
            resultsCount: s.resultsCount,
            ...cardLabels,
          }}
        />
      </section>
    </div>
  );
}
