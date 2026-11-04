import Link from "next/link";
import { BookOpen, ExternalLink, GraduationCap, Route } from "lucide-react";
import { ShowMoreList } from "@/components/density/ShowMoreList";
import { Button } from "@/components/ui/button";
import { DEBRIEF_WEIGHT, type SkillGap } from "@/lib/gaps/aggregate";
import { loadGapReport, MAX_TARGET_JOBS } from "@/lib/gaps/server";
import { getLocale } from "@/lib/i18n";
import { densityStrings } from "@/lib/i18n/density";
import { gapsStrings } from "@/lib/i18n/gaps";
import { fmt } from "@/lib/i18n/learning";
import { localizedTitle } from "@/lib/i18n/titles";
import { GRAPH } from "@/lib/learning/graph";
import { getProgress } from "@/lib/learning/server";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";
export const generateMetadata = localizedTitle("learnGaps");

const PLAN_SIZE = 3;

/** Cross-job skill-gap analysis with a study plan (#117). */
export default async function SkillGapsPage() {
  const user = await requireUser("/learn/gaps");
  const locale = await getLocale();
  const s = gapsStrings(locale);
  const ds = densityStrings(locale);
  const [{ report, hasProfile }, progress] = await Promise.all([loadGapReport(user.id), getProgress(user.id)]);
  const statusOf = new Map(progress.map((p) => [p.skill, p.status]));

  const header = (
    <header className="rule-double flex flex-col gap-2 pb-4">
      <p className="kicker">{s.kicker}</p>
      <h1 className="font-heading text-title flex items-center gap-2 font-black">
        <GraduationCap className="text-primary size-7 shrink-0" aria-hidden />
        {s.title}
      </h1>
      <p className="text-muted-foreground max-w-3xl leading-relaxed">{s.lead}</p>
    </header>
  );

  const empty = (text: string, href: string, cta: string) => (
    <div className="bg-card flex flex-col items-start gap-3 rounded-xl border p-4 sm:p-5" data-testid="gaps-empty">
      <p>{text}</p>
      <Button asChild>
        <Link href={href}>{cta}</Link>
      </Button>
    </div>
  );

  if (!hasProfile || !report)
    return (
      <div className="flex flex-col gap-6" data-testid="gaps-page">
        {header}
        {empty(s.noProfile, "/profile", s.noProfileCta)}
      </div>
    );

  const c = report.counts;
  const totalJobs = c.target + c.saved + c.applied;
  const top = report.gaps.slice(0, PLAN_SIZE);

  const gapCard = (g: SkillGap, i: number) => {
    const st = g.nodeId ? statusOf.get(g.nodeId) : undefined;
    return (
      <li key={g.key} className="bg-card flex flex-col gap-2 rounded-xl border p-4" data-testid="gap-item">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-heading min-w-0 text-lg font-bold">
            <span className="text-muted-foreground me-2 font-mono text-sm">{i + 1}.</span>
            <bdi>{g.label}</bdi>
          </h3>
          <span className="flex items-center gap-2">
            {st ? (
              <span className="bg-fit-soft text-fit rounded-full px-2 py-0.5 text-xs font-semibold">
                {s.status[st] ?? st}
              </span>
            ) : null}
            <span className="bg-muted rounded-full px-2 py-0.5 font-mono text-xs" title={s.method}>
              {g.score}
            </span>
          </span>
        </div>
        {g.jobs > 0 ? (
          <>
            <p className="text-sm">{fmt(s.missingIn, { jobs: g.jobs, total: c.withStack, share: g.share })}</p>
            <div className="bg-muted h-2 w-full overflow-hidden rounded-full" role="presentation" aria-hidden>
              <div className="bg-primary h-full rounded-full" style={{ width: `${Math.max(2, g.share)}%` }} />
            </div>
            <p className="text-muted-foreground text-xs">{fmt(s.bySource, g.bySource)}</p>
          </>
        ) : null}
        {g.debriefHits > 0 ? (
          <p className="text-caution text-sm font-medium">{fmt(s.debriefHits, { n: g.debriefHits })}</p>
        ) : null}
        {g.inProfile ? <p className="text-muted-foreground text-xs">{s.inProfile}</p> : null}
        {g.avgGain > 0 ? <p className="text-fit text-sm">{fmt(s.avgGain, { gain: g.avgGain })}</p> : null}
        {g.examples.length ? (
          <p className="text-muted-foreground text-xs break-words">
            {s.examples}{" "}
            {g.examples.map((e, k) => (
              <span key={k}>
                {k ? " · " : ""}
                <bdi>{e}</bdi>
              </span>
            ))}
          </p>
        ) : null}
        {g.nodeId ? (
          <Link href={`/learn/${g.nodeId}`} className="text-primary self-start text-sm font-semibold underline">
            {s.learnIt}
          </Link>
        ) : (
          <span className="text-muted-foreground text-xs">{s.noNode}</span>
        )}
      </li>
    );
  };

  return (
    <div className="flex flex-col gap-6" data-testid="gaps-page">
      {header}

      <section className="bg-card flex flex-col gap-2 rounded-xl border p-4 sm:p-5" data-testid="gaps-counts">
        <p className="text-sm">
          <span className="font-semibold">{s.analyzed}: </span>
          <bdi className="font-mono">{c.target}</bdi> {s.srcTarget} · <bdi className="font-mono">{c.saved}</bdi>{" "}
          {s.srcSaved} · <bdi className="font-mono">{c.applied}</bdi> {s.srcApplied} ·{" "}
          <bdi className="font-mono">{c.withStack}</bdi> {s.withStack} · <bdi className="font-mono">{c.debriefs}</bdi>{" "}
          {s.weakDebriefs}
        </p>
        <p className="text-muted-foreground text-xs leading-relaxed">
          {fmt(s.method, { w: DEBRIEF_WEIGHT, cap: MAX_TARGET_JOBS })}
        </p>
      </section>

      {totalJobs === 0 && c.debriefs === 0 ? (
        empty(s.noJobs, "/jobs", s.noJobsCta)
      ) : report.gaps.length === 0 ? (
        <p className="bg-fit-soft rounded-xl p-4">{s.noGaps}</p>
      ) : (
        <>
          <section aria-labelledby="gaps-plan" className="flex flex-col gap-3" data-testid="gaps-plan">
            <h2 id="gaps-plan" className="font-heading text-xl font-bold">
              {s.plan}
            </h2>
            <p className="text-muted-foreground text-sm">{s.planLead}</p>
            <ol className="grid gap-3 md:grid-cols-3">
              {top.map((g, i) => {
                const node = g.nodeId ? GRAPH.byId.get(g.nodeId) : undefined;
                const prereq = node?.prerequisites
                  .filter((p) => statusOf.get(p) !== "DONE")
                  .map((p) => GRAPH.byId.get(p)?.label ?? p);
                return (
                  <li key={g.key} className="bg-card flex min-w-0 flex-col gap-2 rounded-xl border p-4">
                    <p className="font-heading font-bold">
                      <span className="text-muted-foreground me-1 font-mono text-sm">{i + 1}.</span>
                      <bdi>{g.label}</bdi>
                    </p>
                    {node ? <p className="text-muted-foreground text-xs">{fmt(s.hours, { h: node.hours })}</p> : null}
                    {prereq?.length ? <p className="text-xs">{fmt(s.prereq, { list: prereq.join(", ") })}</p> : null}
                    <ul className="flex flex-col gap-1 text-sm">
                      {node ? (
                        <li>
                          <Link
                            href={`/learn/${node.id}`}
                            className="text-primary inline-flex items-center gap-1 underline"
                          >
                            <BookOpen className="size-3.5" aria-hidden />
                            {s.learnIt}
                          </Link>
                        </li>
                      ) : null}
                      {node ? (
                        <li>
                          <a
                            href={node.docs.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary inline-flex items-center gap-1 underline"
                          >
                            <ExternalLink className="size-3.5" aria-hidden />
                            {s.docs}: <bdi>{node.docs.by}</bdi>
                          </a>
                        </li>
                      ) : null}
                      {node ? (
                        <li>
                          <a
                            href={node.course.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary inline-flex items-center gap-1 underline"
                          >
                            <ExternalLink className="size-3.5" aria-hidden />
                            {s.course}: <bdi>{node.course.by}</bdi>
                          </a>
                        </li>
                      ) : null}
                      {node?.roadmapSh ? (
                        <li>
                          <a
                            href={`https://roadmap.sh/${node.roadmapSh}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary inline-flex items-center gap-1 underline"
                          >
                            <Route className="size-3.5" aria-hidden />
                            {s.roadmap}
                          </a>
                        </li>
                      ) : null}
                    </ul>
                    <p className="text-muted-foreground mt-auto text-xs">
                      {s.practice}:{" "}
                      <Link href="/learn/problem-solving" className="underline">
                        {s.practicePs}
                      </Link>{" "}
                      ·{" "}
                      <Link href="/learn/system-design" className="underline">
                        {s.practiceSd}
                      </Link>{" "}
                      ·{" "}
                      <Link href="/interview" className="underline">
                        {s.practicePrep}
                      </Link>
                    </p>
                  </li>
                );
              })}
            </ol>
          </section>

          <section aria-labelledby="gaps-ranked" className="flex flex-col gap-3">
            <h2 id="gaps-ranked" className="font-heading text-xl font-bold">
              {s.ranked}
            </h2>
            <ShowMoreList initial={8} step={8} s={ds} testId="gaps-list" label={s.ranked} className="grid gap-3">
              {report.gaps.map(gapCard)}
            </ShowMoreList>
          </section>
        </>
      )}

      <section className="text-muted-foreground flex flex-col gap-1 border-t pt-4 text-xs">
        <p className="font-semibold">{s.sources}</p>
        <p className="leading-relaxed">{s.sourcesBody}</p>
        <p className="flex flex-wrap gap-3 pt-2">
          <span>{s.related}:</span>
          <Link href="/learn" className="underline">
            {s.relatedRoadmaps}
          </Link>
          <Link href="/cv/ats" className="underline">
            {s.relatedAts}
          </Link>
          <Link href="/coach" className="underline">
            {s.relatedCoach}
          </Link>
        </p>
      </section>
    </div>
  );
}
