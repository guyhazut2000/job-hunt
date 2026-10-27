import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  Clock,
  ExternalLink,
  GraduationCap,
  Hammer,
  Map as MapIcon,
  TrendingUp,
} from "lucide-react";
import { auth } from "@/auth";
import { Percent } from "@/components/Percent";
import { SkillStatusControl } from "@/components/learning/SkillStatusControl";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { getDictionary } from "@/lib/i18n";
import { fmt, learningStrings } from "@/lib/i18n/learning";
import { crossJobImpact, GRAPH, knownSkillIds, prerequisitePath, scoreWithout, withSkills } from "@/lib/learning/graph";
import { demandMap, getProgress } from "@/lib/learning/server";
import { STAGES, type Resource } from "@/lib/learning/types";
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
  const userId = session?.user?.id;
  const names = [node.label, ...node.aliases];
  const [demand, progress, profile, jobs] = await Promise.all([
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
  ]);
  const mine = progress.find((p) => p.skill === node.id);
  const doneIds = progress.filter((p) => p.status === "DONE").map((p) => p.skill);
  const candidate = hasScorableProfile(profile) ? toCandidate(profile) : null;
  const known = knownSkillIds(candidate?.skills ?? [], doneIds);
  const path = prerequisitePath(node.id).filter((id) => id !== node.id);
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

  const res = (icon: React.ReactNode, heading: string, r: Resource) => (
    <a
      href={r.url}
      target="_blank"
      rel="noopener noreferrer"
      className="card hover:border-primary/50 flex min-h-11 flex-col gap-1 p-4 transition-colors"
    >
      <span className="kicker flex items-center gap-1.5">
        {icon}
        {heading}
      </span>
      <span className="font-semibold" dir="ltr">
        {r.title}
      </span>
      <span className="text-muted-foreground flex items-center gap-1 text-sm">
        {r.by}
        <ExternalLink className="size-3.5" aria-label={s.external} />
      </span>
    </a>
  );

  return (
    <div className="flex flex-col gap-8">
      <Link
        href="/learn"
        className="text-muted-foreground hover:text-foreground inline-flex min-h-11 w-fit items-center gap-1.5 text-sm"
      >
        <ArrowRight className="size-4 ltr:rotate-180" aria-hidden />
        {s.back}
      </Link>

      <header className="rule-double -mt-6 flex flex-col gap-3 pb-6">
        <p className="kicker">{s.category[node.category]}</p>
        <h1 className="text-title font-black" dir="ltr">
          <bdi>{node.label}</bdi>
        </h1>
        <p className="text-foreground/85 max-w-[68ch] text-[1.05rem]">{node.summary[locale]}</p>
        <p className="text-muted-foreground inline-flex items-center gap-1.5 text-sm">
          <Clock className="size-4" aria-hidden />
          {fmt(s.hours, { n: node.hours })}
        </p>
        {userId ? (
          <SkillStatusControl
            skill={node.id}
            initial={mine?.status ?? "NONE"}
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
          <Button asChild variant="outline" className="w-fit">
            <Link href={`/login?next=/learn/${node.id}`}>{s.loginToTrack}</Link>
          </Button>
        )}
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-8">
          <section aria-labelledby="path" className="flex flex-col gap-4">
            <div>
              <h2 id="path" className="font-heading text-xl font-bold">
                {s.path}
              </h2>
              <p className="text-muted-foreground text-sm">{s.pathIntro}</p>
            </div>

            <div className="flex flex-col gap-2">
              <h3 className="kicker">{s.prereqs}</h3>
              {path.length === 0 ? (
                <p className="text-sm">{s.noPrereqs}</p>
              ) : (
                <ol className="flex flex-wrap items-center gap-1.5">
                  {path.map((id, i) => {
                    const p = GRAPH.byId.get(id)!;
                    const have = known.has(id);
                    return (
                      <li key={id} className="flex items-center gap-1.5">
                        {i > 0 && <ArrowLeft aria-hidden className="text-muted-foreground size-3 ltr:rotate-180" />}
                        <Link
                          href={`/learn/${id}`}
                          className={cn(
                            "chip inline-flex min-h-9 items-center gap-1 hover:underline",
                            have && "bg-fit-soft",
                          )}
                        >
                          <bdi dir="ltr">{p.label}</bdi>
                          {have && <Check className="text-fit size-3.5" aria-label={s.youHave} />}
                        </Link>
                      </li>
                    );
                  })}
                  <li className="flex items-center gap-1.5">
                    <ArrowLeft aria-hidden className="text-muted-foreground size-3 ltr:rotate-180" />
                    <span className="chip bg-primary text-primary-foreground inline-flex min-h-9 items-center">
                      <bdi dir="ltr">{node.label}</bdi>
                    </span>
                  </li>
                </ol>
              )}
            </div>

            {/* Stage timeline: line on the logical start edge (right in Hebrew, left in English). */}
            <ol className="flex flex-col">
              {STAGES.map((st, i) => (
                <li key={st} className="relative flex gap-4 pb-6 last:pb-0">
                  {i < STAGES.length - 1 && (
                    <span aria-hidden className="bg-border absolute start-[0.95rem] top-9 bottom-1 w-px" />
                  )}
                  <span
                    aria-hidden
                    className="bg-card border-primary/40 text-primary z-10 grid size-8 shrink-0 place-items-center rounded-full border-2 font-mono text-sm font-medium"
                  >
                    {i + 1}
                  </span>
                  <div className="flex min-w-0 flex-col gap-2 pt-1">
                    <h3 className="font-semibold">
                      {fmt(s.stageNum, { n: i + 1 })} · {s.stage[st]}
                    </h3>
                    <ul className="flex flex-wrap gap-1.5" dir="ltr">
                      {node.stages[st].map((topic) => (
                        <li key={topic} className="bg-secondary/70 rounded-md px-2 py-1 text-sm">
                          {topic}
                        </li>
                      ))}
                    </ul>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section aria-labelledby="resources" className="flex flex-col gap-3">
            <h2 id="resources" className="font-heading text-xl font-bold">
              {s.resources}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {res(<BookOpen className="size-4" aria-hidden />, s.docs, node.docs)}
              {res(<GraduationCap className="size-4" aria-hidden />, s.course, node.course)}
            </div>
            <div className="card bg-caution-soft/50 flex flex-col gap-1 p-4">
              <span className="kicker flex items-center gap-1.5">
                <Hammer className="size-4" aria-hidden />
                {s.project}
              </span>
              <p>{node.project[locale]}</p>
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

          {next.length > 0 && (
            <section aria-labelledby="next" className="flex flex-col gap-2">
              <h2 id="next" className="font-heading text-xl font-bold">
                {s.nextSkills}
              </h2>
              <ul className="flex flex-wrap gap-1.5">
                {next.map((n) => (
                  <li key={n.id}>
                    <Link href={`/learn/${n.id}`} className="chip inline-flex min-h-9 items-center hover:underline">
                      <bdi dir="ltr">{n.label}</bdi>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside aria-labelledby="demand" className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
          <div className="card flex flex-col gap-3 p-4">
            <h2 id="demand" className="kicker">
              {s.demandTitle}
            </h2>
            <p className="text-lg font-semibold">
              {fmt(s.demandLine, { n: count.toLocaleString(lang), skill: "" })}
              <bdi dir="ltr">{node.label}</bdi>
            </p>
            {impact && impact.jobs > 0 && (
              <p className="text-fit flex items-start gap-1.5 text-sm font-semibold">
                <TrendingUp className="mt-0.5 size-4 shrink-0" aria-hidden />
                {fmt(s.impactLine, { skill: node.label, n: impact.jobs, avg: impact.avgGain })}
              </p>
            )}
            <Link
              href={`/jobs?tech=${encodeURIComponent(node.label)}`}
              className="text-primary inline-flex min-h-11 items-center gap-1 text-sm font-semibold hover:underline"
            >
              {fmt(s.demandLink, { skill: node.label })}
            </Link>
          </div>

          {top.length > 0 && (
            <div className="card flex flex-col gap-1 p-4">
              <h2 className="kicker mb-1">{fmt(s.topJobs, { skill: node.label })}</h2>
              <ul className="flex flex-col">
                {top.map(({ j, now, other }) => (
                  <li key={j.id}>
                    <Link
                      href={`/jobs/${j.id}`}
                      className="hover:bg-secondary/60 -mx-2 flex min-h-11 items-center justify-between gap-2 rounded-md px-2 py-1.5"
                    >
                      <span className="flex min-w-0 flex-col">
                        <span dir="auto" className="truncate text-sm font-semibold">
                          {j.title}
                        </span>
                        <span className="text-muted-foreground truncate text-xs">{j.company.name}</span>
                      </span>
                      {now != null && (
                        <span className="flex shrink-0 items-center gap-1 font-mono text-xs" dir="ltr">
                          {mine?.addedToProfile && other != null ? (
                            <>
                              <Percent value={other} className="text-muted-foreground" />→
                              <Percent value={now} className="text-fit font-medium" />
                            </>
                          ) : other != null && other !== now ? (
                            <>
                              <Percent value={now} />→
                              <Percent value={other} className="text-fit font-medium" />
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
            </div>
          )}
          <p className="text-muted-foreground text-xs">{s.aiSoon}</p>
        </aside>
      </div>
    </div>
  );
}
