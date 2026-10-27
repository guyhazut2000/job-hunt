import Link from "next/link";
import { ArrowLeft, Check, Loader } from "lucide-react";
import { auth } from "@/auth";
import { getDictionary } from "@/lib/i18n";
import { fmt, learningStrings } from "@/lib/i18n/learning";
import { GRAPH, TRACKS, trackOrder } from "@/lib/learning/graph";
import { demandMap, getProgress } from "@/lib/learning/server";
import { LEARN_CATEGORIES } from "@/lib/learning/types";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Learn" };

export default async function LearnPage() {
  const [{ t, locale }, session] = await Promise.all([getDictionary(), auth()]);
  const s = learningStrings(locale);
  const [demand, progress] = await Promise.all([demandMap(), getProgress(session?.user?.id)]);
  const statusOf = new Map(progress.map((p) => [p.skill, p.status]));
  const done = progress.filter((p) => p.status === "DONE").length;
  const learning = progress.length - done;

  const mark = (id: string) => {
    const st = statusOf.get(id);
    if (st === "DONE") return <Check className="text-fit size-3.5 shrink-0" aria-label={s.status.DONE} />;
    if (st === "LEARNING") return <Loader className="text-caution size-3.5 shrink-0" aria-label={s.status.LEARNING} />;
    return null;
  };

  return (
    <div className="flex flex-col gap-8">
      <header className="rule-double flex flex-col gap-2 pb-4">
        <p className="kicker">{t.ui.kicker}</p>
        <h1 className="text-title font-black">{s.title}</h1>
        <p className="text-foreground/80 max-w-[68ch]">{s.intro}</p>
        {progress.length > 0 && (
          <p className="text-sm">
            <span className="font-semibold">{s.myProgress}: </span>
            {fmt(s.progressSummary, { learning, done })}
          </p>
        )}
      </header>

      <section aria-labelledby="tracks" className="flex flex-col gap-3">
        <h2 id="tracks" className="font-heading text-xl font-bold">
          {s.tracks}
        </h2>
        <div className="grid gap-3 md:grid-cols-2">
          {TRACKS.map((tr) => (
            <div key={tr.id} className="card flex flex-col gap-3 p-4">
              <h3 className="font-semibold">{s.track[tr.id] ?? tr.id}</h3>
              <ol className="flex flex-wrap items-center gap-1.5">
                {trackOrder(tr.skills).map((id, i) => {
                  const n = GRAPH.byId.get(id)!;
                  return (
                    <li key={id} className="flex items-center gap-1.5">
                      {i > 0 && <ArrowLeft aria-hidden className="text-muted-foreground size-3 ltr:rotate-180" />}
                      <Link
                        href={`/learn/${id}`}
                        className={cn(
                          "chip inline-flex min-h-9 items-center gap-1 hover:underline",
                          statusOf.get(id) === "DONE" && "bg-fit-soft",
                        )}
                      >
                        <span className="text-muted-foreground font-mono text-[0.65rem]">{i + 1}</span>
                        <bdi dir="ltr">{n.label}</bdi>
                        {mark(id)}
                      </Link>
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="all-skills" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="all-skills" className="font-heading text-xl font-bold">
            {s.allSkills}
          </h2>
          <span className="text-muted-foreground text-sm">{fmt(s.skillsCount, { n: GRAPH.nodes.length })}</span>
        </div>
        <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
          {LEARN_CATEGORIES.map((cat) => {
            const nodes = GRAPH.nodes
              .filter((n) => n.category === cat)
              .sort((a, b) => (demand.get(b.id) ?? 0) - (demand.get(a.id) ?? 0) || a.label.localeCompare(b.label));
            if (!nodes.length) return null;
            return (
              <div key={cat} className="flex flex-col gap-2">
                <h3 className="kicker">{s.category[cat]}</h3>
                <ul className="flex flex-col">
                  {nodes.map((n) => (
                    <li key={n.id}>
                      <Link
                        href={`/learn/${n.id}`}
                        className="hover:bg-secondary/60 flex min-h-11 items-center justify-between gap-2 rounded-md px-2 transition-colors"
                      >
                        <span className="flex items-center gap-1.5">
                          <bdi dir="ltr" className="font-medium">
                            {n.label}
                          </bdi>
                          {mark(n.id)}
                        </span>
                        {(demand.get(n.id) ?? 0) > 0 && (
                          <span className="text-muted-foreground font-mono text-xs">
                            {fmt(s.demandJobs, { n: demand.get(n.id)! })}
                          </span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
