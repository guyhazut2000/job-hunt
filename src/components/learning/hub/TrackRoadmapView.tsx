import Link from "next/link";
import { ArrowLeft, Check, CircleDashed, ExternalLink, Lock, PlayCircle } from "lucide-react";
import { SkillMonogram } from "@/components/learning/SkillVisuals";
import { Progress } from "@/components/ui/progress";
import { fmt } from "@/lib/i18n/learning";
import type { LearningHubStrings } from "@/lib/i18n/learning-hub";
import { GRAPH, TRACKS } from "@/lib/learning/graph";
import { TRACK_ROADMAP_SH, type StepState, type TrackRoadmap } from "@/lib/learning/roadmap";
import { cn } from "@/lib/utils";

const ICON: Record<StepState, typeof Check> = { done: Check, learning: PlayCircle, ready: CircleDashed, locked: Lock };
const TONE: Record<StepState, string> = {
  done: "bg-fit-soft text-fit border-fit/30",
  learning: "bg-accent text-accent-foreground border-primary/30",
  ready: "bg-card text-muted-foreground",
  locked: "bg-secondary/60 text-muted-foreground",
};

/** "My roadmap": one role track in prerequisite order, with the user's status per topic. */
export function TrackRoadmapView({
  roadmap,
  mine,
  t,
}: {
  roadmap: TrackRoadmap;
  /** Track ids that come from the user's target roles (shown first, marked). */
  mine: string[];
  t: LearningHubStrings;
}) {
  const ids = [...mine, ...TRACKS.map((x) => x.id).filter((id) => !mine.includes(id))];
  const sh = TRACK_ROADMAP_SH[roadmap.trackId];
  const label = (id: string) => GRAPH.byId.get(id)?.label ?? id;
  return (
    <section id="roadmap" aria-labelledby="roadmap-title" className="flex scroll-mt-24 flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 id="roadmap-title" className="text-xl font-bold">
          {t.roadmapTitle}
        </h2>
        <p className="text-muted-foreground text-sm">{t.roadmapLead}</p>
      </div>
      <nav aria-label={t.roadmapTrack} className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {ids.map((id) => {
          const on = id === roadmap.trackId;
          return (
            <Link
              key={id}
              href={`/learn/me?track=${id}#roadmap`}
              scroll={false}
              aria-current={on ? "true" : undefined}
              className={cn(
                "inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition-colors",
                on ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-secondary",
              )}
            >
              {t.tracks[id] ?? id}
              {mine.includes(id) && (
                <span className={cn("size-1.5 rounded-full", on ? "bg-primary-foreground" : "bg-primary")}>
                  <span className="sr-only">{t.roadmapMine}</span>
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="bg-card flex flex-col gap-3 rounded-2xl border p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-semibold tabular-nums">
            {fmt(t.roadmapProgress, { done: roadmap.done, total: roadmap.total })}
          </span>
          {sh && (
            <a
              href={`https://roadmap.sh/${sh}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground inline-flex min-h-10 items-center gap-1 text-xs underline-offset-2 hover:underline"
            >
              {t.roadmapExternal}
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
          )}
        </div>
        <Progress
          value={roadmap.total ? Math.round((roadmap.done / roadmap.total) * 100) : 0}
          className="h-2"
          aria-label={t.roadmapTitle}
        />
        <ol className="relative flex flex-col">
          {roadmap.steps.map((st, i) => {
            const n = GRAPH.byId.get(st.id)!;
            const Icon = ICON[st.state];
            const next = st.id === roadmap.nextId;
            return (
              <li key={st.id} className="relative flex gap-3">
                {i < roadmap.steps.length - 1 && (
                  <span
                    aria-hidden
                    className="bg-border absolute top-11 bottom-0 w-px ltr:left-[1.15rem] rtl:right-[1.15rem]"
                  />
                )}
                <span
                  className={cn(
                    "relative z-10 mt-2 grid size-9 shrink-0 place-items-center rounded-full border",
                    TONE[st.state],
                    next && "ring-primary ring-2 ring-offset-2 ring-offset-[var(--card)]",
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                </span>
                <Link
                  href={`/learn/${st.id}`}
                  className={cn(
                    "hover:bg-secondary/60 mb-1.5 flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-xl px-2.5 py-2 transition-colors",
                    next && "bg-accent/50",
                  )}
                >
                  <SkillMonogram label={n.label} category={n.category} size="sm" />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="truncate font-semibold">
                        <bdi dir="ltr">{n.label}</bdi>
                      </span>
                      {next && (
                        <span className="bg-primary text-primary-foreground rounded-full px-2 py-0.5 text-[0.65rem] font-bold">
                          {t.roadmapNext}
                        </span>
                      )}
                    </span>
                    <span className="text-muted-foreground truncate text-xs">
                      {t.roadmapStates[st.state]}
                      {st.state === "learning" && <span dir="ltr"> · {st.pct}%</span>}
                      {st.state !== "done" && st.missing.length > 0 && (
                        <> · {fmt(t.roadmapNeeds, { skills: st.missing.map(label).join(", ") })}</>
                      )}
                    </span>
                  </span>
                  <ArrowLeft className="text-muted-foreground size-4 shrink-0 ltr:rotate-180" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ol>
        <Link href="/learn" className="text-primary min-h-10 self-start text-sm font-semibold hover:underline">
          {t.roadmapAll}
        </Link>
      </div>
    </section>
  );
}
