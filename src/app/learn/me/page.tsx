import Link from "next/link";
import {
  ArrowLeft,
  CalendarCheck,
  Check,
  Clock,
  Flame,
  Hammer,
  ListChecks,
  PlayCircle,
  RotateCcw,
  Sparkles,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { GoalEditor, LogSessionForm } from "@/components/learning/hub/HubForms";
import { ProgressRing, SkillMonogram } from "@/components/learning/SkillVisuals";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { getDictionary } from "@/lib/i18n";
import { fmt, learningStrings } from "@/lib/i18n/learning";
import { learningHubStrings, type LearningHubStrings } from "@/lib/i18n/learning-hub";
import { GRAPH } from "@/lib/learning/graph";
import { getHubData } from "@/lib/learning/hub";
import type { Reason } from "@/lib/learning/recommend";
import { STAGES, type Stage } from "@/lib/learning/types";
import { requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "My learning" };

const label = (id: string) => GRAPH.byId.get(id)?.label ?? id;
const list = (ids: string[]) => ids.map(label).join(", ");

function reasonText(r: Reason, t: LearningHubStrings): string {
  switch (r.kind) {
    case "continue":
      return r.pct > 0 ? fmt(t.reasons.continue, { pct: r.pct }) : t.reasons.continueFresh;
    case "prereqsMet":
      return fmt(t.reasons.prereqsMet, { skills: list(r.prereqs) });
    case "noPrereqs":
      return t.reasons.noPrereqs;
    case "jobs":
      return fmt(t.reasons.jobs, { n: r.jobs, avg: r.avgGain });
    case "foundation":
      return fmt(t.reasons.foundation, { skill: label(r.forId) });
    case "role":
      return fmt(t.reasons.role, { track: t.tracks[r.track] ?? r.track });
    case "unlocks":
      return fmt(t.reasons.unlocks, { skills: list(r.ids) });
    case "demand":
      return fmt(t.reasons.demand, { n: r.n });
  }
}

function Stat({
  icon: Icon,
  value,
  caption,
  tone,
}: {
  icon: LucideIcon;
  value: string | number;
  caption: string;
  tone: string;
}) {
  return (
    <div className="bg-card flex min-w-0 items-center gap-3 rounded-xl border p-3 sm:p-4">
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-lg", tone)}>
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="font-heading text-2xl leading-none font-black tabular-nums">{value}</span>
        <span className="text-muted-foreground truncate text-xs">{caption}</span>
      </span>
    </div>
  );
}

export default async function MyLearningPage() {
  const user = await requireUser();
  const [{ locale }, data] = await Promise.all([getDictionary(), getHubData(user.id)]);
  const s = learningStrings(locale);
  const t = learningHubStrings(locale);
  const lang = locale === "he" ? "he-IL" : "en-US";
  const hours = (m: number) => (Math.round((m / 60) * 10) / 10).toLocaleString(lang);
  const { stats, recs, active } = data;
  const goalPct = Math.min(100, Math.round((stats.minutesThisWeek / 60 / data.goalHours) * 100));
  const activeStage = new Map(active.map((a) => [a.node.id, a.roll.nextStage ?? STAGES[0]]));
  const practiceHref = (id: string, stage?: Stage) => `/learn/${id}/${stage ?? activeStage.get(id) ?? STAGES[0]}`;
  const [top, ...queue] = recs;
  const topNode = top ? GRAPH.byId.get(top.id)! : null;
  const logSkills = [
    ...active.map((a) => a.node),
    ...recs.map((r) => GRAPH.byId.get(r.id)!).filter((n) => !activeStage.has(n.id)),
  ].map((n) => ({ id: n.id, label: n.label }));

  return (
    <div className="flex flex-col gap-8">
      <header className="motion-safe:animate-rise flex flex-col gap-2">
        <p className="kicker">{s.nav}</p>
        <h1 className="text-title leading-tight font-black">{t.dashTitle}</h1>
        <p className="text-foreground/80 max-w-[60ch] leading-relaxed">{t.dashLead}</p>
      </header>

      {/* Stats */}
      <section aria-label={t.dashTitle} className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
        <Stat
          icon={Clock}
          value={hours(stats.minutesThisWeek)}
          caption={t.statHoursWeek}
          tone="bg-accent text-accent-foreground"
        />
        <Stat icon={Flame} value={stats.streak} caption={t.statStreak} tone="bg-caution-soft text-caution" />
        <Stat
          icon={CalendarCheck}
          value={`${stats.activeDaysThisWeek}/7`}
          caption={t.statActiveDays}
          tone="bg-secondary text-foreground"
        />
        <Stat icon={Trophy} value={data.skillsDone} caption={t.statSkillsDone} tone="bg-fit-soft text-fit" />
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-8">
        <div className="flex min-w-0 flex-col gap-8">
          {/* Continue */}
          {data.resume && (
            <Link
              href={practiceHref(data.resume.skill, data.resume.stage)}
              className="group bg-primary text-primary-foreground flex min-h-16 items-center justify-between gap-3 rounded-2xl px-4 py-3.5 shadow-sm transition-transform hover:-translate-y-0.5 motion-reduce:transition-none sm:px-5"
            >
              <span className="flex min-w-0 items-center gap-3">
                <PlayCircle className="size-7 shrink-0" aria-hidden />
                <span className="flex min-w-0 flex-col">
                  <span className="text-primary-foreground/80 text-xs">{t.resumeTitle}</span>
                  <span className="truncate font-bold">
                    <bdi dir="ltr">{label(data.resume.skill)}</bdi> · {s.stage[data.resume.stage]}
                  </span>
                </span>
              </span>
              <ArrowLeft
                className="size-5 shrink-0 transition-transform group-hover:-translate-x-0.5 ltr:rotate-180"
                aria-hidden
              />
            </Link>
          )}

          {/* Next best topic */}
          <section aria-labelledby="next-best" className="flex flex-col gap-3">
            <h2 id="next-best" className="text-xl font-bold">
              {t.nextTitle}
            </h2>
            {top && topNode ? (
              <div className="bg-card border-primary/25 flex flex-col gap-4 rounded-2xl border-2 p-4 sm:p-5">
                <div className="flex items-start gap-3.5">
                  <SkillMonogram label={topNode.label} category={topNode.category} size="lg" />
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="text-muted-foreground text-xs">{s.category[topNode.category]}</span>
                    <Link href={`/learn/${topNode.id}`} className="text-2xl leading-tight font-black hover:underline">
                      <bdi dir="ltr">{topNode.label}</bdi>
                    </Link>
                    <span className="text-muted-foreground text-sm">{fmt(s.hoursPill, { n: topNode.hours })}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <h3 className="kicker">{t.nextWhy}</h3>
                  <ul className="flex flex-col gap-1.5">
                    {top.reasons.slice(0, 4).map((r, i) => (
                      <li key={i} className="flex items-start gap-2 text-[0.95rem] leading-snug">
                        <Sparkles className="text-primary mt-0.5 size-4 shrink-0" aria-hidden />
                        <span className="min-w-0">{reasonText(r, t)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <Button asChild size="lg" className="min-h-12 w-full rounded-full sm:w-fit">
                  <Link href={practiceHref(topNode.id)}>
                    {activeStage.has(topNode.id) ? t.continuePractice : t.startPractice}
                    <ArrowLeft className="size-4 ltr:rotate-180" aria-hidden />
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="bg-card flex flex-col items-start gap-3 rounded-xl border border-dashed p-5">
                <p className="text-foreground/80 text-sm">{t.noRecs}</p>
                <Button asChild variant="outline" className="min-h-11 rounded-full">
                  <Link href="/profile">{t.completeProfile}</Link>
                </Button>
              </div>
            )}
            {queue.length > 0 && (
              <div className="flex flex-col gap-2">
                <h3 className="kicker">{t.queueTitle}</h3>
                <ol className="bg-card divide-y rounded-xl border">
                  {queue.slice(0, 4).map((r, i) => {
                    const n = GRAPH.byId.get(r.id)!;
                    const why =
                      r.reasons.find(
                        (x) => x.kind !== "continue" && x.kind !== "prereqsMet" && x.kind !== "noPrereqs",
                      ) ?? r.reasons[0];
                    return (
                      <li key={r.id}>
                        <Link
                          href={practiceHref(r.id)}
                          className="hover:bg-secondary/50 flex min-h-14 items-center gap-3 px-3 py-2.5 transition-colors first:rounded-t-xl last:rounded-b-xl sm:px-4"
                        >
                          <span className="text-muted-foreground w-4 shrink-0 font-mono text-sm">{i + 2}</span>
                          <SkillMonogram label={n.label} category={n.category} size="sm" />
                          <span className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate font-semibold">
                              <bdi dir="ltr">{n.label}</bdi>
                            </span>
                            {why && (
                              <span className="text-muted-foreground truncate text-xs">{reasonText(why, t)}</span>
                            )}
                          </span>
                          <ArrowLeft className="text-muted-foreground size-4 shrink-0 ltr:rotate-180" aria-hidden />
                        </Link>
                      </li>
                    );
                  })}
                </ol>
              </div>
            )}
          </section>

          {/* Active skills */}
          <section aria-labelledby="active" className="flex flex-col gap-3">
            <h2 id="active" className="text-xl font-bold">
              {t.activeTitle}
            </h2>
            {active.length === 0 ? (
              <p className="bg-card text-foreground/80 rounded-xl border border-dashed p-5 text-sm">
                {t.noActive}
                <Link href="/learn" className="text-primary font-semibold hover:underline">
                  {t.noActiveLink}
                </Link>
                .
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {active.map(({ node, roll }) => (
                  <li key={node.id} className="bg-card flex flex-col gap-3 rounded-xl border p-4">
                    <div className="flex items-center gap-3">
                      <ProgressRing value={roll.pct / 100} size={44} stroke={4} label={`${roll.pct}%`}>
                        <span className="font-mono text-[0.7rem] font-semibold" dir="ltr">
                          {roll.pct}%
                        </span>
                      </ProgressRing>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <Link href={`/learn/${node.id}`} className="truncate font-bold hover:underline">
                          <bdi dir="ltr">{node.label}</bdi>
                        </Link>
                        <span className="text-muted-foreground text-xs">
                          {fmt(t.stagesDone, { n: roll.doneStages })}
                        </span>
                      </div>
                      {roll.nextStage && (
                        <Button asChild size="sm" variant="outline" className="min-h-10 shrink-0 rounded-full">
                          <Link href={practiceHref(node.id, roll.nextStage)}>{t.continuePractice}</Link>
                        </Button>
                      )}
                    </div>
                    <ol className="grid grid-cols-3 gap-2">
                      {roll.stages.map((st) => (
                        <li key={st.stage} className="min-w-0">
                          <Link
                            href={practiceHref(node.id, st.stage)}
                            className="hover:bg-secondary/60 flex flex-col gap-1.5 rounded-lg p-1.5 transition-colors"
                          >
                            <span className="flex items-center justify-between gap-1 text-xs">
                              <span className="truncate">{s.stage[st.stage]}</span>
                              {st.state === "done" && (
                                <Check className="text-fit size-3.5 shrink-0" aria-label={t.stageDone} />
                              )}
                            </span>
                            <Progress
                              value={Math.round(st.fraction * 100)}
                              className="h-1.5"
                              aria-label={s.stage[st.stage]}
                            />
                            <span className="text-muted-foreground font-mono text-[0.65rem]" dir="ltr">
                              {st.topicsDone}/{st.topicsTotal}
                              {st.practiceDone > 0 && (
                                <span className="text-fit ms-1.5 inline-flex items-center gap-0.5">
                                  <Hammer className="size-3" aria-hidden />
                                  {st.practiceDone}
                                  <span className="sr-only">{t.exercisesDone}</span>
                                </span>
                              )}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ol>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Review */}
          <section aria-labelledby="review" className="flex flex-col gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="review" className="text-xl font-bold">
                {t.reviewTitle}
              </h2>
              {data.reviewsDueCount > 0 && (
                <span className="bg-caution-soft text-caution rounded-full px-2.5 py-0.5 text-xs font-semibold">
                  {fmt(t.reviewDue, { n: data.reviewsDueCount })}
                </span>
              )}
            </div>
            <p className="text-muted-foreground text-sm">{t.reviewLead}</p>
            {data.reviews.length === 0 ? (
              <p className="bg-card text-foreground/80 rounded-xl border border-dashed p-5 text-sm">{t.reviewEmpty}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {data.reviews.map((r) => (
                  <li key={r.id}>
                    <Link
                      href={`/learn/${r.skill}/${r.stage}?tab=qa`}
                      className="bg-card hover:border-foreground/25 flex min-h-14 items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors sm:px-4"
                    >
                      <RotateCcw
                        className={cn("size-4 shrink-0", r.rating === "MISSED" ? "text-destructive" : "text-caution")}
                        aria-hidden
                      />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span dir="auto" className="line-clamp-2 text-sm font-semibold">
                          {r.question}
                        </span>
                        <span className="text-muted-foreground text-xs">
                          <bdi dir="ltr">{label(r.skill)}</bdi> · {s.stage[r.stage as Stage] ?? r.stage} ·{" "}
                          {t.rated[r.rating]}
                        </span>
                      </span>
                      <span className="text-primary shrink-0 text-xs font-semibold">{t.reviewOpen}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Aside: weekly goal + time log */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
          <section aria-labelledby="goal" className="bg-card flex flex-col gap-3 rounded-xl border p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 id="goal" className="font-bold">
                {t.goalTitle}
              </h2>
              <GoalEditor initial={data.goalHours} t={t} />
            </div>
            <Progress value={goalPct} className="h-2.5" aria-label={t.goalTitle} />
            <p className="text-sm tabular-nums">
              {fmt(t.goalOf, { done: hours(stats.minutesThisWeek), goal: data.goalHours })}
            </p>
            {goalPct >= 100 && <p className="text-fit text-sm font-semibold">{t.goalHit}</p>}
            <p className="text-muted-foreground text-xs">
              {t.statTotalHours}: <span className="tabular-nums">{hours(stats.totalMinutes)}</span>
            </p>
          </section>

          {logSkills.length > 0 && (
            <section aria-labelledby="log" className="bg-card flex flex-col gap-3 rounded-xl border p-4">
              <h2 id="log" className="inline-flex items-center gap-2 font-bold">
                <ListChecks className="size-4" aria-hidden />
                {t.logTitle}
              </h2>
              <LogSessionForm skills={logSkills} defaultSkill={data.resume?.skill} t={t} />
              {data.sessions.length > 0 && (
                <div className="flex flex-col gap-1.5 border-t pt-3">
                  <h3 className="kicker">{t.recentSessions}</h3>
                  <ul className="flex flex-col gap-1.5">
                    {data.sessions.map((x) => (
                      <li key={x.id} className="flex items-baseline justify-between gap-2 text-sm">
                        <span className="min-w-0 truncate">
                          <bdi dir="ltr">{label(x.skill)}</bdi>
                          {x.note && <span className="text-muted-foreground"> · {x.note}</span>}
                        </span>
                        <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                          {fmt(t.minutesShort, { n: x.minutes })}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
