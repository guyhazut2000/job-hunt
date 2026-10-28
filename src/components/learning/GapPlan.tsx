import Link from "next/link";
import { ArrowLeft, Check, Clock, GraduationCap, ListOrdered, TrendingUp } from "lucide-react";
import type { Profile } from "@prisma/client";
import { Percent } from "@/components/Percent";
import { fmt, learningStrings } from "@/lib/i18n/learning";
import type { Locale } from "@/lib/i18n";
import { GRAPH, planGaps, resolveSkill, scoreWithout } from "@/lib/learning/graph";
import { demandMap, getProgress } from "@/lib/learning/server";
import { scoreMatch, toCandidate, type ScoredJob } from "@/lib/profile/score";
import { cn } from "@/lib/utils";

/**
 * "Close the gaps" panel for one job: the job's missing skills plus the prerequisites the user
 * lacks, in learnable (topological) order, with per-skill impact and total time. Self-contained:
 * it fetches demand + the user's learning progress itself.
 */
export async function GapPlan({
  job,
  profile,
  userId,
  locale,
}: {
  job: ScoredJob;
  profile: Profile;
  userId: string;
  locale: Locale;
}) {
  const s = learningStrings(locale);
  const [demand, progress] = await Promise.all([demandMap(), getProgress(userId)]);
  const c = toCandidate(profile);
  const doneIds = progress.filter((p) => p.status === "DONE").map((p) => p.skill);
  const statusOf = new Map(progress.map((p) => [p.skill, p.status]));
  const plan = planGaps(c, job, { demand, doneIds });

  const total = job.techStack.length;
  const have = total - scoreMatch(c, job).missingSkills.length;

  // before → now for skills this feature added to the profile and this job lists.
  const jobNodes = new Set(job.techStack.map((t) => resolveSkill(t)?.id).filter(Boolean));
  const learned = progress
    .filter((p) => p.addedToProfile && jobNodes.has(p.skill))
    .map((p) => GRAPH.byId.get(p.skill)?.label)
    .filter((l): l is string => !!l);
  const before = learned.length ? scoreWithout(c, job, learned) : null;

  if (total === 0) return null;
  const lang = locale === "he" ? "he-IL" : "en-US";

  const gain = Math.max(0, plan.after - plan.current);

  return (
    <section aria-labelledby="close-gaps" className="bg-card flex flex-col gap-5 rounded-xl border p-4 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="bg-accent text-accent-foreground grid size-10 shrink-0 place-items-center rounded-full">
          <GraduationCap className="size-5" aria-hidden />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <h2 id="close-gaps" className="font-heading text-xl font-bold">
            {s.panelTitle}
          </h2>
          <p className="text-foreground/80 max-w-[60ch] text-sm leading-relaxed">
            {plan.steps.length ? fmt(s.panelIntro, { have, total }) : s.panelNoGaps}
          </p>
        </div>
      </div>

      {plan.steps.length > 0 && (
        <div className="bg-secondary/40 flex flex-col gap-3 rounded-lg p-3.5 sm:p-4">
          <div className="flex items-end justify-between gap-3">
            <span className="flex flex-col">
              <span className="text-muted-foreground text-xs">{s.matchNow}</span>
              <Percent value={plan.current} className="font-heading text-2xl font-black" />
            </span>
            <span className="text-fit flex flex-col items-end">
              <span className="text-xs font-semibold">{s.matchAfter}</span>
              <span className="inline-flex items-baseline gap-1.5">
                {gain > 0 && (
                  <span className="font-mono text-xs font-semibold" dir="ltr">
                    +{gain}
                  </span>
                )}
                <Percent value={plan.after} className="font-heading text-2xl font-black" />
              </span>
            </span>
          </div>
          {/* Before/after bar. Physical direction follows the reading direction via start/end. */}
          <div
            role="img"
            aria-label={fmt(s.matchBar, { now: plan.current, after: plan.after })}
            className="bg-background relative h-2.5 overflow-hidden rounded-full border"
          >
            <span className="bg-fit/30 absolute inset-y-0 start-0 rounded-full" style={{ width: `${plan.after}%` }} />
            <span className="bg-fit absolute inset-y-0 start-0 rounded-full" style={{ width: `${plan.current}%` }} />
          </div>
          <div className="text-foreground/80 flex flex-wrap gap-x-4 gap-y-1 text-xs">
            <span className="inline-flex items-center gap-1">
              <ListOrdered className="size-3.5" aria-hidden />
              {fmt(s.stepsCount, { n: plan.steps.length })}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3.5" aria-hidden />
              {fmt(s.totalTime, { hours: plan.totalHours })}
            </span>
          </div>
        </div>
      )}

      {before != null && before !== plan.current && (
        <p className="bg-fit-soft text-accent-foreground rounded-lg px-3 py-2 text-sm">
          {fmt(s.learnedBefore, { skills: learned.join(", "), before, now: plan.current })}
        </p>
      )}

      {plan.steps.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="kicker">{s.stepsTitle}</h3>
          <ol className="flex flex-col">
            {plan.steps.map((st, i) => {
              const status = statusOf.get(st.node.id);
              return (
                <li key={st.node.id} className="relative flex gap-3 pb-2 last:pb-0">
                  {/* connector line runs down the logical start edge, so it mirrors in RTL */}
                  {i < plan.steps.length - 1 && (
                    <span aria-hidden className="bg-border absolute start-[0.95rem] top-9 bottom-0 w-0.5 rounded" />
                  )}
                  <span
                    aria-hidden
                    className={cn(
                      "z-10 mt-2 grid size-8 shrink-0 place-items-center rounded-full border-2 font-mono text-xs font-semibold",
                      status === "DONE"
                        ? "bg-fit-soft border-fit/50 text-fit"
                        : st.isPrerequisite
                          ? "bg-caution-soft border-caution/40 text-caution"
                          : "bg-card border-primary/40 text-primary",
                    )}
                  >
                    {status === "DONE" ? <Check className="size-3.5" /> : i + 1}
                  </span>
                  <Link
                    href={`/learn/${st.node.id}`}
                    className="group hover:bg-secondary/50 hover:border-border flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-lg border border-transparent px-2.5 py-2 transition-colors"
                  >
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <bdi dir="ltr" className="font-semibold">
                          {st.node.label}
                        </bdi>
                        {st.isPrerequisite && (
                          <span className="bg-caution-soft text-caution rounded-full px-2 py-0.5 text-[0.7rem] font-semibold">
                            {s.prereqBadge}
                          </span>
                        )}
                        {status && (
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[0.7rem] font-semibold",
                              status === "DONE" ? "bg-fit-soft text-fit" : "bg-secondary",
                            )}
                          >
                            {s.status[status]}
                          </span>
                        )}
                      </span>
                      <span className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
                        {st.isPrerequisite && st.neededFor.length > 0 && (
                          <span>
                            {fmt(s.prereqFor, { skills: "" })}
                            <bdi dir="ltr">{st.neededFor.join(", ")}</bdi>
                          </span>
                        )}
                        {st.gain > 0 && (
                          <span className="text-fit inline-flex items-center gap-1 font-semibold">
                            <TrendingUp className="size-3.5" aria-hidden />
                            {fmt(s.gainThisJob, { n: st.gain })}
                          </span>
                        )}
                        {st.demand > 0 && <span>{fmt(s.demandJobs, { n: st.demand.toLocaleString(lang) })}</span>}
                        <span className="inline-flex items-center gap-1">
                          <Clock className="size-3.5" aria-hidden />
                          {fmt(s.hoursShort, { n: st.hours })}
                        </span>
                      </span>
                    </span>
                    <span className="text-primary hidden shrink-0 items-center gap-1 text-xs font-semibold sm:inline-flex">
                      {s.openRoadmap}
                      <ArrowLeft
                        className="size-3.5 transition-transform group-hover:-translate-x-0.5 ltr:rotate-180 ltr:group-hover:translate-x-0.5"
                        aria-hidden
                      />
                    </span>
                    <ArrowLeft className="text-muted-foreground size-4 shrink-0 sm:hidden ltr:rotate-180" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-sm">
        {plan.unmapped.length > 0 ? (
          <p className="text-muted-foreground text-xs">
            {fmt(s.unmapped, { skills: "" })}
            <bdi dir="ltr">{plan.unmapped.join(", ")}</bdi>
          </p>
        ) : (
          <span />
        )}
        <Link
          href="/learn"
          className="text-primary inline-flex min-h-11 items-center gap-1 font-semibold hover:underline"
        >
          {s.title}
          <ArrowLeft className="size-4 ltr:rotate-180" aria-hidden />
        </Link>
      </div>
    </section>
  );
}
