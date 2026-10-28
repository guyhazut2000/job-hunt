import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BookOpen,
  Briefcase,
  Check,
  ChevronDown,
  CircleDashed,
  Clock,
  Dumbbell,
  ExternalLink,
  GraduationCap,
  Hammer,
  Map as MapIcon,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { auth } from "@/auth";
import { Percent } from "@/components/Percent";
import { SkillStatusControl } from "@/components/learning/SkillStatusControl";
import { MetaPill, SkillCard, SkillMonogram, type LearnStatus } from "@/components/learning/SkillVisuals";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { getDictionary } from "@/lib/i18n";
import { fmt, learningStrings } from "@/lib/i18n/learning";
import { learningHubStrings } from "@/lib/i18n/learning-hub";
import { crossJobImpact, GRAPH, knownSkillIds, prerequisitePath, scoreWithout, withSkills } from "@/lib/learning/graph";
import { demandMap, getProgress } from "@/lib/learning/server";
import { STAGES, type Resource } from "@/lib/learning/types";
import { levelFromDepth } from "@/lib/learning/ui";
import { hasScorableProfile, scoreMatch, toCandidate } from "@/lib/profile/score";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ skill: string }> };

export async function generateMetadata({ params }: Params) {
  const n = GRAPH.byId.get((await params).skill);
  return { title: n ? `${n.label} roadmap` : "Learn" };
}

const SCORE_SELECT = { techStack: true, roleCategory: true, seniority: true, location: true, workMode: true } as const;

export default async function SkillPage({ params }: Params) {
  const { skill } = await params;
  const node = GRAPH.byId.get(skill);
  if (!node) notFound();

  const [{ locale }, session] = await Promise.all([getDictionary(), auth()]);
  const s = learningStrings(locale);
  const hub = learningHubStrings(locale);
  const userId = session?.user?.id;
  const names = [node.label, ...node.aliases];
  const [demand, progress, profile, jobs, stageProgress] = await Promise.all([
    demandMap(),
    getProgress(userId),
    userId ? db.profile.findUnique({ where: { userId } }) : null,
    // Bounded: jobs that list this skill, newest first (impact only matters there).
    db.job.findMany({
      where: { isActive: true, techStack: { hasSome: names } },
      select: { id: true, title: true, company: { select: { name: true } }, ...SCORE_SELECT },
      orderBy: { postedAt: "desc" },
      take: 400,
    }),
    userId
      ? db.stageProgress.findMany({ where: { userId, skill: node.id }, select: { stage: true, status: true } })
      : Promise.resolve([]),
  ]);
  const statusOf = new Map(progress.map((p) => [p.skill, p.status]));
  const stageStatus = new Map(stageProgress.map((r) => [r.stage, r.status]));
  const practiceStage = STAGES.find((st) => stageStatus.get(st) !== "DONE") ?? STAGES[0];
  const mine = progress.find((p) => p.skill === node.id);
  const doneIds = progress.filter((p) => p.status === "DONE").map((p) => p.skill);
  const candidate = hasScorableProfile(profile) ? toCandidate(profile) : null;
  const known = knownSkillIds(candidate?.skills ?? [], doneIds);
  const fullPath = prerequisitePath(node.id);
  const path = fullPath.filter((id) => id !== node.id);
  const level = levelFromDepth(path.length);
  const haveCount = path.filter((id) => known.has(id)).length;
  const next = [...(GRAPH.dependents.get(node.id) ?? [])].map((id) => GRAPH.byId.get(id)!);
  const count = demand.get(node.id) ?? jobs.length;
  const impact = candidate && !known.has(node.id) ? crossJobImpact(candidate, jobs, node.label) : null;
  // Top jobs: match now, and either "after learning" or (if this feature added it) "before".
  const top = jobs.slice(0, 5).map((j) => {
    if (!candidate) return { j, now: null, other: null };
    const now = scoreMatch(candidate, j).score;
    const other = mine?.addedToProfile
      ? scoreWithout(candidate, j, [node.label])
      : known.has(node.id)
        ? null
        : scoreMatch(withSkills(candidate, [node.label]), j).score;
    return { j, now, other };
  });
  const lang = locale === "he" ? "he-IL" : "en-US";
  const status: LearnStatus = mine?.status ?? "NONE";
  const cardLabels = { status: s.status, hoursPill: s.hoursPill, demandPill: s.demandPill };

  const toc = [
    { id: "path", label: s.path },
    { id: "resources", label: s.resources },
    ...(top.length ? [{ id: "jobs", label: s.jobsNeedTitle }] : []),
    ...(next.length ? [{ id: "next", label: s.nextSkills }] : []),
  ];

  const resource = (Icon: LucideIcon, heading: string, blurb: string, r: Resource, tone: string) => (
    <a
      href={r.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group bg-card hover:border-foreground/25 flex min-w-0 flex-col gap-3 rounded-xl border p-4 transition-[border-color,box-shadow] hover:shadow-[0_6px_20px_-12px_oklch(0.21_0.014_60/0.35)]"
    >
      <span className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2">
          <span className={cn("grid size-9 place-items-center rounded-lg", tone)}>
            <Icon className="size-[1.1rem]" aria-hidden />
          </span>
          <span className="text-sm font-bold">{heading}</span>
        </span>
        <span className="bg-fit-soft text-fit rounded-full px-2 py-0.5 text-[0.7rem] font-semibold">{s.free}</span>
      </span>
      <span className="flex flex-col gap-1">
        <span className="leading-snug font-semibold group-hover:underline">
          <bdi dir="ltr">{r.title}</bdi>
        </span>
        <span className="text-muted-foreground text-xs">{blurb}</span>
      </span>
      <span className="text-muted-foreground mt-auto flex items-center justify-between gap-2 border-t pt-2.5 text-xs">
        <span className="truncate">{r.by}</span>
        <ExternalLink className="size-3.5 shrink-0" aria-label={s.external} />
      </span>
    </a>
  );

  return (
    <div className="flex flex-col gap-8">
      <Link
        href="/learn"
        className="text-muted-foreground hover:text-foreground -mt-2 inline-flex min-h-11 w-fit items-center gap-1.5 text-sm"
      >
        <ArrowRight className="size-4 ltr:rotate-180" aria-hidden />
        {s.back}
      </Link>

      {/* Hero */}
      <header className="bg-card motion-safe:animate-rise -mt-4 flex flex-col gap-5 rounded-2xl border p-5 sm:p-7">
        <div className="flex items-start gap-4">
          <SkillMonogram label={node.label} category={node.category} size="lg" />
          <div className="flex min-w-0 flex-col gap-1.5">
            <p className="kicker">{s.category[node.category]}</p>
            <h1 className="text-title leading-tight font-black">
              <bdi dir="ltr">{node.label}</bdi>
            </h1>
          </div>
        </div>
        <p className="text-foreground/85 max-w-[65ch] text-[1.05rem] leading-relaxed">{node.summary[locale]}</p>
        <ul className="flex flex-wrap gap-2" aria-label={s.path}>
          <li>
            <MetaPill icon={Clock} title={s.hoursLabel}>
              <span className="sr-only">{s.hoursLabel}: </span>
              {fmt(s.hoursPill, { n: node.hours })}
            </MetaPill>
          </li>
          <li>
            <MetaPill icon={BarChart3} title={s.levelLabel}>
              <span className="sr-only">{s.levelLabel}: </span>
              {s.level[level]}
            </MetaPill>
          </li>
          {count > 0 && (
            <li>
              <MetaPill icon={Briefcase} title={s.demandLabel}>
                <span className="sr-only">{s.demandLabel}: </span>
                {fmt(s.demandPill, { n: count.toLocaleString(lang) })}
              </MetaPill>
            </li>
          )}
          {impact && impact.jobs > 0 && (
            <li>
              <MetaPill icon={TrendingUp} className="border-fit/25 bg-fit-soft text-accent-foreground">
                {fmt(s.recommendedGain, { n: impact.jobs })}
              </MetaPill>
            </li>
          )}
        </ul>
        <div className="border-t pt-5">
          {userId ? (
            <SkillStatusControl
              skill={node.id}
              initial={status}
              initialProof={mine?.proofUrl}
              labels={{
                status: s.status,
                statusLabel: s.statusLabel,
                proofLabel: s.proofLabel,
                proofPlaceholder: s.proofPlaceholder,
                save: s.save,
                saved: s.saved,
                doneAdded: s.doneAdded,
                doneAlready: s.doneAlready,
                invalidUrl: s.invalidUrl,
              }}
            />
          ) : (
            <Button asChild size="lg" className="w-full rounded-full sm:w-fit">
              <Link href={`/login?next=/learn/${node.id}`}>{s.loginToTrack}</Link>
            </Button>
          )}
        </div>
        <Button
          asChild
          size="lg"
          variant={userId ? "default" : "outline"}
          className="min-h-12 w-full rounded-full sm:w-fit"
        >
          <Link href={`/learn/${node.id}/${practiceStage}`}>
            <Dumbbell className="size-4" aria-hidden />
            {hub.practiceCta}
          </Link>
        </Button>
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-10">
        <div className="flex min-w-0 flex-col gap-10">
          {/* Path: prerequisites + stage stepper */}
          <section aria-labelledby="path" className="flex scroll-mt-24 flex-col gap-5">
            <div className="flex flex-col gap-1">
              <h2 id="path" className="scroll-mt-24 text-2xl font-bold">
                {s.path}
              </h2>
              <p className="text-muted-foreground text-sm">{s.pathIntro}</p>
            </div>

            <div className="bg-card flex flex-col gap-3 rounded-xl border p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-bold">{s.prereqs}</h3>
                {path.length > 0 && userId && (
                  <span className="text-muted-foreground text-xs">
                    {fmt(s.prereqReady, { have: haveCount, total: path.length })}
                  </span>
                )}
              </div>
              {path.length === 0 ? (
                <p className="text-foreground/80 text-sm">{s.noPrereqs}</p>
              ) : (
                <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-2">
                  {path.map((id) => {
                    const p = GRAPH.byId.get(id)!;
                    const have = known.has(id);
                    return (
                      <li key={id} className="flex items-center gap-1.5">
                        <Link
                          href={`/learn/${id}`}
                          className={cn(
                            "inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors",
                            have
                              ? "border-fit/25 bg-fit-soft text-accent-foreground"
                              : "bg-card hover:border-foreground/30 border-dashed",
                          )}
                        >
                          {have ? (
                            <Check className="text-fit size-4" aria-hidden />
                          ) : (
                            <CircleDashed className="text-muted-foreground size-4" aria-hidden />
                          )}
                          <bdi dir="ltr">{p.label}</bdi>
                          <span className="sr-only">({have ? s.youHave : s.missing})</span>
                        </Link>
                        <ArrowLeft aria-hidden className="text-muted-foreground size-3.5 ltr:rotate-180" />
                      </li>
                    );
                  })}
                  <li>
                    <span className="bg-primary text-primary-foreground inline-flex min-h-10 items-center rounded-full px-3 text-sm font-semibold">
                      <bdi dir="ltr">{node.label}</bdi>
                    </span>
                  </li>
                </ol>
              )}
            </div>

            {/* Vertical stepper. The connector sits on the logical start edge (right in Hebrew). */}
            <ol className="flex flex-col">
              {STAGES.map((st, i) => {
                const topics = node.stages[st];
                const stageDone = status === "DONE" || stageStatus.get(st) === "DONE";
                return (
                  <li key={st} className="relative flex gap-4 pb-4 last:pb-0">
                    {i < STAGES.length - 1 && (
                      <span aria-hidden className="bg-border absolute start-[1.2rem] top-11 bottom-0 w-0.5 rounded" />
                    )}
                    <span
                      aria-hidden
                      className={cn(
                        "z-10 grid size-10 shrink-0 place-items-center rounded-full border-2 font-mono text-sm font-semibold",
                        stageDone ? "border-fit bg-fit-soft text-fit" : "border-primary/40 bg-card text-primary",
                      )}
                    >
                      {stageDone ? <Check className="size-4" /> : i + 1}
                    </span>
                    <details open={i === 0} className="group bg-card min-w-0 flex-1 rounded-xl border">
                      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-3 [&::-webkit-details-marker]:hidden">
                        <span className="flex min-w-0 flex-col">
                          <span className="text-muted-foreground text-xs">{fmt(s.stageNum, { n: i + 1 })}</span>
                          <span className="font-bold">{s.stage[st]}</span>
                        </span>
                        <span className="text-muted-foreground inline-flex shrink-0 items-center gap-2 text-xs">
                          {fmt(s.stageTopics, { n: topics.length })}
                          <ChevronDown
                            className="size-4 transition-transform group-open:rotate-180 motion-reduce:transition-none"
                            aria-hidden
                          />
                        </span>
                      </summary>
                      <ul className="flex flex-col gap-1.5 border-t px-4 py-3" dir="ltr">
                        {topics.map((topic) => (
                          <li key={topic} className="flex items-start gap-2 text-[0.95rem] leading-relaxed">
                            <span aria-hidden className="bg-primary/60 mt-[0.6em] size-1.5 shrink-0 rounded-full" />
                            {topic}
                          </li>
                        ))}
                      </ul>
                      <div className="border-t px-4 py-3">
                        <Link
                          href={`/learn/${node.id}/${st}`}
                          className="text-primary inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold hover:underline"
                        >
                          <Dumbbell className="size-4" aria-hidden />
                          {hub.startPracticeStage}
                          <ArrowLeft className="size-4 ltr:rotate-180" aria-hidden />
                        </Link>
                      </div>
                    </details>
                  </li>
                );
              })}
            </ol>
          </section>

          {/* Resources */}
          <section aria-labelledby="resources" className="flex flex-col gap-4">
            <h2 id="resources" className="scroll-mt-24 text-2xl font-bold">
              {s.resources}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {resource(BookOpen, s.docs, s.resourceDocs, node.docs, "bg-accent text-accent-foreground")}
              {resource(GraduationCap, s.course, s.resourceCourse, node.course, "bg-secondary text-foreground")}
            </div>
            <div className="bg-caution-soft/45 border-caution/20 flex flex-col gap-2 rounded-xl border p-4">
              <span className="inline-flex items-center gap-2">
                <span className="bg-caution-soft text-caution grid size-9 place-items-center rounded-lg">
                  <Hammer className="size-[1.1rem]" aria-hidden />
                </span>
                <span className="flex flex-col">
                  <span className="text-sm font-bold">{s.project}</span>
                  <span className="text-foreground/70 text-xs">{s.resourceProject}</span>
                </span>
              </span>
              <p className="max-w-[65ch] leading-relaxed">{node.project[locale]}</p>
            </div>
            {node.roadmapSh && (
              <a
                href={`https://roadmap.sh/${node.roadmapSh}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary inline-flex min-h-11 w-fit items-center gap-1.5 text-sm font-semibold hover:underline"
              >
                <MapIcon className="size-4" aria-hidden />
                {s.roadmapSh}
                <ExternalLink className="size-3.5" aria-label={s.external} />
              </a>
            )}
          </section>

          {/* Jobs that need this */}
          {top.length > 0 && (
            <section aria-labelledby="jobs" className="flex flex-col gap-4">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <h2 id="jobs" className="scroll-mt-24 text-2xl font-bold">
                  {s.jobsNeedTitle}
                </h2>
                <Link
                  href={`/jobs?tech=${encodeURIComponent(node.label)}`}
                  className="text-primary inline-flex min-h-10 items-center gap-1 text-sm font-semibold hover:underline"
                >
                  {fmt(s.demandLink, { skill: node.label })}
                  <ArrowLeft className="size-4 ltr:rotate-180" aria-hidden />
                </Link>
              </div>
              <ul className="bg-card divide-y rounded-xl border">
                {top.map(({ j, now, other }) => (
                  <li key={j.id}>
                    <Link
                      href={`/jobs/${j.id}`}
                      className="hover:bg-secondary/50 flex min-h-14 items-center justify-between gap-3 px-4 py-2.5 transition-colors first:rounded-t-xl last:rounded-b-xl"
                    >
                      <span className="flex min-w-0 flex-col">
                        <span dir="auto" className="truncate font-semibold">
                          {j.title}
                        </span>
                        <span className="text-muted-foreground truncate text-sm">{j.company.name}</span>
                      </span>
                      {now != null && (
                        <span className="flex shrink-0 items-center gap-1 font-mono text-sm" dir="ltr">
                          {mine?.addedToProfile && other != null ? (
                            <>
                              <Percent value={other} className="text-muted-foreground" />→
                              <Percent value={now} className="text-fit font-semibold" />
                            </>
                          ) : other != null && other !== now ? (
                            <>
                              <Percent value={now} className="text-muted-foreground" />→
                              <Percent value={other} className="text-fit font-semibold" />
                            </>
                          ) : (
                            <Percent value={now} />
                          )}
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Next skills unlocked */}
          {next.length > 0 && (
            <section aria-labelledby="next" className="flex flex-col gap-4">
              <h2 id="next" className="scroll-mt-24 text-2xl font-bold">
                {s.nextSkills}
              </h2>
              <ul className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 xl:grid-cols-3">
                {next.map((n) => (
                  <li key={n.id} className="min-w-0">
                    <SkillCard
                      skill={{
                        id: n.id,
                        label: n.label,
                        category: n.category,
                        categoryLabel: s.category[n.category],
                        hours: n.hours,
                        demand: demand.get(n.id) ?? 0,
                        status: statusOf.get(n.id) ?? "NONE",
                      }}
                      labels={cardLabels}
                    />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* Aside: sticky TOC (desktop) + market demand */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
          <nav aria-labelledby="toc" className="hidden flex-col gap-1 lg:flex">
            <h2 id="toc" className="kicker mb-1">
              {s.tocTitle}
            </h2>
            {toc.map((t) => (
              <a
                key={t.id}
                href={`#${t.id}`}
                className="text-foreground/75 hover:text-foreground hover:border-primary border-s-2 border-transparent py-1.5 ps-3 text-sm transition-colors"
              >
                {t.label}
              </a>
            ))}
          </nav>
          <div className="bg-card flex flex-col gap-3 rounded-xl border p-4">
            <h2 className="kicker">{s.demandTitle}</h2>
            <p className="leading-snug">
              <span className="font-heading block text-4xl leading-none font-black tabular-nums">
                {count.toLocaleString(lang)}
              </span>
              <span className="text-foreground/75 text-sm">
                {fmt(s.demandLine, { n: "", skill: "" }).trim()} <bdi dir="ltr">{node.label}</bdi>
              </span>
            </p>
            {impact && impact.jobs > 0 && (
              <p className="text-fit bg-fit-soft/60 flex items-start gap-1.5 rounded-lg p-2.5 text-sm font-semibold">
                <TrendingUp className="mt-0.5 size-4 shrink-0" aria-hidden />
                {fmt(s.impactLine, { skill: node.label, n: impact.jobs, avg: impact.avgGain })}
              </p>
            )}
          </div>
          <Link
            href={`/learn/${node.id}/${practiceStage}`}
            className="bg-accent/60 hover:bg-accent flex flex-col gap-1 rounded-xl border p-4 transition-colors"
          >
            <span className="inline-flex items-center gap-2 font-bold">
              <Dumbbell className="size-4" aria-hidden />
              {hub.practiceCta}
            </span>
            <span className="text-foreground/75 text-xs leading-relaxed">{hub.tutorLead}</span>
          </Link>
        </aside>
      </div>
    </div>
  );
}
