import Link from "next/link";
import { ArrowLeft, Clock, GraduationCap, TrendingUp } from "lucide-react";
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

  return (
    <section aria-labelledby="close-gaps" className="card flex flex-col gap-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 id="close-gaps" className="font-heading flex items-center gap-2 text-xl font-bold">
            <GraduationCap className="text-primary size-5 shrink-0" aria-hidden />
            {s.panelTitle}
          </h2>
          <p className="text-foreground/80 text-sm">
            {plan.steps.length ? fmt(s.panelIntro, { have, total }) : s.panelNoGaps}
          </p>
        </div>
        {plan.steps.length > 0 && (
          <div className="flex items-center gap-2 font-mono text-sm" aria-label={`${s.matchNow} → ${s.matchAfter}`}>
            <span className="flex flex-col items-center">
              <Percent value={plan.current} className="text-lg font-medium" />
              <span className="kicker text-[0.6rem]">{s.matchNow}</span>
            </span>
            <ArrowLeft className="text-muted-foreground size-4 ltr:rotate-180" aria-hidden />
            <span className="text-fit flex flex-col items-center">
              <Percent value={plan.after} className="text-lg font-medium" />
              <span className="kicker text-[0.6rem]">{s.matchAfter}</span>
            </span>
          </div>
        )}
      </div>

      {before != null && before !== plan.current && (
        <p className="bg-fit-soft rounded-md px-3 py-2 text-sm">
          {fmt(s.learnedBefore, { skills: learned.join(", "), before, now: plan.current })}
        </p>
      )}

      {plan.steps.length > 0 && (
        <ol className="flex flex-col">
          {plan.steps.map((st, i) => {
            const status = statusOf.get(st.node.id);
            return (
              <li key={st.node.id} className="relative flex gap-3 pb-3 last:pb-0">
                {/* connector line runs down the logical start edge, so it mirrors in RTL */}
                {i < plan.steps.length - 1 && (
                  <span aria-hidden className="bg-border absolute start-[0.9rem] top-8 bottom-0 w-px" />
                )}
                <span
                  aria-hidden
                  className={cn(
                    "z-10 grid size-7 shrink-0 place-items-center rounded-full border font-mono text-xs",
                    st.isPrerequisite ? "bg-caution-soft border-caution/40" : "bg-card",
                    status === "DONE" && "bg-fit-soft border-fit/40",
                  )}
                >
                  {i + 1}
                </span>
                <Link
                  href={`/learn/${st.node.id}`}
                  className="hover:bg-secondary/60 -my-1 flex min-h-11 min-w-0 flex-1 flex-col gap-1 rounded-md px-2 py-1 transition-colors"
                >
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <bdi dir="ltr" className="font-semibold">
                      {st.node.label}
                    </bdi>
                    {st.isPrerequisite && (
                      <span className="bg-caution-soft rounded px-1.5 py-0.5 text-[0.7rem] font-semibold">
                        {s.prereqBadge}
                      </span>
                    )}
                    {status && (
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 text-[0.7rem] font-semibold",
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
                </Link>
              </li>
            );
          })}
        </ol>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-sm">
        {plan.steps.length > 0 && (
          <span className="inline-flex items-center gap-1.5 font-semibold">
            <Clock className="size-4" aria-hidden />
            {fmt(s.totalTime, { hours: plan.totalHours })}
          </span>
        )}
        <Link href="/learn" className="text-primary inline-flex min-h-11 items-center font-semibold hover:underline">
          {s.title}
        </Link>
      </div>
      {plan.unmapped.length > 0 && (
        <p className="text-muted-foreground text-xs">
          {fmt(s.unmapped, { skills: "" })}
          <bdi dir="ltr">{plan.unmapped.join(", ")}</bdi>
        </p>
      )}
    </section>
  );
}
